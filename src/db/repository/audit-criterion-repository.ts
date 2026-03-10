import { sql } from "kysely";
import type { Kysely } from "kysely";
import type { DB } from "../types";

const POSITION_OFFSET = 1_000_000;

export class AuditCriterionRepository {
  constructor(private readonly db: Kysely<DB>) {}

  async getById(id: number) {
    return this.db.selectFrom("audit_criterion").selectAll().where("id", "=", id).executeTakeFirst();
  }

  private async getAuditIdByDimensionId(dimensionId: number): Promise<number | null> {
    const row = await this.db
      .selectFrom("audit_dimension")
      .select("audit_id")
      .where("id", "=", dimensionId)
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

  async listByDimensionId(dimensionId: number) {
    return this.db
      .selectFrom("audit_criterion")
      .selectAll()
      .where("audit_dimension_id", "=", dimensionId)
      .orderBy("position", "asc")
      .execute();
  }

  async create(input: { dimensionId: number; name: string; description?: string }) {
    const maxPosition = await this.db
      .selectFrom("audit_criterion")
      .select((eb) => eb.fn.max("position").as("max_position"))
      .where("audit_dimension_id", "=", input.dimensionId)
      .executeTakeFirst();

    const nextPosition = (maxPosition?.max_position ?? 0) + 1;

    const created = await this.db
      .insertInto("audit_criterion")
      .values({
        audit_dimension_id: input.dimensionId,
        name: input.name,
        description: input.description ?? "",
        position: nextPosition,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    const auditId = await this.getAuditIdByDimensionId(input.dimensionId);
    if (auditId) {
      await this.touchAudit(auditId);
    }

    return created;
  }

  async update(id: number, input: { name?: string; description?: string }) {
    if (input.name === undefined && input.description === undefined) {
      return this.db.selectFrom("audit_criterion").selectAll().where("id", "=", id).executeTakeFirst();
    }

    const existing = await this.getById(id);
    if (!existing) {
      return undefined;
    }

    await this.db
      .updateTable("audit_criterion")
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
      })
      .where("id", "=", id)
      .executeTakeFirst();

    const auditId = await this.getAuditIdByDimensionId(existing.audit_dimension_id);
    if (auditId) {
      await this.touchAudit(auditId);
    }

    return this.db.selectFrom("audit_criterion").selectAll().where("id", "=", id).executeTakeFirst();
  }

  async delete(id: number) {
    const existing = await this.getById(id);
    if (!existing) {
      return 0;
    }

    return this.db.transaction().execute(async (trx) => {
      const deleted = await trx
        .deleteFrom("audit_criterion")
        .where("id", "=", id)
        .executeTakeFirst();
      const count = Number(deleted.numDeletedRows ?? 0);
      if (count === 0) return 0;

      await trx
        .updateTable("audit_criterion")
        .set({
          position: sql<number>`position + ${POSITION_OFFSET}`,
        })
        .where("audit_dimension_id", "=", existing.audit_dimension_id)
        .execute();

      const remaining = await trx
        .selectFrom("audit_criterion")
        .select("id")
        .where("audit_dimension_id", "=", existing.audit_dimension_id)
        .orderBy("position", "asc")
        .execute();

      for (const [i, row] of remaining.entries()) {
        await trx
          .updateTable("audit_criterion")
          .set({ position: i + 1 })
          .where("id", "=", row.id)
          .where("audit_dimension_id", "=", existing.audit_dimension_id)
          .executeTakeFirst();
      }

      const audit = await trx
        .selectFrom("audit_dimension")
        .select("audit_id")
        .where("id", "=", existing.audit_dimension_id)
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

  async reorder(dimensionId: number, orderedCriterionIds: number[]) {
    await this.db.transaction().execute(async (trx) => {
      const current = await trx
        .selectFrom("audit_criterion")
        .select("id")
        .where("audit_dimension_id", "=", dimensionId)
        .orderBy("position", "asc")
        .execute();

      const currentIds = current.map((it) => it.id);
      if (currentIds.length !== orderedCriterionIds.length) {
        throw new Error("Invalid reorder payload for criteria.");
      }

      const idSet = new Set(currentIds);
      for (const id of orderedCriterionIds) {
        if (!idSet.has(id)) {
          throw new Error("Invalid reorder payload for criteria.");
        }
      }

      await trx
        .updateTable("audit_criterion")
        .set({
          position: sql<number>`position + ${POSITION_OFFSET}`,
        })
        .where("audit_dimension_id", "=", dimensionId)
        .execute();

      for (const [i, id] of orderedCriterionIds.entries()) {
        await trx
          .updateTable("audit_criterion")
          .set({ position: i + 1 })
          .where("id", "=", id)
          .where("audit_dimension_id", "=", dimensionId)
          .executeTakeFirst();
      }

      const audit = await trx
        .selectFrom("audit_dimension")
        .select("audit_id")
        .where("id", "=", dimensionId)
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

    return this.listByDimensionId(dimensionId);
  }
}
