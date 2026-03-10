import { createHash, randomUUID } from "node:crypto";
import { sql } from "kysely";
import type { Kysely } from "kysely";
import type { DB } from "../types";
import type { AuditSnapshot } from "./audit-version-repository";

export type AssessmentResponse = "pass" | "fail" | "partial" | "na" | "none";
export type AssessmentLetter = "N/A" | string;

export type AssessmentScoreData = {
  min: number;
  max: number;
  score: number;
  result: number | null;
  grade: AssessmentLetter;
  maxGrade: AssessmentLetter;
};

export type AssessmentScoreJson = {
  full: {
    data: AssessmentScoreData;
  };
  dimensions: Array<{
    id: number;
    data: AssessmentScoreData;
  }>;
  criteria: Array<{
    id: number;
    dimensionId: number;
    data: AssessmentScoreData;
  }>;
  items: Array<{
    id: number;
    criterionId: number;
    dimensionId: number;
    data: {
      status: AssessmentResponse;
      comment: string;
    };
  }>;
};

export type AssessmentListRow = {
  id: number;
  auditId: number;
  auditPublicId: string;
  auditName: string;
  auditVersionNo: number;
  entityId: number;
  entityType: string;
  entityName: string;
  status: "draft" | "submitted";
  updatedAt: string;
  submittedAt: string | null;
  submittedByAvatarUrl: string | null;
  reportShareHash: string | null;
  grade: AssessmentLetter;
  score: AssessmentScoreJson;
};

export type AssessmentAnswerRecord = {
  itemId: number;
  response: AssessmentResponse;
  note: string;
  updatedAt: string;
};

export type AssessmentDetail = {
  id: number;
  auditId: number;
  auditPublicId: string;
  auditName: string;
  auditVersionId: number;
  auditVersionNo: number;
  entityId: number;
  entityType: string;
  entityName: string;
  status: "draft" | "submitted";
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  reportShareHash: string | null;
  score: AssessmentScoreJson;
  snapshot: AuditSnapshot;
  answers: AssessmentAnswerRecord[];
};

export type AssessmentShareReport = {
  id: number;
  auditId: number;
  auditPublicId: string;
  auditName: string;
  auditVersionId: number;
  auditVersionNo: number;
  entityId: number;
  entityType: string;
  entityName: string;
  status: "draft" | "submitted";
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  reportShareHash: string | null;
  score: AssessmentScoreJson;
  snapshot: AuditSnapshot;
};

const VALID_RESPONSES: AssessmentResponse[] = ["pass", "fail", "partial", "na", "none"];

function parseSnapshot(contentJson: string): AuditSnapshot {
  const parsed = JSON.parse(contentJson) as AuditSnapshot;
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.dimensions)) {
    throw new Error("Invalid audit snapshot content.");
  }
  return parsed;
}

