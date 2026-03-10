import { sql } from "kysely";
import type { Kysely } from "kysely";
import type { DB } from "../types";

export type AuditListItem = {
  id: number;
  publicId: string;
  name: string;
  latestPublishedVersion: number | null;
  lastPublishedAt: string | null;
  dimensionCount: number;
  criterionCount: number;
  checklistItemCount: number;
};

export type AuditManagementItem = {
  id: number;
  position: number;
  name: string;
};

export type AuditManagementCriterion = {
  id: number;
  position: number;
  name: string;
  description: string;
  items: AuditManagementItem[];
};

export type AuditManagementDimension = {
  id: number;
  position: number;
  name: string;
  criteria: AuditManagementCriterion[];
};

export type AuditManagementRecord = {
  id: number;
  publicId: string;
  name: string;
  description: string;
  version: number;
  updatedAt: string;
  lastPublishedAt: string | null;
  dimensions: AuditManagementDimension[];
};

export type ImportedAuditStructure = {
  name: string;
  description: string;
  dimensions: Array<{
    name: string;
    criteria: Array<{
      name: string;
      description: string;
      items: Array<{ name: string }>;
    }>;
  }>;
};

export class AuditRepository {
  constructor(private readonly db: Kysely<DB>) {}

  async generateNextPublicId(now = new Date()) {
    const year = now.getFullYear();
    const prefix = `A-${year}-`;

    const rows = await this.db
      .selectFrom("audit")
      .select("public_id")
      .where("public_id", "like", `${prefix}%`)
      .execute();

    let maxSuffix = 0;
    for (const row of rows) {
      const suffix = Number(row.public_id.slice(prefix.length));
      if (Number.isFinite(suffix) && suffix > maxSuffix) {
        maxSuffix = suffix;
      }
    }

    return `${prefix}${String(maxSuffix + 1).padStart(3, "0")}`;
  }

