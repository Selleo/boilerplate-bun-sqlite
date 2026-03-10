import { sql } from "kysely";
import type { Kysely } from "kysely";
import type { DB } from "../types";

export class EntityRepository {
  constructor(private readonly db: Kysely<DB>) {}

  async list() {
    return this.db
      .selectFrom("entity")
      .selectAll()
      .orderBy("entity_type", "asc")
      .orderBy("name", "asc")
      .execute();
  }

  async getById(id: number) {
    return this.db.selectFrom("entity").selectAll().where("id", "=", id).executeTakeFirst();
  }

  async create(input: { type: string; name: string; description?: string }) {
    return this.db
      .insertInto("entity")
      .values({
        entity_type: input.type,
        name: input.name,
        description: input.description ?? "",
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async update(id: number, input: { type?: string; name?: string; description?: string }) {
    if (input.type === undefined && input.name === undefined && input.description === undefined) {
      return this.getById(id);
    }

    await this.db
      .updateTable("entity")
      .set({
        ...(input.type !== undefined ? { entity_type: input.type } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        updated_at: sql<string>`datetime('now')`,
      })
      .where("id", "=", id)
      .executeTakeFirst();

    return this.getById(id);
  }
}
