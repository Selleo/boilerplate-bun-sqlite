import type { Kysely } from "kysely";
import type { DB } from "../types";

export type AuditSnapshot = {
  id: number;
  publicId: string;
  name: string;
  description: string;
  dimensions: Array<{
    id: number;
    position: number;
    name: string;
    criteria: Array<{
      id: number;
      position: number;
      name: string;
      description: string;
      items: Array<{
        id: number;
        position: number;
        name: string;
      }>;
    }>;
  }>;
};

export class AuditVersionRepository {
  constructor(private readonly db: Kysely<DB>) {}

  async listByAuditId(auditId: number) {
    return this.db
      .selectFrom("audit_version")
      .selectAll()
      .where("audit_id", "=", auditId)
      .orderBy("version_no", "desc")
      .execute();
  }

  async getById(id: number) {
    return this.db.selectFrom("audit_version").selectAll().where("id", "=", id).executeTakeFirst();
  }

  async publishFromCurrentAudit(auditId: number, publishedByUserId?: string | null) {
    return this.db.transaction().execute(async (trx) => {
      const audit = await trx.selectFrom("audit").selectAll().where("id", "=", auditId).executeTakeFirst();
      if (!audit) {
        throw new Error("Audit not found.");
      }

      const dimensions = await trx
        .selectFrom("audit_dimension")
        .selectAll()
        .where("audit_id", "=", auditId)
        .orderBy("position", "asc")
        .execute();

      const dimensionIds = dimensions.map((it) => it.id);
      const criteria =
        dimensionIds.length > 0
          ? await trx
              .selectFrom("audit_criterion")
              .selectAll()
              .where("audit_dimension_id", "in", dimensionIds)
              .orderBy("position", "asc")
              .execute()
          : [];

      const criterionIds = criteria.map((it) => it.id);
      const checklistItems =
        criterionIds.length > 0
          ? await trx
              .selectFrom("audit_checklist_item")
              .selectAll()
              .where("audit_criterion_id", "in", criterionIds)
              .orderBy("position", "asc")
              .execute()
          : [];

      const itemsByCriterionId = new Map<number, typeof checklistItems>();
      for (const item of checklistItems) {
        const list = itemsByCriterionId.get(item.audit_criterion_id) ?? [];
        list.push(item);
        itemsByCriterionId.set(item.audit_criterion_id, list);
      }

      const criteriaByDimensionId = new Map<number, typeof criteria>();
      for (const criterion of criteria) {
        const list = criteriaByDimensionId.get(criterion.audit_dimension_id) ?? [];
        list.push(criterion);
        criteriaByDimensionId.set(criterion.audit_dimension_id, list);
      }

      const snapshot: AuditSnapshot = {
        id: audit.id,
        publicId: audit.public_id,
        name: audit.name,
        description: audit.description,
        dimensions: dimensions.map((dimension) => ({
          id: dimension.id,
          position: dimension.position,
          name: dimension.name,
          criteria: (criteriaByDimensionId.get(dimension.id) ?? []).map((criterion) => ({
            id: criterion.id,
            position: criterion.position,
            name: criterion.name,
            description: criterion.description,
            items: (itemsByCriterionId.get(criterion.id) ?? []).map((item) => ({
              id: item.id,
              position: item.position,
              name: item.name,
            })),
          })),
        })),
      };

      const currentVersion = await trx
        .selectFrom("audit_version")
        .select((eb) => eb.fn.max("version_no").as("max_version_no"))
        .where("audit_id", "=", auditId)
        .executeTakeFirst();

      const nextVersionNo = (currentVersion?.max_version_no ?? 0) + 1;

      const inserted = await trx
        .insertInto("audit_version")
        .values({
          audit_id: auditId,
          version_no: nextVersionNo,
          content_json: JSON.stringify(snapshot),
          published_at: new Date().toISOString(),
          published_by_user_id: publishedByUserId ?? null,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      await trx
        .updateTable("audit")
        .set({
          current_published_version_id: inserted.id,
        })
        .where("id", "=", auditId)
        .executeTakeFirst();

      return inserted;
    });
  }
}