  async create(input: { publicId: string; name: string; description?: string }) {
    const row = await this.db
      .insertInto("audit")
      .values({
        public_id: input.publicId,
        name: input.name,
        description: input.description ?? "",
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return row;
  }

  async createDraft(input?: { name?: string; description?: string }) {
    const publicId = await this.generateNextPublicId();
    return this.create({
      publicId,
      name: input?.name ?? "",
      description: input?.description ?? "",
    });
  }

  async createFromImportedStructure(structure: ImportedAuditStructure) {
    const publicId = await this.generateNextPublicId();

    return this.db.transaction().execute(async (trx) => {
      const audit = await trx
        .insertInto("audit")
        .values({
          public_id: publicId,
          name: structure.name,
          description: structure.description,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      for (let dimensionIndex = 0; dimensionIndex < structure.dimensions.length; dimensionIndex += 1) {
        const dimension = structure.dimensions[dimensionIndex];
        const createdDimension = await trx
          .insertInto("audit_dimension")
          .values({
            audit_id: audit.id,
            position: dimensionIndex + 1,
            name: dimension.name,
          })
          .returning(["id"])
          .executeTakeFirstOrThrow();

        for (let criterionIndex = 0; criterionIndex < dimension.criteria.length; criterionIndex += 1) {
          const criterion = dimension.criteria[criterionIndex];
          const createdCriterion = await trx
            .insertInto("audit_criterion")
            .values({
              audit_dimension_id: createdDimension.id,
              position: criterionIndex + 1,
              name: criterion.name,
              description: criterion.description,
            })
            .returning(["id"])
            .executeTakeFirstOrThrow();

          for (let itemIndex = 0; itemIndex < criterion.items.length; itemIndex += 1) {
            const item = criterion.items[itemIndex];
            await trx
              .insertInto("audit_checklist_item")
              .values({
                audit_criterion_id: createdCriterion.id,
                position: itemIndex + 1,
                name: item.name,
              })
              .executeTakeFirst();
          }
        }
      }

      return audit;
    });
  }

  async list(): Promise<AuditListItem[]> {
    const [audits, publishedVersions, dimensionCounts, criterionCounts, checklistItemCounts] =
      await Promise.all([
        this.db.selectFrom("audit").selectAll().orderBy("id", "asc").execute(),
        this.db
          .selectFrom("audit_version")
          .select(["audit_id", "version_no", "published_at"])
          .orderBy("audit_id", "asc")
          .orderBy("version_no", "desc")
          .execute(),
        this.db
          .selectFrom("audit_dimension")
          .select("audit_id")
          .select((eb) => eb.fn.count("id").as("dimension_count"))
          .groupBy("audit_id")
          .execute(),
        this.db
          .selectFrom("audit_dimension as d")
          .innerJoin("audit_criterion as c", "c.audit_dimension_id", "d.id")
          .select("d.audit_id")
          .select((eb) => eb.fn.count("c.id").as("criterion_count"))
          .groupBy("d.audit_id")
          .execute(),
        this.db
          .selectFrom("audit_dimension as d")
          .innerJoin("audit_criterion as c", "c.audit_dimension_id", "d.id")
          .innerJoin("audit_checklist_item as i", "i.audit_criterion_id", "c.id")
          .select("d.audit_id")
          .select((eb) => eb.fn.count("i.id").as("checklist_item_count"))
          .groupBy("d.audit_id")
          .execute(),
      ]);

    const publishedByAuditId = new Map<number, { latestPublishedVersion: number; lastPublishedAt: string }>();
    for (const row of publishedVersions) {
      if (!publishedByAuditId.has(row.audit_id)) {
        publishedByAuditId.set(row.audit_id, {
          latestPublishedVersion: row.version_no,
          lastPublishedAt: row.published_at,
        });
      }
    }

    const dimensionCountByAuditId = new Map<number, number>(
      dimensionCounts.map((row) => [row.audit_id, Number(row.dimension_count ?? 0)])
    );
    const criterionCountByAuditId = new Map<number, number>(
      criterionCounts.map((row) => [row.audit_id, Number(row.criterion_count ?? 0)])
    );
    const checklistItemCountByAuditId = new Map<number, number>(
      checklistItemCounts.map((row) => [row.audit_id, Number(row.checklist_item_count ?? 0)])
    );

    return audits.map((audit) => {
      const published = publishedByAuditId.get(audit.id);
      return {
        id: audit.id,
        publicId: audit.public_id,
        name: audit.name,
      latestPublishedVersion: published ? published.latestPublishedVersion : null,
      lastPublishedAt: published ? published.lastPublishedAt : null,
        dimensionCount: dimensionCountByAuditId.get(audit.id) ?? 0,
        criterionCount: criterionCountByAuditId.get(audit.id) ?? 0,
        checklistItemCount: checklistItemCountByAuditId.get(audit.id) ?? 0,
      };
    });
  }

  async getById(id: number) {
    return this.db.selectFrom("audit").selectAll().where("id", "=", id).executeTakeFirst();
  }

  async getByPublicId(publicId: string) {
    return this.db
      .selectFrom("audit")
      .selectAll()
      .where("public_id", "=", publicId)
      .executeTakeFirst();
  }

  async getManagementById(id: number): Promise<AuditManagementRecord | null> {
    const [audit, latestVersion, currentVersion] = await Promise.all([
      this.getById(id),
      this.db
        .selectFrom("audit_version")
        .select(["version_no", "published_at"])
        .where("audit_id", "=", id)
        .orderBy("version_no", "desc")
        .limit(1)
        .executeTakeFirst(),
      this.db
        .selectFrom("audit as a")
        .innerJoin("audit_version as av", "av.id", "a.current_published_version_id")
        .select("av.version_no")
        .where("a.id", "=", id)
        .executeTakeFirst(),
    ]);

    if (!audit) return null;

    const dimensions = await this.db
      .selectFrom("audit_dimension")
      .selectAll()
      .where("audit_id", "=", id)
      .orderBy("position", "asc")
      .execute();

    const dimensionIds = dimensions.map((it) => it.id);
    const criteria =
      dimensionIds.length > 0
        ? await this.db
            .selectFrom("audit_criterion")
            .selectAll()
            .where("audit_dimension_id", "in", dimensionIds)
            .orderBy("position", "asc")
            .execute()
        : [];

    const criterionIds = criteria.map((it) => it.id);
    const items =
      criterionIds.length > 0
        ? await this.db
            .selectFrom("audit_checklist_item")
            .selectAll()
            .where("audit_criterion_id", "in", criterionIds)
            .orderBy("position", "asc")
            .execute()
        : [];

    const itemsByCriterionId = new Map<number, AuditManagementItem[]>();
    for (const item of items) {
      const list = itemsByCriterionId.get(item.audit_criterion_id) ?? [];
      list.push({
        id: item.id,
        position: item.position,
        name: item.name,
      });
      itemsByCriterionId.set(item.audit_criterion_id, list);
    }

    const criteriaByDimensionId = new Map<number, AuditManagementCriterion[]>();
    for (const criterion of criteria) {
      const list = criteriaByDimensionId.get(criterion.audit_dimension_id) ?? [];
      list.push({
        id: criterion.id,
        position: criterion.position,
        name: criterion.name,
        description: criterion.description,
        items: itemsByCriterionId.get(criterion.id) ?? [],
      });
      criteriaByDimensionId.set(criterion.audit_dimension_id, list);
    }

    return {
      id: audit.id,
      publicId: audit.public_id,
      name: audit.name,
      description: audit.description,
      version: currentVersion?.version_no ?? latestVersion?.version_no ?? 0,
      updatedAt: audit.updated_at,
      lastPublishedAt: latestVersion?.published_at ?? null,
      dimensions: dimensions.map((dimension) => ({
        id: dimension.id,
        position: dimension.position,
        name: dimension.name,
        criteria: criteriaByDimensionId.get(dimension.id) ?? [],
      })),
    };
  }

  async update(id: number, input: { publicId?: string; name?: string; description?: string }) {
    if (input.publicId === undefined && input.name === undefined && input.description === undefined) {
      return this.getById(id);
    }

    await this.db
      .updateTable("audit")
      .set({
        ...(input.publicId !== undefined ? { public_id: input.publicId } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        updated_at: sql<string>`datetime('now')`,
      })
      .where("id", "=", id)
      .executeTakeFirst();

    return this.getById(id);
  }

  async delete(id: number) {
    const result = await this.db.deleteFrom("audit").where("id", "=", id).executeTakeFirst();
    return Number(result.numDeletedRows ?? 0);
  }
}