function parseScoreJson(contentJson: string | null | undefined): AssessmentScoreJson | null {
  if (!contentJson) return null;
  try {
    const parsed = JSON.parse(contentJson) as AssessmentScoreJson & {
      checklists?: AssessmentScoreJson["items"];
    };
    // Backward compatibility: older payload used `checklists`.
    if (!Array.isArray(parsed.items) && Array.isArray(parsed.checklists)) {
      parsed.items = parsed.checklists;
    }
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !parsed.full ||
      !parsed.full.data ||
      typeof parsed.full.data.max !== "number" ||
      typeof parsed.full.data.score !== "number" ||
      !Array.isArray(parsed.dimensions) ||
      !Array.isArray(parsed.criteria) ||
      !Array.isArray(parsed.items)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function countSnapshotItems(snapshot: AuditSnapshot): number {
  return snapshot.dimensions.reduce((dimensionTotal, dimension) => {
    return (
      dimensionTotal +
      dimension.criteria.reduce((criterionTotal, criterion) => criterionTotal + criterion.items.length, 0)
    );
  }, 0);
}

function collectSnapshotItemIds(snapshot: AuditSnapshot): Set<number> {
  const ids = new Set<number>();
  for (const dimension of snapshot.dimensions) {
    for (const criterion of dimension.criteria) {
      for (const item of criterion.items) {
        ids.add(item.id);
      }
    }
  }
  return ids;
}

function createReportShareHash(seed: string) {
  return createHash("sha256").update(seed).digest("hex");
}

function createGravatarUrl(email: string) {
  const hash = createHash("md5").update(email.trim().toLowerCase()).digest("hex");
  return `https://www.gravatar.com/avatar/${hash}?d=identicon`;
}

function maxLetterFor(maxPoints: number): AssessmentLetter {
  return maxPoints === 0 ? "N/A" : "A";
}

function letterFromResult(result: number | null): AssessmentLetter {
  if (result === null || Number.isNaN(result)) return "N/A";
  if (result <= 0.19) return "F";
  if (result <= 0.39) return "E";
  if (result <= 0.54) return "D";
  if (result <= 0.69) return "C";
  if (result <= 0.89) return "B";
  return "A";
}

function createAnswersMap(
  answers: Array<{ audit_checklist_item_id: number; response: AssessmentResponse; note?: string }>
) {
  const map = new Map<number, { response: AssessmentResponse; note: string }>();
  for (const answer of answers) {
    map.set(answer.audit_checklist_item_id, {
      response: answer.response,
      note: answer.note ?? "",
    });
  }
  return map;
}

function scoreData(max: number, score: number): AssessmentScoreData {
  const result = max === 0 ? null : score / max;
  return {
    min: 0,
    max,
    score,
    result,
    grade: letterFromResult(result),
    maxGrade: maxLetterFor(max),
  };
}

function computeScoreSummary(
  snapshot: AuditSnapshot,
  answersMap: Map<number, { response: AssessmentResponse; note: string }>
): AssessmentScoreJson {
  const criteria: AssessmentScoreJson["criteria"] = [];
  const items: AssessmentScoreJson["items"] = [];

  const dimensions = [...snapshot.dimensions]
    .sort((a, b) => a.position - b.position)
    .map((dimension) => {
      let dimensionScore = 0;
      let dimensionMax = 0;

      const sortedCriteria = [...dimension.criteria].sort((a, b) => a.position - b.position);
      for (const criterion of sortedCriteria) {
        let criterionScore = 0;
        let criterionMax = 0;

        const sortedItems = [...criterion.items].sort((a, b) => a.position - b.position);
        for (const item of sortedItems) {
          const answer = answersMap.get(item.id) ?? { response: "none", note: "" };
          items.push({
            id: item.id,
            criterionId: criterion.id,
            dimensionId: dimension.id,
            data: {
              status: answer.response,
              comment: answer.note,
            },
          });

          if (answer.response === "na") {
            continue;
          }

          criterionMax += 1;
          if (answer.response === "pass") {
            criterionScore += 1;
          }
        }

        criteria.push({
          id: criterion.id,
          dimensionId: dimension.id,
          data: scoreData(criterionMax, criterionScore),
        });

        dimensionMax += criterionMax;
        dimensionScore += criterionScore;
      }

      return {
        id: dimension.id,
        data: scoreData(dimensionMax, dimensionScore),
      };
    });

  const fullScore = dimensions.reduce((sum, dimension) => sum + dimension.data.score, 0);
  const fullMax = dimensions.reduce((sum, dimension) => sum + dimension.data.max, 0);

  return {
    full: {
      data: scoreData(fullMax, fullScore),
    },
    dimensions,
    criteria,
    items,
  };
}

function computeScoreArtifacts(
  snapshot: AuditSnapshot,
  answersMap: Map<number, { response: AssessmentResponse; note: string }>
): { score: AssessmentScoreJson; grade: AssessmentLetter } {
  const score = computeScoreSummary(snapshot, answersMap);
  return {
    score,
    grade: score.full.data.grade,
  };
}

export class AssessmentRepository {
  constructor(private readonly db: Kysely<DB>) {}

  private async ensureSubmittedArtifacts(
    assessmentId: number
  ): Promise<{ reportShareHash: string | null; score: AssessmentScoreJson | null; grade: AssessmentLetter | null }> {
    const current = await this.db
      .selectFrom("assessment as s")
      .innerJoin("audit_version as av", "av.id", "s.audit_version_id")
      .select([
        "s.id",
        "s.status",
        "s.report_share_hash",
        "s.score_json",
        "s.grade",
        "av.content_json",
      ])
      .where("s.id", "=", assessmentId)
      .executeTakeFirst();

    if (!current) {
      return { reportShareHash: null, score: null, grade: null };
    }

    const parsedScore = parseScoreJson(current.score_json);
    if (current.status !== "submitted") {
      return {
        reportShareHash: current.report_share_hash,
        score: parsedScore,
        grade: current.grade,
      };
    }

    if (current.report_share_hash && parsedScore && current.grade) {
      return {
        reportShareHash: current.report_share_hash,
        score: parsedScore,
        grade: current.grade,
      };
    }

    const answers = await this.db
      .selectFrom("assessment_answer")
      .select(["audit_checklist_item_id", "response", "note"])
      .where("assessment_id", "=", assessmentId)
      .execute();

    const snapshot = parseSnapshot(current.content_json);
    const artifacts = parsedScore
      ? { score: parsedScore, grade: current.grade ?? parsedScore.full.data.grade }
      : computeScoreArtifacts(snapshot, createAnswersMap(answers));
    const reportShareHash =
      current.report_share_hash ??
      createReportShareHash(`${assessmentId}:submitted:${Date.now()}:${randomUUID()}`);

    await this.db
      .updateTable("assessment")
      .set({
        report_share_hash: reportShareHash,
        score_json: JSON.stringify(artifacts.score),
        grade: artifacts.grade,
        updated_at: sql<string>`datetime('now')`,
      })
      .where("id", "=", assessmentId)
      .executeTakeFirst();

    return {
      reportShareHash,
      score: artifacts.score,
      grade: artifacts.grade,
    };
  }

  async list(workspaceId?: number): Promise<AssessmentListRow[]> {
    const assessmentsQuery = this.db
      .selectFrom("assessment as s")
      .innerJoin("audit as a", "a.id", "s.audit_id")
      .innerJoin("audit_version as av", "av.id", "s.audit_version_id")
      .innerJoin("entity as e", "e.id", "s.entity_id")
      .select([
        "s.id",
        "s.status",
        "s.updated_at",
        "s.submitted_by_user_id",
        "s.submitted_at",
        "s.report_share_hash",
        "s.score_json",
        "s.grade",
        "a.id as audit_id",
        "a.public_id as audit_public_id",
        "a.name as audit_name",
        "av.version_no",
        "av.content_json",
        "e.id as entity_id",
        "e.entity_type as entity_type",
        "e.name as entity_name",
      ]);

    const scopedAssessmentsQuery =
      workspaceId !== undefined
        ? assessmentsQuery
            .leftJoin("workspace_entity as we", (join) =>
              join.onRef("we.entity_id", "=", "s.entity_id").on("we.workspace_id", "=", workspaceId)
            )
            .where((eb) =>
              eb.or([
                eb("s.workspace_id", "=", workspaceId),
                eb.and([
                  eb("s.workspace_id", "is", null),
                  eb("we.workspace_id", "is not", null),
                ]),
              ])
            )
        : assessmentsQuery;

    const [assessments, answers] = await Promise.all([
      scopedAssessmentsQuery
        .orderBy("s.updated_at", "desc")
        .orderBy("s.id", "desc")
        .execute(),
      this.db
        .selectFrom("assessment_answer")
        .select(["assessment_id", "audit_checklist_item_id", "response", "note"])
        .execute(),
    ]);

    const submitterIds = [...new Set(
      assessments
        .map((row) => row.submitted_by_user_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    )];
    const submitterEmailById = new Map<string, string>();
    if (submitterIds.length > 0) {
      const users = await this.db
        .selectFrom("user")
        .select(["id", "email"])
        .where("id", "in", submitterIds)
        .execute();
      for (const user of users) {
        submitterEmailById.set(user.id, user.email);
      }
    }

    const answersByAssessmentId = new Map<number, Array<{ audit_checklist_item_id: number; response: AssessmentResponse; note: string }>>();
    for (const answer of answers) {
      const list = answersByAssessmentId.get(answer.assessment_id) ?? [];
      list.push({
        audit_checklist_item_id: answer.audit_checklist_item_id,
        response: answer.response,
        note: answer.note,
      });
      answersByAssessmentId.set(answer.assessment_id, list);
    }

    const result: AssessmentListRow[] = [];
    for (const row of assessments) {
      const snapshot = parseSnapshot(row.content_json);
      const submitterEmail = row.submitted_by_user_id
        ? submitterEmailById.get(row.submitted_by_user_id)
        : undefined;

      let reportShareHash = row.report_share_hash;
      let score = parseScoreJson(row.score_json);
      let grade = row.grade;

      if (row.status === "submitted" && (!reportShareHash || !score)) {
        const ensured = await this.ensureSubmittedArtifacts(row.id);
        reportShareHash = ensured.reportShareHash;
        score = ensured.score;
        grade = ensured.grade;
      }

      if (!score) {
        const artifacts = computeScoreArtifacts(
          snapshot,
          createAnswersMap(answersByAssessmentId.get(row.id) ?? [])
        );
        score = artifacts.score;
        grade = artifacts.grade;
      }

      result.push({
        submittedByAvatarUrl: submitterEmail ? createGravatarUrl(submitterEmail) : null,
        id: row.id,
        auditId: row.audit_id,
        auditPublicId: row.audit_public_id,
        auditName: row.audit_name,
        auditVersionNo: row.version_no,
        entityId: row.entity_id,
        entityType: row.entity_type,
        entityName: row.entity_name,
        status: row.status,
        updatedAt: row.updated_at,
        submittedAt: row.submitted_at,
        reportShareHash,
        grade: grade ?? score.full.data.grade,
        score,
      });
    }

    return result;
  }

  async createDraft(input: {
    auditId?: number;
    auditVersionId?: number;
    entityId: number;
    workspaceId: number;
    createdByUserId: string;
  }) {
    return this.db.transaction().execute(async (trx) => {
      let version:
        | {
            id: number;
            audit_id: number;
          }
        | undefined;

      if (input.auditVersionId !== undefined) {
        version = await trx
          .selectFrom("audit_version")
          .select(["id", "audit_id"])
          .where("id", "=", input.auditVersionId)
          .executeTakeFirst();
      } else if (input.auditId !== undefined) {
        version = await trx
          .selectFrom("audit_version")
          .select(["id", "audit_id"])
          .where("audit_id", "=", input.auditId)
          .orderBy("version_no", "desc")
          .limit(1)
          .executeTakeFirst();
      }

      if (!version) {
        throw new Error("Published audit version not found.");
      }

      const entity = await trx
        .selectFrom("entity")
        .select("id")
        .where("id", "=", input.entityId)
        .executeTakeFirst();
      if (!entity) {
        throw new Error("Entity not found.");
      }

      const created = await trx
        .insertInto("assessment")
        .values({
          audit_id: version.audit_id,
          audit_version_id: version.id,
          entity_id: input.entityId,
          workspace_id: input.workspaceId,
          status: "draft",
          report_share_hash: null,
          score_json: null,
          grade: null,
          created_by_user_id: input.createdByUserId,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      return created;
    });
  }

  async getById(id: number): Promise<AssessmentDetail | null> {
    const row = await this.db
      .selectFrom("assessment as s")
      .innerJoin("audit as a", "a.id", "s.audit_id")
      .innerJoin("audit_version as av", "av.id", "s.audit_version_id")
      .innerJoin("entity as e", "e.id", "s.entity_id")
      .select([
        "s.id",
        "s.status",
        "s.created_at",
        "s.updated_at",
        "s.submitted_at",
        "s.report_share_hash",
        "s.score_json",
        "s.grade",
        "a.id as audit_id",
        "a.public_id as audit_public_id",
        "a.name as audit_name",
        "av.id as audit_version_id",
        "av.version_no",
        "av.content_json",
        "e.id as entity_id",
        "e.entity_type as entity_type",
        "e.name as entity_name",
      ])
      .where("s.id", "=", id)
      .executeTakeFirst();

    if (!row) {
      return null;
    }

    const answers = await this.db
      .selectFrom("assessment_answer")
      .select(["audit_checklist_item_id", "response", "note", "updated_at"])
      .where("assessment_id", "=", id)
      .orderBy("audit_checklist_item_id", "asc")
      .execute();

    const snapshot = parseSnapshot(row.content_json);
    let reportShareHash = row.report_share_hash;
    let score = parseScoreJson(row.score_json);
    let grade = row.grade;

    if (row.status === "submitted" && (!reportShareHash || !score)) {
      const ensured = await this.ensureSubmittedArtifacts(row.id);
      reportShareHash = ensured.reportShareHash;
      score = ensured.score;
      grade = ensured.grade;
    }

    if (!score) {
      const artifacts = computeScoreArtifacts(snapshot, createAnswersMap(answers));
      score = artifacts.score;
      grade = artifacts.grade;
    }

    return {
      id: row.id,
      auditId: row.audit_id,
      auditPublicId: row.audit_public_id,
      auditName: row.audit_name,
      auditVersionId: row.audit_version_id,
      auditVersionNo: row.version_no,
      entityId: row.entity_id,
      entityType: row.entity_type,
      entityName: row.entity_name,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      submittedAt: row.submitted_at,
      reportShareHash,
      score,
      snapshot,
      answers: answers.map((answer) => ({
        itemId: answer.audit_checklist_item_id,
        response: answer.response,
        note: answer.note,
        updatedAt: answer.updated_at,
      })),
    };
  }

  async getShareReportByLink(auditPublicId: string, reportShareHash: string): Promise<AssessmentShareReport | null> {
    const row = await this.db
      .selectFrom("assessment as s")
      .innerJoin("audit as a", "a.id", "s.audit_id")
      .innerJoin("audit_version as av", "av.id", "s.audit_version_id")
      .innerJoin("entity as e", "e.id", "s.entity_id")
      .select([
        "s.id",
        "s.status",
        "s.created_at",
        "s.updated_at",
        "s.submitted_at",
        "s.report_share_hash",
        "s.score_json",
        "s.grade",
        "a.id as audit_id",
        "a.public_id as audit_public_id",
        "a.name as audit_name",
        "av.id as audit_version_id",
        "av.version_no",
        "av.content_json",
        "e.id as entity_id",
        "e.entity_type as entity_type",
        "e.name as entity_name",
      ])
      .where("s.status", "=", "submitted")
      .where("s.report_share_hash", "=", reportShareHash)
      .where("a.public_id", "=", auditPublicId)
      .executeTakeFirst();

    if (!row) {
      return null;
    }

    const snapshot = parseSnapshot(row.content_json);
    const score = parseScoreJson(row.score_json);
    if (!score || !row.grade) {
      return null;
    }

    return {
      id: row.id,
      auditId: row.audit_id,
      auditPublicId: row.audit_public_id,
      auditName: row.audit_name,
      auditVersionId: row.audit_version_id,
      auditVersionNo: row.version_no,
      entityId: row.entity_id,
      entityType: row.entity_type,
      entityName: row.entity_name,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      submittedAt: row.submitted_at,
      reportShareHash: row.report_share_hash,
      score,
      snapshot,
    };
  }

  async saveAnswer(input: {
    assessmentId: number;
    itemId: number;
    response: AssessmentResponse;
    note: string;
    userId: string;
  }) {
    if (!VALID_RESPONSES.includes(input.response)) {
      throw new Error("Invalid response value.");
    }

    return this.db.transaction().execute(async (trx) => {
      const assessment = await trx
        .selectFrom("assessment as s")
        .innerJoin("audit_version as av", "av.id", "s.audit_version_id")
        .select(["s.id", "s.status", "av.content_json"])
        .where("s.id", "=", input.assessmentId)
        .executeTakeFirst();

      if (!assessment) {
        throw new Error("Assessment not found.");
      }

      if (assessment.status !== "draft") {
        throw new Error("Submitted assessments are read-only.");
      }

      const snapshot = parseSnapshot(assessment.content_json);
      const itemIds = collectSnapshotItemIds(snapshot);
      if (!itemIds.has(input.itemId)) {
        throw new Error("Checklist item does not belong to this assessment.");
      }

      const existing = await trx
        .selectFrom("assessment_answer")
        .select("id")
        .where("assessment_id", "=", input.assessmentId)
        .where("audit_checklist_item_id", "=", input.itemId)
        .executeTakeFirst();

      if (existing) {
        await trx
          .updateTable("assessment_answer")
          .set({
            response: input.response,
            note: input.note,
            updated_by_user_id: input.userId,
            updated_at: sql<string>`datetime('now')`,
          })
          .where("id", "=", existing.id)
          .executeTakeFirst();
      } else {
        await trx
          .insertInto("assessment_answer")
          .values({
            assessment_id: input.assessmentId,
            audit_checklist_item_id: input.itemId,
            response: input.response,
            note: input.note,
            created_by_user_id: input.userId,
            updated_by_user_id: input.userId,
          })
          .executeTakeFirst();
      }

      await trx
        .updateTable("assessment")
        .set({
          score_json: null,
          grade: null,
          updated_at: sql<string>`datetime('now')`,
        })
        .where("id", "=", input.assessmentId)
        .executeTakeFirst();
    });
  }

  async submit(assessmentId: number, userId: string) {
    return this.db.transaction().execute(async (trx) => {
      const current = await trx
        .selectFrom("assessment as s")
        .innerJoin("audit_version as av", "av.id", "s.audit_version_id")
        .select(["s.id", "s.status", "s.report_share_hash", "s.score_json", "s.grade", "av.content_json"])
        .where("s.id", "=", assessmentId)
        .executeTakeFirst();
      if (!current) {
        throw new Error("Assessment not found.");
      }

      const reportShareHash =
        current.report_share_hash ??
        createReportShareHash(`${assessmentId}:${userId}:${Date.now()}:${randomUUID()}`);

      if (current.status === "submitted") {
        const parsed = parseScoreJson(current.score_json);
        if (current.report_share_hash && parsed && current.grade) {
          return await trx
            .selectFrom("assessment")
            .selectAll()
            .where("id", "=", assessmentId)
            .executeTakeFirstOrThrow();
        }

        const answers = await trx
          .selectFrom("assessment_answer")
          .select(["audit_checklist_item_id", "response", "note"])
          .where("assessment_id", "=", assessmentId)
          .execute();
        const snapshot = parseSnapshot(current.content_json);
        const artifacts = parsed
          ? { score: parsed, grade: current.grade ?? parsed.full.data.grade }
          : computeScoreArtifacts(snapshot, createAnswersMap(answers));

        const refreshed = await trx
          .updateTable("assessment")
          .set({
            report_share_hash: reportShareHash,
            score_json: JSON.stringify(artifacts.score),
            grade: artifacts.grade,
            updated_at: sql<string>`datetime('now')`,
          })
          .where("id", "=", assessmentId)
          .returningAll()
          .executeTakeFirst();
        if (!refreshed) {
          throw new Error("Failed to prepare report share link.");
        }
        return refreshed;
      }

      const answers = await trx
        .selectFrom("assessment_answer")
        .select(["audit_checklist_item_id", "response", "note"])
        .where("assessment_id", "=", assessmentId)
        .execute();
      const snapshot = parseSnapshot(current.content_json);
      const artifacts = computeScoreArtifacts(snapshot, createAnswersMap(answers));

      const updated = await trx
        .updateTable("assessment")
        .set({
          status: "submitted",
          report_share_hash: reportShareHash,
          score_json: JSON.stringify(artifacts.score),
          grade: artifacts.grade,
          submitted_by_user_id: userId,
          submitted_at: sql<string>`datetime('now')`,
          updated_at: sql<string>`datetime('now')`,
        })
        .where("id", "=", assessmentId)
        .where("status", "=", "draft")
        .returningAll()
        .executeTakeFirst();

      if (!updated) {
        throw new Error("Failed to submit assessment.");
      }

      return updated;
    });
  }
}
