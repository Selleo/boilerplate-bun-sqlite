import type { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("assessment")
    .addColumn("workspace_id", "integer", (col) =>
      col.notNull().references("workspace.id").onDelete("restrict")
    )
    .execute();

  await db.schema
    .createIndex("idx_assessment_workspace_id")
    .on("assessment")
    .column("workspace_id")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex("idx_assessment_workspace_id").ifExists().execute();
  await db.schema.alterTable("assessment").dropColumn("workspace_id").execute();
}
