import type { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("assessment")
    .addColumn("report_share_hash", "text")
    .execute();

  await db.schema
    .createIndex("idx_assessment_report_share_hash")
    .on("assessment")
    .column("report_share_hash")
    .unique()
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex("idx_assessment_report_share_hash").ifExists().execute();
  await db.schema
    .alterTable("assessment")
    .dropColumn("report_share_hash")
    .execute();
}
