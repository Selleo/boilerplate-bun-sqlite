import { serve } from "bun";
import { createHash } from "node:crypto";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { sql } from "kysely";
import { z } from "zod";
import index from "./index.html";
import { migrateToLatest } from "./db/db";
import { auth } from "./auth";
import { createDb } from "./db/client";
import { createAuditRepositories } from "./db/repository";

await migrateToLatest();

const db = createDb();
const repositories = createAuditRepositories(db);

const port = Number(process.env.PORT ?? 3000);

type UserRole = "admin" | "audit_manager" | "user";
type SessionData = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;

async function getRequiredSession(req: Request): Promise<SessionData | null> {
  const session = await auth.api.getSession({
    headers: req.headers,
  });

  if (!session) {
    return null;
  }

  await db
    .insertInto("user_role")
    .values({
      user_id: session.user.id,
      role: "user",
    })
    .onConflict((oc) => oc.column("user_id").doNothing())
    .executeTakeFirst();

  return session;
}

async function getUserRole(userId: string): Promise<UserRole> {
  const roleRow = await db
    .selectFrom("user_role")
    .select("role")
    .where("user_id", "=", userId)
    .executeTakeFirst();
  if (roleRow?.role === "admin") return "admin";
  if (roleRow?.role === "audit_manager") return "audit_manager";
  return "user";
}

async function isAdmin(userId: string) {
  return (await getUserRole(userId)) === "admin";
}

