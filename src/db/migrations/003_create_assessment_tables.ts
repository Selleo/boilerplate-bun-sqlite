import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("entity")
    .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("description", "text", (col) => col.notNull().defaultTo(""))
    .addColumn("created_at", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn("updated_at", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addUniqueConstraint("ux_entity_name", ["name"])
    .execute();

  await db.schema
    .createTable("assessment")
    .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
    .addColumn("audit_id", "integer", (col) => col.notNull())
    .addColumn("audit_version_id", "integer", (col) => col.notNull())
    .addColumn("entity_id", "integer", (col) => col.notNull())
    .addColumn("status", "text", (col) => col.notNull().defaultTo("draft"))
    .addColumn("created_by_user_id", "text", (col) => col.notNull())
    .addColumn("submitted_by_user_id", "text")
    .addColumn("submitted_at", "text")
    .addColumn("created_at", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn("updated_at", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addCheckConstraint(
      "chk_assessment_status",
      sql`status in ('draft', 'submitted')`
    )
    .addForeignKeyConstraint("fk_assessment_audit_id", ["audit_id"], "audit", ["id"], (cb) =>
      cb.onDelete("restrict")
    )
    .addForeignKeyConstraint(
      "fk_assessment_audit_version_id",
      ["audit_version_id"],
      "audit_version",
      ["id"],
      (cb) => cb.onDelete("restrict")
    )
    .addForeignKeyConstraint("fk_assessment_entity_id", ["entity_id"], "entity", ["id"], (cb) =>
      cb.onDelete("restrict")
    )
    .execute();

  await db.schema
    .createTable("assessment_answer")
    .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
    .addColumn("assessment_id", "integer", (col) => col.notNull())
    .addColumn("audit_checklist_item_id", "integer", (col) => col.notNull())
    .addColumn("response", "text", (col) => col.notNull().defaultTo("none"))
    .addColumn("note", "text", (col) => col.notNull().defaultTo(""))
    .addColumn("created_by_user_id", "text", (col) => col.notNull())
    .addColumn("updated_by_user_id", "text")
    .addColumn("created_at", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn("updated_at", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addCheckConstraint(
      "chk_assessment_answer_response",
      sql`response in ('pass', 'fail', 'partial', 'na', 'none')`
    )
    .addForeignKeyConstraint(
      "fk_assessment_answer_assessment_id",
      ["assessment_id"],
      "assessment",
      ["id"],
      (cb) => cb.onDelete("cascade")
    )
    .addUniqueConstraint("ux_assessment_answer_assessment_item", [
      "assessment_id",
      "audit_checklist_item_id",
    ])
    .execute();

  await db.schema
    .createIndex("idx_assessment_audit_id")
    .on("assessment")
    .column("audit_id")
    .execute();

  await db.schema
    .createIndex("idx_assessment_entity_id")
    .on("assessment")
    .column("entity_id")
    .execute();

  await db.schema
    .createIndex("idx_assessment_version_id")
    .on("assessment")
    .column("audit_version_id")
    .execute();

  await db.schema
    .createIndex("idx_assessment_answer_assessment_id")
    .on("assessment_answer")
    .column("assessment_id")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex("idx_assessment_answer_assessment_id").ifExists().execute();
  await db.schema.dropIndex("idx_assessment_version_id").ifExists().execute();
  await db.schema.dropIndex("idx_assessment_entity_id").ifExists().execute();
  await db.schema.dropIndex("idx_assessment_audit_id").ifExists().execute();

  await db.schema.dropTable("assessment_answer").ifExists().execute();
  await db.schema.dropTable("assessment").ifExists().execute();
  await db.schema.dropTable("entity").ifExists().execute();
}
