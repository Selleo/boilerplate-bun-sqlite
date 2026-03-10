import { sql } from "kysely";
import type { Kysely } from "kysely";
import type { DB } from "../types";

const POSITION_OFFSET = 1_000_000;

export class AuditChecklistItemRepository {
  constructor(private readonly db: Kysely<DB>) {}

  async getById(id: number) {
    return this.db
      .selectFrom("audit_checklist_item")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
  }

  private async getAuditIdByCriterionId(criterionId: number): Promise<number | null> {
    const row = await this.db
      .selectFrom("audit_criterion as c")
      .innerJoin("audit_dimension as d", "d.id", "c.audit_dimension_id")
      .select("d.audit_id")
      .where("c.id", "=", criterionId)
      .executeTakeFirst();
    return row?.audit_id ?? null;
  }

  private async touchAudit(auditId: number) {
    await this.db
      .updateTable("audit")
      .set({
        updated_at: sql<string>`datetime('now')`,
      })
      .where("id", "=", auditId)
      .executeTakeFirst();
  }

  async listByCriterionId(criterionId: number) {
    return this.db
      .selectFrom("audit_checklist_item")
      .selectAll()
      .where("audit_criterion_id", "=", criterionId)
      .orderBy("position", "asc")
      .execute();
  }

  async create(input: { criterionId: number; name: string }) {
    const maxPosition = await this.db
      .selectFrom("audit_checklist_item")
      .select((eb) => eb.fn.max("position").as("max_position"))
      .where("audit_criterion_id", "=", input.criterionId)
      .executeTakeFirst();

    const nextPosition = (maxPosition?.max_position ?? 0) + 1;

    const created = await this.db
      .insertInto("audit_checklist_item")
      .values({
        audit_criterion_id: input.criterionId,
        name: input.name,
        position: nextPosition,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    const auditId = await this.getAuditIdByCriterionId(input.criterionId);
    if (auditId) {
      await this.touchAudit(auditId);
    }

    return created;
  }

  async rename(id: number, name: string) {
    const existing = await this.getById(id);
    if (!existing) {
      return undefined;
    }

    await this.db
      .updateTable("audit_checklist_item")
      .set({ name })
      .where("id", "=", id)
      .executeTakeFirst();

    const auditId = await this.getAuditIdByCriterionId(existing.audit_criterion_id);
    if (auditId) {
      await this.touchAudit(auditId);
    }

    return this.db
      .selectFrom("audit_checklist_item")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
  }

  async delete(id: number) {
    const existing = await this.getById(id);
    if (!existing) {
      return 0;
    }

    return this.db.transaction().execute(async (trx) => {
      const deleted = await trx
        .deleteFrom("audit_checklist_item")
        .where("id", "=", id)
        .executeTakeFirst();
      const count = Number(deleted.numDeletedRows ?? 0);
      if (count === 0) return 0;

      await trx
        .updateTable("audit_checklist_item")
        .set({
          position: sql<number>`position + ${POSITION_OFFSET}`,
        })
        .where("audit_criterion_id", "=", existing.audit_criterion_id)
        .execute();

      const remaining = await trx
        .selectFrom("audit_checklist_item")
        .select("id")
        .where("audit_criterion_id", "=", existing.audit_criterion_id)
        .orderBy("position", "asc")
        .execute();

      for (const [i, row] of remaining.entries()) {
        await trx
          .updateTable("audit_checklist_item")
          .set({ position: i + 1 })
          .where("id", "=", row.id)
          .where("audit_criterion_id", "=", existing.audit_criterion_id)
          .executeTakeFirst();
      }

      const audit = await trx
        .selectFrom("audit_criterion as c")
        .innerJoin("audit_dimension as d", "d.id", "c.audit_dimension_id")
        .select("d.audit_id")
        .where("c.id", "=", existing.audit_criterion_id)
        .executeTakeFirst();
      if (audit) {
        await trx
          .updateTable("audit")
          .set({
            updated_at: sql<string>`datetime('now')`,
          })
          .where("id", "=", audit.audit_id)
          .executeTakeFirst();
      }

      return count;
    });
  }

  async reorder(criterionId: number, orderedItemIds: number[]) {
    await this.db.transaction().execute(async (trx) => {
      const current = await trx
        .selectFrom("audit_checklist_item")
        .select("id")
        .where("audit_criterion_id", "=", criterionId)
        .orderBy("position", "asc")
        .execute();

      const currentIds = current.map((it) => it.id);
      if (currentIds.length !== orderedItemIds.length) {
        throw new Error("Invalid reorder payload for checklist items.");
      }

      const idSet = new Set(currentIds);
      for (const id of orderedItemIds) {
        if (!idSet.has(id)) {
          throw new Error("Invalid reorder payload for checklist items.");
        }
      }

      await trx
        .updateTable("audit_checklist_item")
        .set({
          position: sql<number>`position + ${POSITION_OFFSET}`,
        })
        .where("audit_criterion_id", "=", criterionId)
        .execute();

      for (const [i, id] of orderedItemIds.entries()) {
        await trx
          .updateTable("audit_checklist_item")
          .set({ position: i + 1 })
          .where("id", "=", id)
          .where("audit_criterion_id", "=", criterionId)
          .executeTakeFirst();
      }

      const audit = await trx
        .selectFrom("audit_criterion as c")
        .innerJoin("audit_dimension as d", "d.id", "c.audit_dimension_id")
        .select("d.audit_id")
        .where("c.id", "=", criterionId)
        .executeTakeFirst();
      if (audit) {
        await trx
          .updateTable("audit")
          .set({
            updated_at: sql<string>`datetime('now')`,
          })
          .where("id", "=", audit.audit_id)
          .executeTakeFirst();
      }
    });

    return this.listByCriterionId(criterionId);
  }
}
