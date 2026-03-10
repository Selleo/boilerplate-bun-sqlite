import { sql } from "kysely";
import type { Kysely } from "kysely";
import type { DB } from "../types";

const POSITION_OFFSET = 1_000_000;

export class AuditDimensionRepository {
  constructor(private readonly db: Kysely<DB>) {}

  async getById(id: number) {
    return this.db.selectFrom("audit_dimension").selectAll().where("id", "=", id).executeTakeFirst();
  }

  async listByAuditId(auditId: number) {
    return this.db
      .selectFrom("audit_dimension")
      .selectAll()
      .where("audit_id", "=", auditId)
      .orderBy("position", "asc")
      .execute();
  }

  async create(input: { auditId: number; name: string }) {
    const maxPosition = await this.db
      .selectFrom("audit_dimension")
      .select((eb) => eb.fn.max("position").as("max_position"))
      .where("audit_id", "=", input.auditId)
      .executeTakeFirst();

    const nextPosition = (maxPosition?.max_position ?? 0) + 1;

    const created = await this.db
      .insertInto("audit_dimension")
      .values({
        audit_id: input.auditId,
        name: input.name,
        position: nextPosition,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    await this.db
      .updateTable("audit")
      .set({
        updated_at: sql<string>`datetime('now')`,
      })
      .where("id", "=", input.auditId)
      .executeTakeFirst();

    return created;
  }

  async rename(id: number, name: string) {
    const dimension = await this.getById(id);
    if (!dimension) {
      return undefined;
    }

    await this.db.updateTable("audit_dimension").set({ name }).where("id", "=", id).executeTakeFirst();

    await this.db
      .updateTable("audit")
      .set({
        updated_at: sql<string>`datetime('now')`,
      })
      .where("id", "=", dimension.audit_id)
      .executeTakeFirst();

    return this.db.selectFrom("audit_dimension").selectAll().where("id", "=", id).executeTakeFirst();
  }

  async delete(id: number) {
    const dimension = await this.getById(id);
    if (!dimension) {
      return 0;
    }

    return this.db.transaction().execute(async (trx) => {
      const deleted = await trx
        .deleteFrom("audit_dimension")
        .where("id", "=", id)
        .executeTakeFirst();
      const count = Number(deleted.numDeletedRows ?? 0);
      if (count === 0) return 0;

      await trx
        .updateTable("audit_dimension")
        .set({
          position: sql<number>`position + ${POSITION_OFFSET}`,
        })
        .where("audit_id", "=", dimension.audit_id)
        .execute();

      const remaining = await trx
        .selectFrom("audit_dimension")
        .select("id")
        .where("audit_id", "=", dimension.audit_id)
        .orderBy("position", "asc")
        .execute();

      for (const [i, row] of remaining.entries()) {
        await trx
          .updateTable("audit_dimension")
          .set({ position: i + 1 })
          .where("id", "=", row.id)
          .where("audit_id", "=", dimension.audit_id)
          .executeTakeFirst();
      }

      await trx
        .updateTable("audit")
        .set({
          updated_at: sql<string>`datetime('now')`,
        })
        .where("id", "=", dimension.audit_id)
        .executeTakeFirst();

      return count;
    });
  }

  async reorder(auditId: number, orderedDimensionIds: number[]) {
    await this.db.transaction().execute(async (trx) => {
      const current = await trx
        .selectFrom("audit_dimension")
        .select("id")
        .where("audit_id", "=", auditId)
        .orderBy("position", "asc")
        .execute();

      const currentIds = current.map((it) => it.id);
      if (currentIds.length !== orderedDimensionIds.length) {
        throw new Error("Invalid reorder payload for dimensions.");
      }

      const idSet = new Set(currentIds);
      for (const id of orderedDimensionIds) {
        if (!idSet.has(id)) {
          throw new Error("Invalid reorder payload for dimensions.");
        }
      }

      await trx
        .updateTable("audit_dimension")
        .set({
          position: sql<number>`position + ${POSITION_OFFSET}`,
        })
        .where("audit_id", "=", auditId)
        .execute();

      for (const [i, id] of orderedDimensionIds.entries()) {
        await trx
          .updateTable("audit_dimension")
          .set({ position: i + 1 })
          .where("id", "=", id)
          .where("audit_id", "=", auditId)
          .executeTakeFirst();
      }

      await trx
        .updateTable("audit")
        .set({
          updated_at: sql<string>`datetime('now')`,
        })
        .where("id", "=", auditId)
        .executeTakeFirst();
    });

    return this.listByAuditId(auditId);
  }
}
