import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("entity")
    .addColumn("entity_type", "text", (col) => col.notNull().defaultTo("General"))
    .execute();

  await db
    .executeQuery(
      sql`update entity set entity_type = 'General', updated_at = datetime('now') where entity_type = ''`
        .compile(db)
    );

  await db.schema
    .createIndex("ux_entity_type_name")
    .unique()
    .on("entity")
    .columns(["entity_type", "name"])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex("ux_entity_type_name").ifExists().execute();
  await db.schema.alterTable("entity").dropColumn("entity_type").execute();
}