async function requireAuthSession(req: Request) {
  const session = await getRequiredSession(req);
  if (!session) {
    return { session: null, response: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  return { session, response: null };
}

async function requireAdminSession(req: Request) {
  const { session, response } = await requireAuthSession(req);
  if (response) {
    return { session: null, response };
  }

  if (!(await isAdmin(session.user.id))) {
    return { session: null, response: Response.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { session, response: null };
}

async function requireAuditManagerSession(req: Request) {
  const { session, response } = await requireAuthSession(req);
  if (response) {
    return { session: null, response };
  }

  const role = await getUserRole(session.user.id);
  if (role !== "admin" && role !== "audit_manager") {
    return { session: null, response: Response.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { session, response: null };
}

function parseWorkspaceIdFromRequest(req: Request): number | null {
  const raw = new URL(req.url).searchParams.get("workspaceId");
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

async function requireWorkspaceAccess(req: Request, session: SessionData) {
  const workspaceId = parseWorkspaceIdFromRequest(req);
  if (!workspaceId) {
    return {
      workspaceId: null,
      response: Response.json({ error: "workspaceId query parameter is required." }, { status: 400 }),
    };
  }

  const workspace = await db
    .selectFrom("workspace")
    .select("id")
    .where("id", "=", workspaceId)
    .executeTakeFirst();
  if (!workspace) {
    return { workspaceId: null, response: Response.json({ error: "Workspace not found." }, { status: 404 }) };
  }

  const role = await getUserRole(session.user.id);
  if (role === "admin" || role === "audit_manager") {
    return { workspaceId, response: null };
  }

  const membership = await db
    .selectFrom("workspace_member")
    .select("workspace_id")
    .where("workspace_id", "=", workspaceId)
    .where("user_id", "=", session.user.id)
    .executeTakeFirst();
  if (!membership) {
    return { workspaceId: null, response: Response.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { workspaceId, response: null };
}

async function assessmentVisibleInWorkspace(assessmentId: number, workspaceId: number) {
  const row = await db
    .selectFrom("assessment as s")
    .leftJoin("workspace_entity as we", (join) =>
      join.onRef("we.entity_id", "=", "s.entity_id").on("we.workspace_id", "=", workspaceId)
    )
    .select("s.id")
    .where("s.id", "=", assessmentId)
    .where((eb) =>
      eb.or([
        eb("s.workspace_id", "=", workspaceId),
        eb.and([
          eb("s.workspace_id", "is", null),
          eb("we.workspace_id", "is not", null),
        ]),
      ])
    )
    .executeTakeFirst();
  return Boolean(row);
}

type ParsedEntityCsvRow = {
  type: string;
  name: string;
  description: string;
};

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === "\"") {
      if (inQuotes && line[i + 1] === "\"") {
        current += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += ch;
  }

  values.push(current.trim());
  return values;
}

function parseEntitiesCsv(csvText: string): { rows: ParsedEntityCsvRow[]; errors: string[] } {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return { rows: [], errors: ["CSV is empty."] };
  }

  const rows: ParsedEntityCsvRow[] = [];
  const errors: string[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const lineNo = i + 1;
    const line = lines[i];
    if (!line) {
      errors.push(`Row ${lineNo}: empty line.`);
      continue;
    }
    const values = parseCsvLine(line);
    if (values.length < 2 || values.length > 3) {
      errors.push(`Row ${lineNo}: expected 2 or 3 columns (Entity Type, Name, Description).`);
      continue;
    }

    const normalized = values.map((item) => item.trim().toLowerCase());
    if (
      i === 0 &&
      normalized.length === 3 &&
      normalized[0] === "entity type" &&
      normalized[1] === "name" &&
      normalized[2] === "description"
    ) {
      continue;
    }

    const type = (values[0] ?? "").trim();
    const name = (values[1] ?? "").trim();
    const description = (values[2] ?? "").trim();
    if (!type) {
      errors.push(`Row ${lineNo}: entity type is required.`);
      continue;
    }
    if (!name) {
      errors.push(`Row ${lineNo}: name is required.`);
      continue;
    }

    rows.push({ type, name, description: description ?? "" });
  }

  return { rows, errors };
}

function createGravatarUrl(email: string) {
  const hash = createHash("md5").update(email.trim().toLowerCase()).digest("hex");
  return `https://www.gravatar.com/avatar/${hash}?d=identicon`;
}

function parseDashboardScore(scoreJson: string | null | undefined) {
  if (!scoreJson) {
    return { score: 0, max: 0, grade: "N/A" };
  }

  try {
    const parsed = JSON.parse(scoreJson) as {
      full?: { data?: { score?: number; max?: number; grade?: string } };
    };
    const full = parsed.full?.data;
    return {
      score: typeof full?.score === "number" ? full.score : 0,
      max: typeof full?.max === "number" ? full.max : 0,
      grade: typeof full?.grade === "string" ? full.grade : "N/A",
    };
  } catch {
    return { score: 0, max: 0, grade: "N/A" };
  }
}

const importedAuditSchema = z.object({
  name: z.string().min(1).max(180),
  description: z.string().max(4000),
  dimensions: z
    .array(
      z.object({
        name: z.string().min(1).max(180),
        criteria: z
          .array(
            z.object({
              name: z.string().min(1).max(180),
              description: z.string().max(4000),
              items: z.array(z.object({ name: z.string().min(1).max(180) })).min(1).max(100),
            })
          )
          .min(1)
          .max(100),
      })
    )
    .min(1)
    .max(100),
});

function logAuditImport(importId: string, stage: string, details?: Record<string, unknown>) {
  if (details) {
    console.log(`[audit-import:${importId}] ${stage}`, details);
    return;
  }
  console.log(`[audit-import:${importId}] ${stage}`);
}

// function faviconResponse() {
//   return new Response(favicon, {
//     headers: {
//       "Content-Type": "image/png; charset=utf-8",
//       "Cache-Control": "public, max-age=28800",
//     },
//   });
// }

async function buildAuditFromText(inputText: string) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is missing.");
  }

  const prompt = `Convert the provided audit specification text into a strict JSON object.

Rules:
- Return only structure for an audit model with dimensions -> criteria -> checklist items.
- Keep names concise and actionable, use actual words and sentences (no weird camelcalse, uppercammel case syntax)
- If the source text has sections, map them to dimensions.
- If a criterion has no explicit checklist items, infer concrete checklist items.
- Never return empty arrays.
- if source text already contains full audit spec, reduce changes to absolute minimum or zero
-

Source text:
${inputText}`;

  const result = await generateObject({
    model: openai("gpt-4o"),
    system:
      "You convert free-form audit specifications into strict JSON for audit dimensions, criteria, and checklist items.",
    schema: importedAuditSchema,
    prompt,
  });

  return result.object;
}

const server = serve({
  port,
  routes: {
    // Public routes
    "/api/auth/*": async req => {
      return auth.handler(req);
    },

    // Authenticated routes
    "/api/me": async req => {
      const { session, response } = await requireAuthSession(req);
      if (response) {
        return response;
      }

      const role = await getUserRole(session.user.id);
      return Response.json({
        ...session,
        user: {
          ...session.user,
          role,
        },
      });
    },

    // Admin routes
    "/api/dashboard": {
      async GET(req) {
        const { session, response: authResponse } = await requireAuthSession(req);
        if (authResponse) {
          return authResponse;
        }

        const { workspaceId, response: workspaceResponse } = await requireWorkspaceAccess(req, session);
        if (workspaceResponse) {
          return workspaceResponse;
        }
        if (!workspaceId) {
          return Response.json({ error: "workspaceId query parameter is required." }, { status: 400 });
        }

        const [
          auditCountRow,
          publishedAuditCountRow,
          entityCountRow,
          draftAssessmentCountRow,
          submittedAssessmentCountRow,
          recentAssessmentsRows,
        ] = await Promise.all([
          db
            .selectFrom("workspace_audit as wa")
            .select((eb) => eb.fn.count<number>("wa.audit_id").as("count"))
            .where("wa.workspace_id", "=", workspaceId)
            .executeTakeFirstOrThrow(),
          db
            .selectFrom("workspace_audit as wa")
            .innerJoin("audit as a", "a.id", "wa.audit_id")
            .select((eb) => eb.fn.count<number>("wa.audit_id").as("count"))
            .where("wa.workspace_id", "=", workspaceId)
            .where("a.current_published_version_id", "is not", null)
            .executeTakeFirstOrThrow(),
          db
            .selectFrom("workspace_entity")
            .select((eb) => eb.fn.count<number>("entity_id").as("count"))
            .where("workspace_id", "=", workspaceId)
            .executeTakeFirstOrThrow(),
          db
            .selectFrom("assessment as s")
            .leftJoin("workspace_entity as we", (join) =>
              join.onRef("we.entity_id", "=", "s.entity_id").on("we.workspace_id", "=", workspaceId)
            )
            .select((eb) => eb.fn.count<number>("s.id").as("count"))
            .where((eb) =>
              eb.or([
                eb("s.workspace_id", "=", workspaceId),
                eb.and([
                  eb("s.workspace_id", "is", null),
                  eb("we.workspace_id", "is not", null),
                ]),
              ])
            )
            .where("s.status", "=", "draft")
            .executeTakeFirstOrThrow(),
          db
            .selectFrom("assessment as s")
            .leftJoin("workspace_entity as we", (join) =>
              join.onRef("we.entity_id", "=", "s.entity_id").on("we.workspace_id", "=", workspaceId)
            )
            .select((eb) => eb.fn.count<number>("s.id").as("count"))
            .where((eb) =>
              eb.or([
                eb("s.workspace_id", "=", workspaceId),
                eb.and([
                  eb("s.workspace_id", "is", null),
                  eb("we.workspace_id", "is not", null),
                ]),
              ])
            )
            .where("s.status", "=", "submitted")
            .executeTakeFirstOrThrow(),
          db
            .selectFrom("assessment as s")
            .leftJoin("workspace_entity as we", (join) =>
              join.onRef("we.entity_id", "=", "s.entity_id").on("we.workspace_id", "=", workspaceId)
            )
            .innerJoin("audit as a", "a.id", "s.audit_id")
            .innerJoin("entity as e", "e.id", "s.entity_id")
            .select([
              "s.id",
              "s.status",
              "s.updated_at",
              "s.grade",
              "s.score_json",
              "a.name as audit_name",
              "e.entity_type",
              "e.name as entity_name",
            ])
            .where((eb) =>
              eb.or([
                eb("s.workspace_id", "=", workspaceId),
                eb.and([
                  eb("s.workspace_id", "is", null),
                  eb("we.workspace_id", "is not", null),
                ]),
              ])
            )
            .orderBy("s.updated_at", "desc")
            .orderBy("s.id", "desc")
            .limit(10)
            .execute(),
        ]);

        return Response.json({
          metrics: {
            auditsTotal: Number(auditCountRow.count ?? 0),
            publishedAudits: Number(publishedAuditCountRow.count ?? 0),
            draftAssessments: Number(draftAssessmentCountRow.count ?? 0),
            submittedAssessments: Number(submittedAssessmentCountRow.count ?? 0),
            entitiesTotal: Number(entityCountRow.count ?? 0),
          },
          recentAssessments: recentAssessmentsRows.map((row) => {
            const score = parseDashboardScore(row.score_json);
            return {
              id: row.id,
              auditName: row.audit_name,
              entityType: row.entity_type,
              entityName: row.entity_name,
              status: row.status,
              updatedAt: row.updated_at,
              grade: row.grade ?? score.grade,
              score: {
                full: {
                  data: {
                    score: score.score,
                    max: score.max,
                  },
                },
              },
            };
          }),
        });
      },
    },

    "/api/search": {
      async GET(req) {
        const { session, response: authResponse } = await requireAuthSession(req);
        if (authResponse) {
          return authResponse;
        }

        const { workspaceId, response: workspaceResponse } = await requireWorkspaceAccess(req, session);
        if (workspaceResponse) {
          return workspaceResponse;
        }
        if (!workspaceId) {
          return Response.json({ error: "workspaceId query parameter is required." }, { status: 400 });
        }

        const url = new URL(req.url);
        const query = url.searchParams.get("q")?.trim() ?? "";
        if (query.length < 2) {
          return Response.json({
            audits: [],
            assessments: [],
            entities: [],
          });
        }

        const like = `%${query}%`;

        const [audits, assessments, entities] = await Promise.all([
          db
            .selectFrom("audit as a")
            .innerJoin("workspace_audit as wa", "wa.audit_id", "a.id")
            .select(["a.id", "a.public_id", "a.name"])
            .where("wa.workspace_id", "=", workspaceId)
            .where((eb) =>
              eb.or([
                eb("a.name", "like", like),
                eb("a.public_id", "like", like),
              ])
            )
            .orderBy("a.updated_at", "desc")
            .limit(5)
            .execute(),
          db
            .selectFrom("assessment as s")
            .leftJoin("workspace_entity as we", (join) =>
              join.onRef("we.entity_id", "=", "s.entity_id").on("we.workspace_id", "=", workspaceId)
            )
            .innerJoin("audit as a", "a.id", "s.audit_id")
            .innerJoin("entity as e", "e.id", "s.entity_id")
            .select([
              "s.id",
              "s.audit_id",
              "s.status",
              "s.report_share_hash",
              "a.public_id as audit_public_id",
              "a.name as audit_name",
              "e.entity_type",
              "e.name as entity_name",
            ])
            .where((eb) =>
              eb.or([
                eb("s.workspace_id", "=", workspaceId),
                eb.and([
                  eb("s.workspace_id", "is", null),
                  eb("we.workspace_id", "is not", null),
                ]),
              ])
            )
            .where((eb) =>
              eb.or([
                eb("a.name", "like", like),
                eb("a.public_id", "like", like),
                eb("e.entity_type", "like", like),
                eb("e.name", "like", like),
              ])
            )
            .orderBy("s.updated_at", "desc")
            .limit(5)
            .execute(),
          db
            .selectFrom("entity as e")
            .innerJoin("workspace_entity as we", "we.entity_id", "e.id")
            .select(["e.id", "e.entity_type", "e.name"])
            .where("we.workspace_id", "=", workspaceId)
            .where((eb) =>
              eb.or([
                eb("e.entity_type", "like", like),
                eb("e.name", "like", like),
              ])
            )
            .orderBy("e.updated_at", "desc")
            .limit(5)
            .execute(),
        ]);

        return Response.json({
          audits: audits.map((audit) => ({
            id: audit.id,
            publicId: audit.public_id,
            name: audit.name,
          })),
          assessments: assessments.map((assessment) => ({
            id: assessment.id,
            auditId: assessment.audit_id,
            auditPublicId: assessment.audit_public_id,
            auditName: assessment.audit_name,
            entityType: assessment.entity_type,
            entityName: assessment.entity_name,
            status: assessment.status,
            reportShareHash: assessment.report_share_hash,
          })),
          entities: entities.map((entity) => ({
            id: entity.id,
            type: entity.entity_type,
            name: entity.name,
          })),
        });
      },
    },

    "/api/users": {
      async GET(req) {
        const { session, response } = await requireAdminSession(req);
        if (response) {
          return response;
        }

        const users = await db
          .selectFrom("user as u")
          .leftJoin("user_role as ur", "ur.user_id", "u.id")
          .select(["u.id", "u.name", "u.email", "ur.role"])
          .orderBy("u.name", "asc")
          .orderBy("u.email", "asc")
          .execute();

        return Response.json({
          users: users.map((user) => ({
            id: user.id,
            name: user.name,
            email: user.email,
            role:
              user.role === "admin"
                ? "admin"
                : user.role === "audit_manager"
                  ? "audit_manager"
                  : "user",
            gravatarUrl: createGravatarUrl(user.email),
          })),
        });
      },
    },

    "/api/users/:id/workspaces": {
      async GET(req) {
        const { response } = await requireAdminSession(req);
        if (response) {
          return response;
        }

        const userId = typeof req.params.id === "string" ? req.params.id.trim() : "";
        if (!userId) {
          return Response.json({ error: "Invalid user id." }, { status: 400 });
        }

        const user = await db
          .selectFrom("user")
          .select("id")
          .where("id", "=", userId)
          .executeTakeFirst();
        if (!user) {
          return Response.json({ error: "User not found." }, { status: 404 });
        }

        const memberships = await db
          .selectFrom("workspace_member as wm")
          .innerJoin("workspace as w", "w.id", "wm.workspace_id")
          .select(["w.id as workspace_id", "w.name as workspace_name", "wm.role", "wm.created_at"])
          .where("wm.user_id", "=", userId)
          .orderBy("w.name", "asc")
          .execute();

        return Response.json({
          workspaces: memberships.map((membership) => ({
            workspaceId: membership.workspace_id,
            workspaceName: membership.workspace_name,
            role: membership.role,
            assignedAt: membership.created_at,
          })),
        });
      },
    },

    "/api/users/:id/role": {
      async PATCH(req) {
        const { session, response } = await requireAdminSession(req);
        if (response) {
          return response;
        }

        const userId = typeof req.params.id === "string" ? req.params.id.trim() : "";
        if (!userId) {
          return Response.json({ error: "Invalid user id." }, { status: 400 });
        }

        const body = await req
          .json()
          .catch(() => ({} as { role?: string }));
        const role = typeof body.role === "string" ? body.role.trim() : "";
        if (role !== "admin" && role !== "audit_manager" && role !== "user") {
          return Response.json(
            { error: "Invalid role. Expected admin, audit_manager, or user." },
            { status: 400 }
          );
        }
        if (role !== "admin" && userId === session.user.id) {
          return Response.json({ error: "You cannot demote your own account." }, { status: 409 });
        }

        const targetUser = await db
          .selectFrom("user")
          .select("id")
          .where("id", "=", userId)
          .executeTakeFirst();
        if (!targetUser) {
          return Response.json({ error: "User not found." }, { status: 404 });
        }

        if (role !== "admin") {
          const targetRole = await getUserRole(userId);
          if (targetRole === "admin") {
            const adminCountRow = await db
              .selectFrom("user_role")
              .select((eb) => eb.fn.count<number>("user_id").as("count"))
              .where("role", "=", "admin")
              .executeTakeFirstOrThrow();

            const adminCount = Number(adminCountRow.count ?? 0);
            if (adminCount <= 1) {
              return Response.json({ error: "At least one admin must remain." }, { status: 409 });
            }
          }
        }

        await db
          .insertInto("user_role")
          .values({
            user_id: userId,
            role,
          })
          .onConflict((oc) =>
            oc.column("user_id").doUpdateSet({
              role,
              updated_at: sql<string>`datetime('now')`,
            })
          )
          .executeTakeFirst();

        return Response.json({ success: true });
      },
    },

    "/api/workspaces": {
      async GET(req) {
        const { session, response: authResponse } = await requireAuthSession(req);
        if (authResponse) {
          return authResponse;
        }

        const scope = new URL(req.url).searchParams.get("scope");
        const role = await getUserRole(session.user.id);
        const workspaces =
          scope === "member"
            ? await db
                .selectFrom("workspace as w")
                .innerJoin("workspace_member as wms", (join) =>
                  join
                    .onRef("wms.workspace_id", "=", "w.id")
                    .on("wms.user_id", "=", session.user.id)
                )
                .leftJoin("workspace_member as wm", "wm.workspace_id", "w.id")
                .leftJoin("workspace_entity as we", "we.workspace_id", "w.id")
                .leftJoin("workspace_audit as wa", "wa.workspace_id", "w.id")
                .select([
                  "w.id",
                  "w.name",
                  "w.created_at",
                  "w.updated_at",
                  sql<number>`count(distinct wm.user_id)`.as("member_count"),
                  sql<number>`count(distinct we.entity_id)`.as("entity_count"),
                  sql<number>`count(distinct wa.audit_id)`.as("audit_template_count"),
                ])
                .groupBy(["w.id", "w.name", "w.created_at", "w.updated_at"])
                .orderBy("w.name", "asc")
                .execute()
            : role === "admin" || role === "audit_manager"
            ? await db
                .selectFrom("workspace as w")
                .leftJoin("workspace_member as wm", "wm.workspace_id", "w.id")
                .leftJoin("workspace_entity as we", "we.workspace_id", "w.id")
                .leftJoin("workspace_audit as wa", "wa.workspace_id", "w.id")
                .select([
                  "w.id",
                  "w.name",
                  "w.created_at",
                  "w.updated_at",
                  sql<number>`count(distinct wm.user_id)`.as("member_count"),
                  sql<number>`count(distinct we.entity_id)`.as("entity_count"),
                  sql<number>`count(distinct wa.audit_id)`.as("audit_template_count"),
                ])
                .groupBy(["w.id", "w.name", "w.created_at", "w.updated_at"])
                .orderBy("w.name", "asc")
                .execute()
            : await db
                .selectFrom("workspace as w")
                .innerJoin("workspace_member as wms", (join) =>
                  join
                    .onRef("wms.workspace_id", "=", "w.id")
                    .on("wms.user_id", "=", session.user.id)
                )
                .leftJoin("workspace_member as wm", "wm.workspace_id", "w.id")
                .leftJoin("workspace_entity as we", "we.workspace_id", "w.id")
                .leftJoin("workspace_audit as wa", "wa.workspace_id", "w.id")
                .select([
                  "w.id",
                  "w.name",
                  "w.created_at",
                  "w.updated_at",
                  sql<number>`count(distinct wm.user_id)`.as("member_count"),
                  sql<number>`count(distinct we.entity_id)`.as("entity_count"),
                  sql<number>`count(distinct wa.audit_id)`.as("audit_template_count"),
                ])
                .groupBy(["w.id", "w.name", "w.created_at", "w.updated_at"])
                .orderBy("w.name", "asc")
                .execute();

        return Response.json({
          workspaces: workspaces.map((workspace) => ({
            id: workspace.id,
            name: workspace.name,
            memberCount: Number(workspace.member_count ?? 0),
            entityCount: Number(workspace.entity_count ?? 0),
            auditTemplateCount: Number(workspace.audit_template_count ?? 0),
            createdAt: workspace.created_at,
            updatedAt: workspace.updated_at,
          })),
        });
      },
      async POST(req) {
        const { session, response } = await requireAdminSession(req);
        if (response) {
          return response;
        }

        const body = await req
          .json()
          .catch(() => ({} as { name?: string }));
        const name = typeof body.name === "string" ? body.name.trim() : "";
        if (!name) {
          return Response.json({ error: "Workspace name is required." }, { status: 400 });
        }

        try {
          const workspace = await db
            .insertInto("workspace")
            .values({ name })
            .returningAll()
            .executeTakeFirstOrThrow();

          return Response.json({
            workspace: {
              id: workspace.id,
              name: workspace.name,
              memberCount: 0,
              entityCount: 0,
              auditTemplateCount: 0,
              createdAt: workspace.created_at,
              updatedAt: workspace.updated_at,
            },
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to create workspace.";
          if (message.includes("UNIQUE constraint failed: workspace.name")) {
            return Response.json({ error: "Workspace name already exists." }, { status: 409 });
          }
          return Response.json({ error: message }, { status: 400 });
        }
      },
    },

    "/api/workspaces/:id": {
      async GET(req) {
        const { session, response } = await requireAdminSession(req);
        if (response) {
          return response;
        }

        const workspaceId = Number(req.params.id);
        if (!Number.isFinite(workspaceId) || workspaceId <= 0) {
          return Response.json({ error: "Invalid workspace id." }, { status: 400 });
        }

        const workspace = await db
          .selectFrom("workspace")
          .selectAll()
          .where("id", "=", workspaceId)
          .executeTakeFirst();
        if (!workspace) {
          return Response.json({ error: "Workspace not found." }, { status: 404 });
        }

        const [allUsers, allEntities, allAudits, members, entities, audits] = await Promise.all([
          db
            .selectFrom("user")
            .select(["id", "name", "email"])
            .orderBy("name", "asc")
            .orderBy("email", "asc")
            .execute(),
          db
            .selectFrom("entity")
            .select(["id", "entity_type", "name"])
            .orderBy("entity_type", "asc")
            .orderBy("name", "asc")
            .execute(),
          db
            .selectFrom("audit")
            .select(["id", "name", "description"])
            .orderBy("name", "asc")
            .execute(),
          db
            .selectFrom("workspace_member as wm")
            .innerJoin("user as u", "u.id", "wm.user_id")
            .select([
              "wm.user_id",
              "wm.role",
              "wm.created_at",
              "u.name",
              "u.email",
            ])
            .where("wm.workspace_id", "=", workspaceId)
            .orderBy("u.name", "asc")
            .orderBy("u.email", "asc")
            .execute(),
          db
            .selectFrom("workspace_entity as we")
            .innerJoin("entity as e", "e.id", "we.entity_id")
            .select(["e.id as entity_id", "e.entity_type", "e.name", "we.created_at"])
            .where("we.workspace_id", "=", workspaceId)
            .orderBy("e.entity_type", "asc")
            .orderBy("e.name", "asc")
            .execute(),
          db
            .selectFrom("workspace_audit as wa")
            .innerJoin("audit as a", "a.id", "wa.audit_id")
            .select(["a.id as audit_id", "a.name", "a.description", "wa.created_at"])
            .where("wa.workspace_id", "=", workspaceId)
            .orderBy("a.name", "asc")
            .execute(),
        ]);

        const memberIds = new Set(members.map((member) => member.user_id));
        const linkedEntityIds = new Set(entities.map((entity) => entity.entity_id));
        const linkedAuditIds = new Set(audits.map((audit) => audit.audit_id));

        return Response.json({
          workspace: {
            id: workspace.id,
            name: workspace.name,
            createdAt: workspace.created_at,
            updatedAt: workspace.updated_at,
          },
          members: members.map((member) => ({
            userId: member.user_id,
            name: member.name,
            email: member.email,
            gravatarUrl: createGravatarUrl(member.email),
            role: member.role,
            createdAt: member.created_at,
          })),
          availableUsers: allUsers
            .filter((user) => !memberIds.has(user.id))
            .map((user) => ({
              id: user.id,
              name: user.name,
              email: user.email,
              gravatarUrl: createGravatarUrl(user.email),
            })),
          entities: entities.map((entity) => ({
            id: entity.entity_id,
            type: entity.entity_type,
            name: entity.name,
            linkedAt: entity.created_at,
          })),
          availableEntities: allEntities
            .filter((entity) => !linkedEntityIds.has(entity.id))
            .map((entity) => ({
              id: entity.id,
              type: entity.entity_type,
              name: entity.name,
            })),
          audits: audits.map((audit) => ({
            id: audit.audit_id,
            name: audit.name,
            description: audit.description,
            linkedAt: audit.created_at,
          })),
          availableAudits: allAudits
            .filter((audit) => !linkedAuditIds.has(audit.id))
            .map((audit) => ({
              id: audit.id,
              name: audit.name,
              description: audit.description,
            })),
        });
      },
      async PATCH(req) {
        const { response } = await requireAdminSession(req);
        if (response) {
          return response;
        }

        const workspaceId = Number(req.params.id);
        if (!Number.isFinite(workspaceId) || workspaceId <= 0) {
          return Response.json({ error: "Invalid workspace id." }, { status: 400 });
        }

        const body = (await req.json().catch(() => ({}))) as { name?: unknown };
        const name = typeof body.name === "string" ? body.name.trim() : "";
        if (!name) {
          return Response.json({ error: "Workspace name is required." }, { status: 400 });
        }

        try {
          const updated = await db
            .updateTable("workspace")
            .set({
              name,
              updated_at: sql<string>`datetime('now')`,
            })
            .where("id", "=", workspaceId)
            .returningAll()
            .executeTakeFirst();

          if (!updated) {
            return Response.json({ error: "Workspace not found." }, { status: 404 });
          }

          return Response.json({
            workspace: {
              id: updated.id,
              name: updated.name,
              createdAt: updated.created_at,
              updatedAt: updated.updated_at,
            },
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to update workspace.";
          if (message.includes("UNIQUE constraint failed: workspace.name")) {
            return Response.json({ error: "Workspace name already exists." }, { status: 409 });
          }
          return Response.json({ error: message }, { status: 400 });
        }
      },
    },

    "/api/workspaces/:id/members": {
      async POST(req) {
        const { session, response } = await requireAdminSession(req);
        if (response) {
          return response;
        }

        const workspaceId = Number(req.params.id);
        if (!Number.isFinite(workspaceId) || workspaceId <= 0) {
          return Response.json({ error: "Invalid workspace id." }, { status: 400 });
        }

        const body = await req
          .json()
          .catch(() => ({} as { userId?: string; role?: string }));
        const userId = typeof body.userId === "string" ? body.userId.trim() : "";
        const role = typeof body.role === "string" ? body.role.trim() : "workspace_manager";
        if (!userId) {
          return Response.json({ error: "User id is required." }, { status: 400 });
        }
        if (role !== "workspace_manager") {
          return Response.json({ error: "Unsupported workspace role." }, { status: 400 });
        }

        const [workspace, user, existing] = await Promise.all([
          db.selectFrom("workspace").select("id").where("id", "=", workspaceId).executeTakeFirst(),
          db.selectFrom("user").select("id").where("id", "=", userId).executeTakeFirst(),
          db
            .selectFrom("workspace_member")
            .select(["workspace_id", "user_id"])
            .where("workspace_id", "=", workspaceId)
            .where("user_id", "=", userId)
            .executeTakeFirst(),
        ]);

        if (!workspace) {
          return Response.json({ error: "Workspace not found." }, { status: 404 });
        }
        if (!user) {
          return Response.json({ error: "User not found." }, { status: 404 });
        }
        if (existing) {
          return Response.json({ error: "User is already a workspace member." }, { status: 409 });
        }

        await db
          .insertInto("workspace_member")
          .values({
            workspace_id: workspaceId,
            user_id: userId,
            role: "workspace_manager",
          })
          .executeTakeFirst();

        return Response.json({ success: true });
      },
    },

    "/api/workspaces/:id/members/:userId": {
      async DELETE(req) {
        const { session, response } = await requireAdminSession(req);
        if (response) {
          return response;
        }

        const workspaceId = Number(req.params.id);
        if (!Number.isFinite(workspaceId) || workspaceId <= 0) {
          return Response.json({ error: "Invalid workspace id." }, { status: 400 });
        }

        const userId = typeof req.params.userId === "string" ? req.params.userId.trim() : "";
        if (!userId) {
          return Response.json({ error: "Invalid user id." }, { status: 400 });
        }

        const result = await db
          .deleteFrom("workspace_member")
          .where("workspace_id", "=", workspaceId)
          .where("user_id", "=", userId)
          .executeTakeFirst();

        if (Number(result.numDeletedRows ?? 0) === 0) {
          return Response.json({ error: "Workspace member not found." }, { status: 404 });
        }

        return Response.json({ success: true });
      },
    },

    "/api/workspaces/:id/entities/:entityId": {
      async DELETE(req) {
        const { response } = await requireAdminSession(req);
        if (response) {
          return response;
        }

        const workspaceId = Number(req.params.id);
        if (!Number.isFinite(workspaceId) || workspaceId <= 0) {
          return Response.json({ error: "Invalid workspace id." }, { status: 400 });
        }

        const entityId = Number(req.params.entityId);
        if (!Number.isFinite(entityId) || entityId <= 0) {
          return Response.json({ error: "Invalid entity id." }, { status: 400 });
        }

        const result = await db
          .deleteFrom("workspace_entity")
          .where("workspace_id", "=", workspaceId)
          .where("entity_id", "=", entityId)
          .executeTakeFirst();

        if (Number(result.numDeletedRows ?? 0) === 0) {
          return Response.json({ error: "Workspace entity link not found." }, { status: 404 });
        }

        return Response.json({ success: true });
      },
    },

    "/api/workspaces/:id/entities/bulk": {
      async POST(req) {
        const { session, response } = await requireAuditManagerSession(req);
        if (response) {
          return response;
        }

        const workspaceId = Number(req.params.id);
        if (!Number.isFinite(workspaceId) || workspaceId <= 0) {
          return Response.json({ error: "Invalid workspace id." }, { status: 400 });
        }

        const body = (await req
          .json()
          .catch(() => ({}))) as { entityIds?: unknown };
        const entityIdsRaw: unknown[] = Array.isArray(body.entityIds) ? body.entityIds : [];
        const normalizedIds: number[] = Array.from(
          new Set(
            entityIdsRaw
              .map((value) => Number(value))
              .filter((id): id is number => Number.isFinite(id) && id > 0)
          )
        );
        if (normalizedIds.length === 0) {
          return Response.json({ error: "entityIds must contain at least one valid id." }, { status: 400 });
        }

        const workspace = await db
          .selectFrom("workspace")
          .select("id")
          .where("id", "=", workspaceId)
          .executeTakeFirst();

        if (!workspace) {
          return Response.json({ error: "Workspace not found." }, { status: 404 });
        }

        const [existingEntities, alreadyLinkedRows] = await Promise.all([
          db
            .selectFrom("entity")
            .select("id")
            .where("id", "in", normalizedIds)
            .execute(),
          db
            .selectFrom("workspace_entity")
            .select("entity_id")
            .where("workspace_id", "=", workspaceId)
            .where("entity_id", "in", normalizedIds)
            .execute(),
        ]);

        const existingEntityIds = new Set<number>(existingEntities.map((row) => row.id));
        const alreadyLinkedIds = new Set<number>(
          alreadyLinkedRows
            .map((row) => row.entity_id)
            .filter((entityId): entityId is number => typeof entityId === "number")
        );
        const insertIds = normalizedIds.filter((id) => existingEntityIds.has(id) && !alreadyLinkedIds.has(id));

        if (insertIds.length > 0) {
          await db
            .insertInto("workspace_entity")
            .values(insertIds.map((entityId) => ({ workspace_id: workspaceId, entity_id: entityId })))
            .onConflict((oc) => oc.columns(["workspace_id", "entity_id"]).doNothing())
            .executeTakeFirst();
        }

        const validCount = normalizedIds.filter((id) => existingEntityIds.has(id)).length;
        return Response.json({
          summary: {
            requested: normalizedIds.length,
            valid: validCount,
            assigned: insertIds.length,
            alreadyLinked: alreadyLinkedIds.size,
            invalid: normalizedIds.length - validCount,
          },
        });
      },
    },

    "/api/workspaces/:id/audits/bulk": {
      async POST(req) {
        const { response } = await requireAuditManagerSession(req);
        if (response) {
          return response;
        }

        const workspaceId = Number(req.params.id);
        if (!Number.isFinite(workspaceId) || workspaceId <= 0) {
          return Response.json({ error: "Invalid workspace id." }, { status: 400 });
        }

        const body = (await req
          .json()
          .catch(() => ({}))) as { auditIds?: unknown };
        const auditIdsRaw: unknown[] = Array.isArray(body.auditIds) ? body.auditIds : [];
        const normalizedIds: number[] = Array.from(
          new Set(
            auditIdsRaw
              .map((value) => Number(value))
              .filter((id): id is number => Number.isFinite(id) && id > 0)
          )
        );
        if (normalizedIds.length === 0) {
          return Response.json({ error: "auditIds must contain at least one valid id." }, { status: 400 });
        }

        const workspace = await db
          .selectFrom("workspace")
          .select("id")
          .where("id", "=", workspaceId)
          .executeTakeFirst();

        if (!workspace) {
          return Response.json({ error: "Workspace not found." }, { status: 404 });
        }

        const [existingAudits, alreadyLinkedRows] = await Promise.all([
          db
            .selectFrom("audit")
            .select("id")
            .where("id", "in", normalizedIds)
            .execute(),
          db
            .selectFrom("workspace_audit")
            .select("audit_id")
            .where("workspace_id", "=", workspaceId)
            .where("audit_id", "in", normalizedIds)
            .execute(),
        ]);

        const existingAuditIds = new Set<number>(existingAudits.map((row) => row.id));
        const alreadyLinkedIds = new Set<number>(
          alreadyLinkedRows
            .map((row) => row.audit_id)
            .filter((auditId): auditId is number => typeof auditId === "number")
        );
        const insertIds = normalizedIds.filter((id) => existingAuditIds.has(id) && !alreadyLinkedIds.has(id));

        if (insertIds.length > 0) {
          await db
            .insertInto("workspace_audit")
            .values(insertIds.map((auditId) => ({ workspace_id: workspaceId, audit_id: auditId })))
            .onConflict((oc) => oc.columns(["workspace_id", "audit_id"]).doNothing())
            .executeTakeFirst();
        }

        const validCount = normalizedIds.filter((id) => existingAuditIds.has(id)).length;
        return Response.json({
          summary: {
            requested: normalizedIds.length,
            valid: validCount,
            assigned: insertIds.length,
            alreadyLinked: alreadyLinkedIds.size,
            invalid: normalizedIds.length - validCount,
          },
        });
      },
    },

    "/api/workspaces/:id/audits/:auditId": {
      async DELETE(req) {
        const { response } = await requireAuditManagerSession(req);
        if (response) {
          return response;
        }

        const workspaceId = Number(req.params.id);
        if (!Number.isFinite(workspaceId) || workspaceId <= 0) {
          return Response.json({ error: "Invalid workspace id." }, { status: 400 });
        }

        const auditId = Number(req.params.auditId);
        if (!Number.isFinite(auditId) || auditId <= 0) {
          return Response.json({ error: "Invalid audit id." }, { status: 400 });
        }

        const result = await db
          .deleteFrom("workspace_audit")
          .where("workspace_id", "=", workspaceId)
          .where("audit_id", "=", auditId)
          .executeTakeFirst();

        if (Number(result.numDeletedRows ?? 0) === 0) {
          return Response.json({ error: "Workspace audit link not found." }, { status: 404 });
        }

        return Response.json({ success: true });
      },
    },

    "/api/entities": {
      async GET(req) {
        const { session, response: authResponse } = await requireAuthSession(req);
        if (authResponse) {
          return authResponse;
        }

        const workspaceId = parseWorkspaceIdFromRequest(req);
        if (workspaceId) {
          const { response: workspaceResponse } = await requireWorkspaceAccess(req, session);
          if (workspaceResponse) {
            return workspaceResponse;
          }

          const entities = await db
            .selectFrom("entity as e")
            .innerJoin("workspace_entity as we", "we.entity_id", "e.id")
            .leftJoin("workspace_entity as we_all", "we_all.entity_id", "e.id")
            .leftJoin("assessment as s", "s.entity_id", "e.id")
            .select([
              "e.id",
              "e.entity_type",
              "e.name",
              "e.description",
              "e.created_at",
              "e.updated_at",
              sql<number>`count(distinct s.id)`.as("assessment_count"),
              sql<number>`count(distinct we_all.workspace_id)`.as("workspace_count"),
            ])
            .where("we.workspace_id", "=", workspaceId)
            .groupBy([
              "e.id",
              "e.entity_type",
              "e.name",
              "e.description",
              "e.created_at",
              "e.updated_at",
            ])
            .orderBy("e.entity_type", "asc")
            .orderBy("e.name", "asc")
            .execute();

          return Response.json({
            entities: entities.map((entity) => ({
              id: entity.id,
              type: entity.entity_type,
              name: entity.name,
              description: entity.description,
              updatedAt: entity.updated_at,
              assessmentsCount: Number(entity.assessment_count ?? 0),
              workspacesCount: Number(entity.workspace_count ?? 0),
            })),
          });
        }

        const { response } = await requireAuditManagerSession(req);
        if (response) {
          return response;
        }

        const entities = await db
          .selectFrom("entity as e")
          .leftJoin("workspace_entity as we", "we.entity_id", "e.id")
          .leftJoin("assessment as s", "s.entity_id", "e.id")
          .select([
            "e.id",
            "e.entity_type",
            "e.name",
            "e.description",
            "e.created_at",
            "e.updated_at",
            sql<number>`count(distinct s.id)`.as("assessment_count"),
            sql<number>`count(distinct we.workspace_id)`.as("workspace_count"),
          ])
          .groupBy([
            "e.id",
            "e.entity_type",
            "e.name",
            "e.description",
            "e.created_at",
            "e.updated_at",
          ])
          .orderBy("e.entity_type", "asc")
          .orderBy("e.name", "asc")
          .execute();
        return Response.json({
          entities: entities.map((entity) => ({
            id: entity.id,
            type: entity.entity_type,
            name: entity.name,
            description: entity.description,
            updatedAt: entity.updated_at,
            assessmentsCount: Number(entity.assessment_count ?? 0),
            workspacesCount: Number(entity.workspace_count ?? 0),
          })),
        });
      },
      async POST(req) {
        const { session, response } = await requireAuditManagerSession(req);
        if (response) {
          return response;
        }

        const body = await req
          .json()
          .catch(() => ({} as { type?: string; name?: string; description?: string }));
        const type = typeof body.type === "string" ? body.type.trim() : "";
        const name = typeof body.name === "string" ? body.name.trim() : "";
        if (!type) {
          return Response.json(
            { error: "Entity type is required." },
            { status: 400 }
          );
        }
        if (!name) {
          return Response.json(
            { error: "Entity name is required." },
            { status: 400 }
          );
        }

        try {
          const entity = await repositories.entity.create({
            type,
            name,
            description: typeof body.description === "string" ? body.description.trim() : "",
          });
          return Response.json({
            entity: {
              id: entity.id,
              type: entity.entity_type,
              name: entity.name,
              description: entity.description,
              updatedAt: entity.updated_at,
            },
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to create entity.";
          if (
            message.includes("UNIQUE constraint failed: entity.name") ||
            message.includes("UNIQUE constraint failed: entity.entity_type, entity.name")
          ) {
            return Response.json(
              { error: "Entity type/name pair already exists." },
              { status: 409 }
            );
          }
          return Response.json({ error: message }, { status: 400 });
        }
      },
    },
    "/api/entities/import": {
      async POST(req) {
        const { response } = await requireAuditManagerSession(req);
        if (response) {
          return response;
        }

        let csvText = "";
        const contentType = req.headers.get("content-type") ?? "";
        if (contentType.includes("multipart/form-data")) {
          const formData = await req.formData().catch(() => null);
          const file = formData?.get("file");
          if (file && file instanceof File) {
            csvText = await file.text();
          }
        } else {
          const body = (await req.json().catch(() => ({}))) as { csv?: unknown };
          if (typeof body.csv === "string") {
            csvText = body.csv;
          }
        }

        if (!csvText.trim()) {
          return Response.json({ error: "CSV file is required." }, { status: 400 });
        }

        const { rows, errors: parseErrors } = parseEntitiesCsv(csvText);
        if (parseErrors.length > 0) {
          return Response.json({ error: "CSV validation failed.", errors: parseErrors }, { status: 400 });
        }

        let created = 0;
        let duplicates = 0;
        const importErrors: string[] = [];

        for (const row of rows) {
          try {
            await repositories.entity.create({
              type: row.type,
              name: row.name,
              description: row.description,
            });
            created += 1;
          } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to import entity.";
            if (
              message.includes("UNIQUE constraint failed: entity.name") ||
              message.includes("UNIQUE constraint failed: entity.entity_type, entity.name")
            ) {
              duplicates += 1;
              continue;
            }
            importErrors.push(`${row.type}/${row.name}: ${message}`);
          }
        }

        const status = importErrors.length > 0 ? 400 : 200;
        return Response.json(
          {
            summary: {
              requested: rows.length,
              created,
              duplicates,
              failed: importErrors.length,
            },
            errors: importErrors,
          },
          { status }
        );
      },
    },
    "/api/entities/import/preview": {
      async POST(req) {
        const { response } = await requireAuditManagerSession(req);
        if (response) {
          return response;
        }

        let csvText = "";
        const contentType = req.headers.get("content-type") ?? "";
        if (contentType.includes("multipart/form-data")) {
          const formData = await req.formData().catch(() => null);
          const file = formData?.get("file");
          if (file && file instanceof File) {
            csvText = await file.text();
          }
        } else {
          const body = (await req.json().catch(() => ({}))) as { csv?: unknown };
          if (typeof body.csv === "string") {
            csvText = body.csv;
          }
        }

        if (!csvText.trim()) {
          return Response.json({ error: "CSV content is required." }, { status: 400 });
        }

        const { rows, errors } = parseEntitiesCsv(csvText);
        if (errors.length > 0) {
          return Response.json({ error: "CSV validation failed.", errors }, { status: 400 });
        }

        const allEntities = await db
          .selectFrom("entity")
          .select(["id", "entity_type", "name"])
          .execute();
        const entityKeyToId = new Map<string, number>();
        for (const entity of allEntities) {
          entityKeyToId.set(`${entity.entity_type}::${entity.name}`, entity.id);
        }

        return Response.json({
          rows: rows.map((row, index) => {
            const existingId = entityKeyToId.get(`${row.type}::${row.name}`);
            const exists = typeof existingId === "number";
            return {
              rowNo: index + 1,
              type: row.type,
              name: row.name,
              description: row.description,
              exists,
              existingEntityId: exists ? existingId : null,
              action: exists ? "skip" : "import",
            };
          }),
        });
      },
    },
    "/api/entities/import/rows": {
      async POST(req) {
        const { response } = await requireAuditManagerSession(req);
        if (response) {
          return response;
        }

        const body = (await req.json().catch(() => ({}))) as {
          rows?: Array<{ type?: unknown; name?: unknown; description?: unknown }>;
        };
        const inputRows = Array.isArray(body.rows) ? body.rows : [];
        if (inputRows.length === 0) {
          return Response.json({ error: "rows payload is required." }, { status: 400 });
        }

        const rows = inputRows
          .map((row) => ({
            type: typeof row.type === "string" ? row.type.trim() : "",
            name: typeof row.name === "string" ? row.name.trim() : "",
            description: typeof row.description === "string" ? row.description.trim() : "",
          }))
          .filter((row) => row.type && row.name);

        if (rows.length === 0) {
          return Response.json({ error: "No valid rows to import." }, { status: 400 });
        }

        let created = 0;
        let duplicates = 0;
        const errors: string[] = [];
        for (const row of rows) {
          try {
            await repositories.entity.create({
              type: row.type,
              name: row.name,
              description: row.description,
            });
            created += 1;
          } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to import entity.";
            if (
              message.includes("UNIQUE constraint failed: entity.name") ||
              message.includes("UNIQUE constraint failed: entity.entity_type, entity.name")
            ) {
              duplicates += 1;
              continue;
            }
            errors.push(`${row.type}/${row.name}: ${message}`);
          }
        }

        const status = errors.length > 0 ? 400 : 200;
        return Response.json(
          {
            summary: {
              requested: rows.length,
              created,
              duplicates,
              failed: errors.length,
            },
            errors,
          },
          { status }
        );
      },
    },
    "/api/entities/:id": {
      async GET(req) {
        const { session, response } = await requireAuditManagerSession(req);
        if (response) {
          return response;
        }

        const id = Number(req.params.id);
        if (!Number.isFinite(id) || id <= 0) {
          return Response.json({ error: "Invalid entity id." }, { status: 400 });
        }

        const entity = await repositories.entity.getById(id);
        if (!entity) {
          return Response.json({ error: "Entity not found." }, { status: 404 });
        }

        return Response.json({
          entity: {
            id: entity.id,
            type: entity.entity_type,
            name: entity.name,
            description: entity.description,
            updatedAt: entity.updated_at,
          },
        });
      },
      async PATCH(req) {
        const { session, response } = await requireAuditManagerSession(req);
        if (response) {
          return response;
        }

        const id = Number(req.params.id);
        if (!Number.isFinite(id) || id <= 0) {
          return Response.json({ error: "Invalid entity id." }, { status: 400 });
        }

        const body = await req
          .json()
          .catch(() => ({} as { type?: string; name?: string; description?: string }));

        const hasType = typeof body.type === "string";
        const hasName = typeof body.name === "string";
        const hasDescription = typeof body.description === "string";
        if (!hasType && !hasName && !hasDescription) {
          return Response.json({ error: "No valid fields to update." }, { status: 400 });
        }

        const type = hasType ? body.type!.trim() : undefined;
        const name = hasName ? body.name!.trim() : undefined;
        const description = hasDescription ? body.description! : undefined;

        if (hasType && !type) {
          return Response.json({ error: "Entity type is required." }, { status: 400 });
        }
        if (hasName && !name) {
          return Response.json({ error: "Entity name is required." }, { status: 400 });
        }

        try {
          const updated = await repositories.entity.update(id, {
            type,
            name,
            description,
          });
          if (!updated) {
            return Response.json({ error: "Entity not found." }, { status: 404 });
          }

          return Response.json({
            entity: {
              id: updated.id,
              type: updated.entity_type,
              name: updated.name,
              description: updated.description,
              updatedAt: updated.updated_at,
            },
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to update entity.";
          if (
            message.includes("UNIQUE constraint failed: entity.name") ||
            message.includes("UNIQUE constraint failed: entity.entity_type, entity.name")
          ) {
            return Response.json(
              { error: "Entity type/name pair already exists." },
              { status: 409 }
            );
          }
          return Response.json({ error: message }, { status: 400 });
        }
      },
      async DELETE(req) {
        const { response } = await requireAuditManagerSession(req);
        if (response) {
          return response;
        }

        const id = Number(req.params.id);
        if (!Number.isFinite(id) || id <= 0) {
          return Response.json({ error: "Invalid entity id." }, { status: 400 });
        }

        const [entity, assessmentCountRow] = await Promise.all([
          db.selectFrom("entity").select("id").where("id", "=", id).executeTakeFirst(),
          db
            .selectFrom("assessment")
            .select((eb) => eb.fn.count<number>("id").as("count"))
            .where("entity_id", "=", id)
            .executeTakeFirstOrThrow(),
        ]);

        if (!entity) {
          return Response.json({ error: "Entity not found." }, { status: 404 });
        }

        const assessmentCount = Number(assessmentCountRow.count ?? 0);
        if (assessmentCount > 0) {
          return Response.json(
            { error: "Entity has assessments and cannot be deleted." },
            { status: 409 }
          );
        }

        await db.deleteFrom("entity").where("id", "=", id).executeTakeFirst();
        return Response.json({ success: true });
      },
    },

    "/api/assessments": {
      async GET(req) {
        const { session, response: authResponse } = await requireAuthSession(req);
        if (authResponse) {
          return authResponse;
        }

        const { workspaceId, response: workspaceResponse } = await requireWorkspaceAccess(req, session);
        if (workspaceResponse) {
          return workspaceResponse;
        }
        if (!workspaceId) {
          return Response.json({ error: "workspaceId query parameter is required." }, { status: 400 });
        }

        const assessments = await repositories.assessment.list(workspaceId);
        return Response.json({ assessments });
      },
      async POST(req) {
        const { session, response: authResponse } = await requireAuthSession(req);
        if (authResponse) {
          return authResponse;
        }

        const body = await req
          .json()
          .catch(() => ({} as { auditId?: unknown; auditVersionId?: unknown; entityId?: unknown; workspaceId?: unknown }));

        const auditId =
          body.auditId !== undefined && body.auditId !== null
            ? Number(body.auditId)
            : undefined;
        const auditVersionId =
          body.auditVersionId !== undefined && body.auditVersionId !== null
            ? Number(body.auditVersionId)
            : undefined;
        const entityId = Number(body.entityId);
        const workspaceId = Number(body.workspaceId);

        if (
          !Number.isFinite(entityId) ||
          entityId <= 0 ||
          !Number.isFinite(workspaceId) ||
          workspaceId <= 0 ||
          (auditId !== undefined && (!Number.isFinite(auditId) || auditId <= 0)) ||
          (auditVersionId !== undefined &&
            (!Number.isFinite(auditVersionId) || auditVersionId <= 0))
        ) {
          return Response.json(
            { error: "Invalid assessment creation payload." },
            { status: 400 }
          );
        }

        const { response: workspaceResponse } = await requireWorkspaceAccess(
          new Request(`${req.url}${req.url.includes("?") ? "&" : "?"}workspaceId=${workspaceId}`),
          session
        );
        if (workspaceResponse) {
          return workspaceResponse;
        }

        const linkedEntity = await db
          .selectFrom("workspace_entity")
          .select(["workspace_id", "entity_id"])
          .where("workspace_id", "=", workspaceId)
          .where("entity_id", "=", entityId)
          .executeTakeFirst();
        if (!linkedEntity) {
          return Response.json({ error: "Entity is not linked to selected workspace." }, { status: 403 });
        }

        const resolvedAuditId =
          auditId !== undefined
            ? auditId
            : auditVersionId !== undefined
              ? await db
                  .selectFrom("audit_version")
                  .select("audit_id")
                  .where("id", "=", auditVersionId)
                  .executeTakeFirst()
                  .then((row) => row?.audit_id)
              : undefined;
        if (!resolvedAuditId) {
          return Response.json({ error: "Published audit version not found." }, { status: 404 });
        }

        const linkedAudit = await db
          .selectFrom("workspace_audit")
          .select(["workspace_id", "audit_id"])
          .where("workspace_id", "=", workspaceId)
          .where("audit_id", "=", resolvedAuditId)
          .executeTakeFirst();
        if (!linkedAudit) {
          return Response.json({ error: "Audit is not linked to selected workspace." }, { status: 403 });
        }

        try {
          const created = await repositories.assessment.createDraft({
            auditId,
            auditVersionId,
            entityId,
            workspaceId,
            createdByUserId: session.user.id,
          });
          return Response.json({
            assessment: {
              id: created.id,
              auditId: created.audit_id,
              auditVersionId: created.audit_version_id,
              entityId: created.entity_id,
              status: created.status,
              reportShareHash: created.report_share_hash,
              createdAt: created.created_at,
              updatedAt: created.updated_at,
            },
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to create assessment.";
          const status =
            message === "Entity not found." || message === "Published audit version not found."
              ? 404
              : 400;
          return Response.json({ error: message }, { status });
        }
      },
    },

    "/api/assessments/:id": {
      async GET(req) {
        const { session, response: authResponse } = await requireAuthSession(req);
        if (authResponse) {
          return authResponse;
        }

        const { workspaceId, response: workspaceResponse } = await requireWorkspaceAccess(req, session);
        if (workspaceResponse) {
          return workspaceResponse;
        }
        if (!workspaceId) {
          return Response.json({ error: "workspaceId query parameter is required." }, { status: 400 });
        }

        const assessmentId = Number(req.params.id);
        if (!Number.isFinite(assessmentId) || assessmentId <= 0) {
          return Response.json(
            { error: "Invalid assessment id." },
            { status: 400 }
          );
        }

        const assessment = await repositories.assessment.getById(assessmentId);
        if (!assessment) {
          return Response.json(
            { error: "Assessment not found." },
            { status: 404 }
          );
        }

        const isVisible = await assessmentVisibleInWorkspace(assessmentId, workspaceId);
        if (!isVisible) {
          return Response.json({ error: "Assessment not found." }, { status: 404 });
        }

        return Response.json({ assessment });
      },
    },

    // Public routes
    "/api/share/:auditPublicId/:reportShareHash": {
      async GET(req) {
        const auditPublicId = typeof req.params.auditPublicId === "string" ? req.params.auditPublicId.trim() : "";
        const reportShareHash = typeof req.params.reportShareHash === "string" ? req.params.reportShareHash.trim() : "";
        if (!auditPublicId || !reportShareHash) {
          return Response.json(
            { error: "Invalid share link." },
            { status: 400 }
          );
        }

        const assessment = await repositories.assessment.getShareReportByLink(auditPublicId, reportShareHash);
        if (!assessment) {
          return Response.json(
            { error: "Shared report not found." },
            { status: 404 }
          );
        }

        return Response.json({ assessment });
      },
    },

    "/api/assessments/:id/answers/:itemId": {
      async PUT(req) {
        const { session, response: authResponse } = await requireAuthSession(req);
        if (authResponse) {
          return authResponse;
        }

        const { workspaceId, response: workspaceResponse } = await requireWorkspaceAccess(req, session);
        if (workspaceResponse) {
          return workspaceResponse;
        }
        if (!workspaceId) {
          return Response.json({ error: "workspaceId query parameter is required." }, { status: 400 });
        }

        const assessmentId = Number(req.params.id);
        const itemId = Number(req.params.itemId);
        if (
          !Number.isFinite(assessmentId) ||
          assessmentId <= 0 ||
          !Number.isFinite(itemId) ||
          itemId <= 0
        ) {
          return Response.json(
            { error: "Invalid assessment answer target." },
            { status: 400 }
          );
        }

        const isVisible = await assessmentVisibleInWorkspace(assessmentId, workspaceId);
        if (!isVisible) {
          return Response.json({ error: "Assessment not found." }, { status: 404 });
        }

        const body = await req
          .json()
          .catch(() => ({} as { response?: string; note?: string }));
        const response = typeof body.response === "string" ? body.response : "none";
        const note = typeof body.note === "string" ? body.note : "";
        if (!["pass", "fail", "partial", "na", "none"].includes(response)) {
          return Response.json(
            { error: "Invalid response value." },
            { status: 400 }
          );
        }

        try {
          await repositories.assessment.saveAnswer({
            assessmentId,
            itemId,
            response: response as "pass" | "fail" | "partial" | "na" | "none",
            note,
            userId: session.user.id,
          });
          return Response.json({ success: true });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to save answer.";
          const status =
            message === "Assessment not found."
              ? 404
              : message === "Submitted assessments are read-only."
                ? 409
                : 400;
          return Response.json({ error: message }, { status });
        }
      },
    },

    "/api/assessments/:id/submit": {
      async POST(req) {
        const { session, response: authResponse } = await requireAuthSession(req);
        if (authResponse) {
          return authResponse;
        }

        const { workspaceId, response: workspaceResponse } = await requireWorkspaceAccess(req, session);
        if (workspaceResponse) {
          return workspaceResponse;
        }
        if (!workspaceId) {
          return Response.json({ error: "workspaceId query parameter is required." }, { status: 400 });
        }

        const assessmentId = Number(req.params.id);
        if (!Number.isFinite(assessmentId) || assessmentId <= 0) {
          return Response.json(
            { error: "Invalid assessment id." },
            { status: 400 }
          );
        }

        const isVisible = await assessmentVisibleInWorkspace(assessmentId, workspaceId);
        if (!isVisible) {
          return Response.json({ error: "Assessment not found." }, { status: 404 });
        }

        try {
          const submitted = await repositories.assessment.submit(assessmentId, session.user.id);
          const assessment = await repositories.assessment.getById(submitted.id);
          if (!assessment) {
            return Response.json(
              { error: "Assessment not found after submit." },
              { status: 404 }
            );
          }

          return Response.json({
            assessment: {
              id: submitted.id,
              auditId: submitted.audit_id,
              auditVersionId: submitted.audit_version_id,
              entityId: submitted.entity_id,
              status: submitted.status,
              reportShareHash: submitted.report_share_hash,
              score: assessment.score,
              submittedAt: submitted.submitted_at,
              updatedAt: submitted.updated_at,
            },
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to submit assessment.";
          const status = message === "Assessment not found." ? 404 : 400;
          return Response.json({ error: message }, { status });
        }
      },
    },

    "/api/audits": {
      async GET(req) {
        const workspaceId = parseWorkspaceIdFromRequest(req);
        if (workspaceId) {
          const { session, response: authResponse } = await requireAuthSession(req);
          if (authResponse) {
            return authResponse;
          }
          const { response: workspaceResponse } = await requireWorkspaceAccess(req, session);
          if (workspaceResponse) {
            return workspaceResponse;
          }

          const audits = await repositories.audit.list();
          const linkedRows = await db
            .selectFrom("workspace_audit")
            .select("audit_id")
            .where("workspace_id", "=", workspaceId)
            .execute();
          const linkedAuditIds = new Set(linkedRows.map((row) => row.audit_id));
          return Response.json({ audits: audits.filter((audit) => linkedAuditIds.has(audit.id)) });
        }

        const { response } = await requireAuditManagerSession(req);
        if (response) {
          return response;
        }

        const audits = await repositories.audit.list();
        return Response.json({ audits });
      },
      async POST(req) {
        const { session, response } = await requireAuditManagerSession(req);
        if (response) {
          return response;
        }

        const body = await req
          .json()
          .catch(() => ({} as { name?: string; description?: string }));

        const created = await repositories.audit.createDraft({
          name: typeof body.name === "string" ? body.name : undefined,
          description: typeof body.description === "string" ? body.description : undefined,
        });

        return Response.json({
          audit: {
            id: created.id,
            publicId: created.public_id,
            name: created.name,
            description: created.description,
            version: 0,
            updatedAt: created.updated_at,
          },
        });
      },
    },
    "/api/audits/import": {
      async POST(req) {
        const importId = crypto.randomUUID().slice(0, 8);
        const startedAt = Date.now();
        const { session, response } = await requireAuditManagerSession(req);
        if (response) {
          logAuditImport(importId, "unauthorized_or_forbidden");
          return response;
        }

        logAuditImport(importId, "request.received", {
          userId: session.user.id,
          method: "POST",
          path: "/api/audits/import",
        });

        const body = await req
          .json()
          .catch(() => ({} as { input?: string }));

        const input = typeof body.input === "string" ? body.input.trim() : "";
        logAuditImport(importId, "request.parsed", {
          inputLength: input.length,
          inputPreview: input.slice(0, 120),
        });

        if (input.length < 20) {
          logAuditImport(importId, "request.invalid", { reason: "input_too_short" });
          return Response.json(
            { error: "Encountered error during import." },
            { status: 400 }
          );
        }

        try {
          logAuditImport(importId, "ai.start");
          const structured = await buildAuditFromText(input);
          const criterionCount = structured.dimensions.reduce(
            (total, dimension) => total + dimension.criteria.length,
            0
          );
          const itemCount = structured.dimensions.reduce(
            (total, dimension) =>
              total +
              dimension.criteria.reduce((criterionTotal, criterion) => criterionTotal + criterion.items.length, 0),
            0
          );
          logAuditImport(importId, "ai.done", {
            name: structured.name,
            dimensions: structured.dimensions.length,
            criteria: criterionCount,
            items: itemCount,
          });

          logAuditImport(importId, "db.create.start");
          const created = await repositories.audit.createFromImportedStructure({
            name: structured.name.trim(),
            description: structured.description.trim(),
            dimensions: structured.dimensions.map((dimension) => ({
              name: dimension.name.trim(),
              criteria: dimension.criteria.map((criterion) => ({
                name: criterion.name.trim(),
                description: criterion.description.trim(),
                items: criterion.items.map((item) => ({ name: item.name.trim() })),
              })),
            })),
          });
          logAuditImport(importId, "db.create.done", {
            auditId: created.id,
            publicId: created.public_id,
            durationMs: Date.now() - startedAt,
          });

          return Response.json({
            audit: {
              id: created.id,
              publicId: created.public_id,
              name: created.name,
              description: created.description,
            },
          });
        } catch (error) {
          console.error(`[audit-import:${importId}] failed`, {
            durationMs: Date.now() - startedAt,
            error,
          });
          return Response.json({ error: "Encountered error during import." }, { status: 400 });
        }
      },
    },

    "/api/audits/:id": {
      async GET(req) {
        const { session, response } = await requireAuditManagerSession(req);
        if (response) {
          return response;
        }

        const id = Number(req.params.id);
        if (!Number.isFinite(id) || id <= 0) {
          return Response.json(
            { error: "Invalid audit id." },
            { status: 400 }
          );
        }

        const audit = await repositories.audit.getManagementById(id);
        if (!audit) {
          return Response.json(
            { error: "Audit not found." },
            { status: 404 }
          );
        }

        return Response.json({ audit });
      },
      async PATCH(req) {
        const { session, response } = await requireAuditManagerSession(req);
        if (response) {
          return response;
        }

        const id = Number(req.params.id);
        if (!Number.isFinite(id) || id <= 0) {
          return Response.json(
            { error: "Invalid audit id." },
            { status: 400 }
          );
        }

        const body = await req
          .json()
          .catch(() => ({} as { publicId?: string; name?: string; description?: string }));

        const hasPublicId = typeof body.publicId === "string" && body.publicId.trim().length > 0;
        const hasName = typeof body.name === "string";
        const hasDescription = typeof body.description === "string";
        if (!hasPublicId && !hasName && !hasDescription) {
          return Response.json(
            { error: "No valid fields to update." },
            { status: 400 }
          );
        }

        let updated;
        try {
          updated = await repositories.audit.update(id, {
            publicId: hasPublicId ? body.publicId?.trim() : undefined,
            name: hasName ? body.name : undefined,
            description: hasDescription ? body.description : undefined,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "";
          if (message.includes("UNIQUE constraint failed: audit.public_id")) {
            return Response.json(
              { error: "Public ID already exists." },
              { status: 409 }
            );
          }
          throw error;
        }

        if (!updated) {
          return Response.json(
            { error: "Audit not found." },
            { status: 404 }
          );
        }

        return Response.json({
          audit: {
            id: updated.id,
            publicId: updated.public_id,
            name: updated.name,
            description: updated.description,
            updatedAt: updated.updated_at,
          },
        });
      },
      async DELETE(req) {
        const { response } = await requireAuditManagerSession(req);
        if (response) {
          return response;
        }

        const id = Number(req.params.id);
        if (!Number.isFinite(id) || id <= 0) {
          return Response.json({ error: "Invalid audit id." }, { status: 400 });
        }

        const audit = await db
          .selectFrom("audit")
          .select(["id", "name"])
          .where("id", "=", id)
          .executeTakeFirst();

        if (!audit) {
          return Response.json({ error: "Audit not found." }, { status: 404 });
        }

        await db.transaction().execute(async (trx) => {
          await trx.deleteFrom("assessment").where("audit_id", "=", id).executeTakeFirst();
          await trx.deleteFrom("audit").where("id", "=", id).executeTakeFirst();
        });

        return Response.json({ success: true });
      },
    },

    "/api/audits/:id/delete-summary": {
      async GET(req) {
        const { response } = await requireAuditManagerSession(req);
        if (response) {
          return response;
        }

        const id = Number(req.params.id);
        if (!Number.isFinite(id) || id <= 0) {
          return Response.json({ error: "Invalid audit id." }, { status: 400 });
        }

        const audit = await db
          .selectFrom("audit")
          .select(["id", "name", "public_id"])
          .where("id", "=", id)
          .executeTakeFirst();
        if (!audit) {
          return Response.json({ error: "Audit not found." }, { status: 404 });
        }

        const [
          dimensionCountRow,
          criterionCountRow,
          checklistCountRow,
          versionCountRow,
          workspaceLinkCountRow,
          assessmentTotalRow,
          assessmentDraftRow,
          assessmentSubmittedRow,
          assessmentAnswerCountRow,
          distinctEntityCountRow,
        ] = await Promise.all([
          db
            .selectFrom("audit_dimension")
            .select((eb) => eb.fn.count<number>("id").as("count"))
            .where("audit_id", "=", id)
            .executeTakeFirstOrThrow(),
          db
            .selectFrom("audit_criterion as c")
            .innerJoin("audit_dimension as d", "d.id", "c.audit_dimension_id")
            .select((eb) => eb.fn.count<number>("c.id").as("count"))
            .where("d.audit_id", "=", id)
            .executeTakeFirstOrThrow(),
          db
            .selectFrom("audit_checklist_item as i")
            .innerJoin("audit_criterion as c", "c.id", "i.audit_criterion_id")
            .innerJoin("audit_dimension as d", "d.id", "c.audit_dimension_id")
            .select((eb) => eb.fn.count<number>("i.id").as("count"))
            .where("d.audit_id", "=", id)
            .executeTakeFirstOrThrow(),
          db
            .selectFrom("audit_version")
            .select((eb) => eb.fn.count<number>("id").as("count"))
            .where("audit_id", "=", id)
            .executeTakeFirstOrThrow(),
          db
            .selectFrom("workspace_audit")
            .select((eb) => eb.fn.count<number>("audit_id").as("count"))
            .where("audit_id", "=", id)
            .executeTakeFirstOrThrow(),
          db
            .selectFrom("assessment")
            .select((eb) => eb.fn.count<number>("id").as("count"))
            .where("audit_id", "=", id)
            .executeTakeFirstOrThrow(),
          db
            .selectFrom("assessment")
            .select((eb) => eb.fn.count<number>("id").as("count"))
            .where("audit_id", "=", id)
            .where("status", "=", "draft")
            .executeTakeFirstOrThrow(),
          db
            .selectFrom("assessment")
            .select((eb) => eb.fn.count<number>("id").as("count"))
            .where("audit_id", "=", id)
            .where("status", "=", "submitted")
            .executeTakeFirstOrThrow(),
          db
            .selectFrom("assessment_answer as aa")
            .innerJoin("assessment as s", "s.id", "aa.assessment_id")
            .select((eb) => eb.fn.count<number>("aa.id").as("count"))
            .where("s.audit_id", "=", id)
            .executeTakeFirstOrThrow(),
          db
            .selectFrom("assessment")
            .select(sql<number>`count(distinct entity_id)`.as("count"))
            .where("audit_id", "=", id)
            .executeTakeFirstOrThrow(),
        ]);

        return Response.json({
          audit: {
            id: audit.id,
            name: audit.name,
            publicId: audit.public_id,
          },
          summary: {
            dimensions: Number(dimensionCountRow.count ?? 0),
            criteria: Number(criterionCountRow.count ?? 0),
            checklistItems: Number(checklistCountRow.count ?? 0),
            versions: Number(versionCountRow.count ?? 0),
            workspaceLinks: Number(workspaceLinkCountRow.count ?? 0),
            assessmentsTotal: Number(assessmentTotalRow.count ?? 0),
            assessmentsDraft: Number(assessmentDraftRow.count ?? 0),
            assessmentsSubmitted: Number(assessmentSubmittedRow.count ?? 0),
            assessmentAnswers: Number(assessmentAnswerCountRow.count ?? 0),
            distinctEntitiesAssessed: Number(distinctEntityCountRow.count ?? 0),
          },
        });
      },
    },

    "/api/audits/:id/dimensions": {
      async POST(req) {
        const { session, response } = await requireAuditManagerSession(req);
        if (response) {
          return response;
        }

        const auditId = Number(req.params.id);
        if (!Number.isFinite(auditId) || auditId <= 0) {
          return Response.json(
            { error: "Invalid audit id." },
            { status: 400 }
          );
        }

        const body = await req
          .json()
          .catch(() => ({} as { name?: string }));
        const name = typeof body.name === "string" ? body.name.trim() : "";
        if (!name) {
          return Response.json(
            { error: "Dimension name is required." },
            { status: 400 }
          );
        }

        const audit = await repositories.audit.getById(auditId);
        if (!audit) {
          return Response.json(
            { error: "Audit not found." },
            { status: 404 }
          );
        }

        const dimension = await repositories.dimension.create({
          auditId,
          name,
        });

        return Response.json({
          dimension: {
            id: dimension.id,
            auditId: dimension.audit_id,
            name: dimension.name,
            position: dimension.position,
          },
        });
      },
    },

    "/api/audits/:id/publish": {
      async POST(req) {
        const { session, response } = await requireAuditManagerSession(req);
        if (response) {
          return response;
        }

        const auditId = Number(req.params.id);
        if (!Number.isFinite(auditId) || auditId <= 0) {
          return Response.json(
            { error: "Invalid audit id." },
            { status: 400 }
          );
        }

        try {
          const version = await repositories.version.publishFromCurrentAudit(auditId, session.user.id);
          return Response.json({
            version: {
              id: version.id,
              auditId: version.audit_id,
              versionNo: version.version_no,
              publishedAt: version.published_at,
            },
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to publish audit.";
          const status = message === "Audit not found." ? 404 : 400;
          return Response.json({ error: message }, { status });
        }
      },
    },

    "/api/audits/:id/dimensions/reorder": {
      async PUT(req) {
        const { session, response } = await requireAuditManagerSession(req);
        if (response) {
          return response;
        }

        const auditId = Number(req.params.id);
        if (!Number.isFinite(auditId) || auditId <= 0) {
          return Response.json(
            { error: "Invalid audit id." },
            { status: 400 }
          );
        }

        const body = await req
          .json()
          .catch(() => ({} as { orderedDimensionIds?: unknown }));
        const idsRaw = body.orderedDimensionIds;
        if (!Array.isArray(idsRaw)) {
          return Response.json(
            { error: "orderedDimensionIds must be an array." },
            { status: 400 }
          );
        }

        const orderedDimensionIds = idsRaw.map((value) => Number(value));
        if (orderedDimensionIds.some((id) => !Number.isFinite(id) || id <= 0)) {
          return Response.json(
            { error: "orderedDimensionIds contains invalid values." },
            { status: 400 }
          );
        }

        try {
          const dimensions = await repositories.dimension.reorder(
            auditId,
            orderedDimensionIds
          );
          return Response.json({
            dimensions: dimensions.map((dimension) => ({
              id: dimension.id,
              auditId: dimension.audit_id,
              name: dimension.name,
              position: dimension.position,
            })),
          });
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "Failed to reorder dimensions." },
            { status: 400 }
          );
        }
      },
    },

    "/api/dimensions/:id": {
      async PATCH(req) {
        const { session, response } = await requireAuditManagerSession(req);
        if (response) {
          return response;
        }

        const id = Number(req.params.id);
        if (!Number.isFinite(id) || id <= 0) {
          return Response.json(
            { error: "Invalid dimension id." },
            { status: 400 }
          );
        }

        const body = await req
          .json()
          .catch(() => ({} as { name?: string }));
        const name = typeof body.name === "string" ? body.name.trim() : "";
        if (!name) {
          return Response.json(
            { error: "Dimension name is required." },
            { status: 400 }
          );
        }

        const dimension = await repositories.dimension.rename(id, name);
        if (!dimension) {
          return Response.json(
            { error: "Dimension not found." },
            { status: 404 }
          );
        }

        return Response.json({
          dimension: {
            id: dimension.id,
            auditId: dimension.audit_id,
            name: dimension.name,
            position: dimension.position,
          },
        });
      },
      async DELETE(req) {
        const { session, response } = await requireAuditManagerSession(req);
        if (response) {
          return response;
        }

        const id = Number(req.params.id);
        if (!Number.isFinite(id) || id <= 0) {
          return Response.json(
            { error: "Invalid dimension id." },
            { status: 400 }
          );
        }

        const deletedCount = await repositories.dimension.delete(id);
        if (deletedCount === 0) {
          return Response.json(
            { error: "Dimension not found." },
            { status: 404 }
          );
        }

        return Response.json({ success: true });
      },
    },

    "/api/dimensions/:id/criteria": {
      async POST(req) {
        const { session, response } = await requireAuditManagerSession(req);
        if (response) {
          return response;
        }

        const dimensionId = Number(req.params.id);
        if (!Number.isFinite(dimensionId) || dimensionId <= 0) {
          return Response.json(
            { error: "Invalid dimension id." },
            { status: 400 }
          );
        }

        const body = await req
          .json()
          .catch(() => ({} as { name?: string; description?: string }));
        const name = typeof body.name === "string" ? body.name.trim() : "";
        if (!name) {
          return Response.json(
            { error: "Criterion name is required." },
            { status: 400 }
          );
        }

        const dimension = await repositories.dimension.getById(dimensionId);
        if (!dimension) {
          return Response.json(
            { error: "Dimension not found." },
            { status: 404 }
          );
        }

        const criterion = await repositories.criterion.create({
          dimensionId,
          name,
          description: typeof body.description === "string" ? body.description : "",
        });

        return Response.json({
          criterion: {
            id: criterion.id,
            dimensionId: criterion.audit_dimension_id,
            name: criterion.name,
            description: criterion.description,
            position: criterion.position,
          },
        });
      },
    },

    "/api/dimensions/:id/criteria/reorder": {
      async PUT(req) {
        const { session, response } = await requireAuditManagerSession(req);
        if (response) {
          return response;
        }

        const dimensionId = Number(req.params.id);
        if (!Number.isFinite(dimensionId) || dimensionId <= 0) {
          return Response.json(
            { error: "Invalid dimension id." },
            { status: 400 }
          );
        }

        const body = await req
          .json()
          .catch(() => ({} as { orderedCriterionIds?: unknown }));
        const idsRaw = body.orderedCriterionIds;
        if (!Array.isArray(idsRaw)) {
          return Response.json(
            { error: "orderedCriterionIds must be an array." },
            { status: 400 }
          );
        }

        const orderedCriterionIds = idsRaw.map((value) => Number(value));
        if (orderedCriterionIds.some((id) => !Number.isFinite(id) || id <= 0)) {
          return Response.json(
            { error: "orderedCriterionIds contains invalid values." },
            { status: 400 }
          );
        }

        try {
          const criteria = await repositories.criterion.reorder(
            dimensionId,
            orderedCriterionIds
          );
          return Response.json({
            criteria: criteria.map((criterion) => ({
              id: criterion.id,
              dimensionId: criterion.audit_dimension_id,
              name: criterion.name,
              description: criterion.description,
              position: criterion.position,
            })),
          });
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "Failed to reorder criteria." },
            { status: 400 }
          );
        }
      },
    },

    "/api/criteria/:id": {
      async PATCH(req) {
        const { session, response } = await requireAuditManagerSession(req);
        if (response) {
          return response;
        }

        const id = Number(req.params.id);
        if (!Number.isFinite(id) || id <= 0) {
          return Response.json(
            { error: "Invalid criterion id." },
            { status: 400 }
          );
        }

        const body = await req
          .json()
          .catch(() => ({} as { name?: string; description?: string }));

        const hasName = typeof body.name === "string" && body.name.trim().length > 0;
        const hasDescription = typeof body.description === "string";
        if (!hasName && !hasDescription) {
          return Response.json(
            { error: "No valid fields to update." },
            { status: 400 }
          );
        }

        const criterion = await repositories.criterion.update(id, {
          name: hasName ? body.name?.trim() : undefined,
          description: hasDescription ? body.description : undefined,
        });
        if (!criterion) {
          return Response.json(
            { error: "Criterion not found." },
            { status: 404 }
          );
        }

        return Response.json({
          criterion: {
            id: criterion.id,
            dimensionId: criterion.audit_dimension_id,
            name: criterion.name,
            description: criterion.description,
            position: criterion.position,
          },
        });
      },
      async DELETE(req) {
        const { session, response } = await requireAuditManagerSession(req);
        if (response) {
          return response;
        }

        const id = Number(req.params.id);
        if (!Number.isFinite(id) || id <= 0) {
          return Response.json(
            { error: "Invalid criterion id." },
            { status: 400 }
          );
        }

        const deletedCount = await repositories.criterion.delete(id);
        if (deletedCount === 0) {
          return Response.json(
            { error: "Criterion not found." },
            { status: 404 }
          );
        }

        return Response.json({ success: true });
      },
    },

    "/api/criteria/:id/items": {
      async POST(req) {
        const { session, response } = await requireAuditManagerSession(req);
        if (response) {
          return response;
        }

        const criterionId = Number(req.params.id);
        if (!Number.isFinite(criterionId) || criterionId <= 0) {
          return Response.json(
            { error: "Invalid criterion id." },
            { status: 400 }
          );
        }

        const body = await req
          .json()
          .catch(() => ({} as { name?: string }));
        const name = typeof body.name === "string" ? body.name.trim() : "";
        if (!name) {
          return Response.json(
            { error: "Checklist item name is required." },
            { status: 400 }
          );
        }

        const criterion = await repositories.criterion.getById(criterionId);
        if (!criterion) {
          return Response.json(
            { error: "Criterion not found." },
            { status: 404 }
          );
        }

        const item = await repositories.checklistItem.create({
          criterionId,
          name,
        });

        return Response.json({
          item: {
            id: item.id,
            criterionId: item.audit_criterion_id,
            name: item.name,
            position: item.position,
          },
        });
      },
    },

    "/api/criteria/:id/items/reorder": {
      async PUT(req) {
        const { session, response } = await requireAuditManagerSession(req);
        if (response) {
          return response;
        }

        const criterionId = Number(req.params.id);
        if (!Number.isFinite(criterionId) || criterionId <= 0) {
          return Response.json(
            { error: "Invalid criterion id." },
            { status: 400 }
          );
        }

        const body = await req
          .json()
          .catch(() => ({} as { orderedItemIds?: unknown }));
        const idsRaw = body.orderedItemIds;
        if (!Array.isArray(idsRaw)) {
          return Response.json(
            { error: "orderedItemIds must be an array." },
            { status: 400 }
          );
        }

        const orderedItemIds = idsRaw.map((value) => Number(value));
        if (orderedItemIds.some((id) => !Number.isFinite(id) || id <= 0)) {
          return Response.json(
            { error: "orderedItemIds contains invalid values." },
            { status: 400 }
          );
        }

        try {
          const items = await repositories.checklistItem.reorder(
            criterionId,
            orderedItemIds
          );
          return Response.json({
            items: items.map((item) => ({
              id: item.id,
              criterionId: item.audit_criterion_id,
              name: item.name,
              position: item.position,
            })),
          });
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "Failed to reorder checklist items." },
            { status: 400 }
          );
        }
      },
    },

    "/api/items/:id": {
      async PATCH(req) {
        const { session, response } = await requireAuditManagerSession(req);
        if (response) {
          return response;
        }

        const id = Number(req.params.id);
        if (!Number.isFinite(id) || id <= 0) {
          return Response.json(
            { error: "Invalid item id." },
            { status: 400 }
          );
        }

        const body = await req
          .json()
          .catch(() => ({} as { name?: string }));
        const name = typeof body.name === "string" ? body.name.trim() : "";
        if (!name) {
          return Response.json(
            { error: "Checklist item name is required." },
            { status: 400 }
          );
        }

        const item = await repositories.checklistItem.rename(id, name);
        if (!item) {
          return Response.json(
            { error: "Checklist item not found." },
            { status: 404 }
          );
        }

        return Response.json({
          item: {
            id: item.id,
            criterionId: item.audit_criterion_id,
            name: item.name,
            position: item.position,
          },
        });
      },
      async DELETE(req) {
        const { session, response } = await requireAuditManagerSession(req);
        if (response) {
          return response;
        }

        const id = Number(req.params.id);
        if (!Number.isFinite(id) || id <= 0) {
          return Response.json(
            { error: "Invalid item id." },
            { status: 400 }
          );
        }

        const deletedCount = await repositories.checklistItem.delete(id);
        if (deletedCount === 0) {
          return Response.json(
            { error: "Checklist item not found." },
            { status: 404 }
          );
        }

        return Response.json({ success: true });
      },
    },

    "/": index,
    "/*": index,
  },

  development: process.env.NODE_ENV !== "production" && {
    // Enable browser hot reloading in development
    hmr: true,

    // Echo console logs from the browser to the server
    console: true,
  },
});

console.log(`🚀 Server running at ${server.url}`);
