import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("audit")
    .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
    .addColumn("public_id", "text", (col) => col.notNull().unique())
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("description", "text", (col) => col.notNull().defaultTo(""))
    .addColumn("current_published_version_id", "integer")
    .addColumn("created_at", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn("updated_at", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  await db.schema
    .createTable("audit_dimension")
    .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
    .addColumn("audit_id", "integer", (col) => col.notNull())
    .addColumn("position", "integer", (col) => col.notNull())
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("created_at", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn("updated_at", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addForeignKeyConstraint("fk_audit_dimension_audit_id", ["audit_id"], "audit", ["id"], (cb) =>
      cb.onDelete("cascade")
    )
    .addUniqueConstraint("ux_audit_dimension_audit_id_position", ["audit_id", "position"])
    .execute();

  await db.schema
    .createTable("audit_criterion")
    .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
    .addColumn("audit_dimension_id", "integer", (col) => col.notNull())
    .addColumn("position", "integer", (col) => col.notNull())
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("description", "text", (col) => col.notNull().defaultTo(""))
    .addColumn("created_at", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn("updated_at", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addForeignKeyConstraint(
      "fk_audit_criterion_audit_dimension_id",
      ["audit_dimension_id"],
      "audit_dimension",
      ["id"],
      (cb) => cb.onDelete("cascade")
    )
    .addUniqueConstraint("ux_audit_criterion_dimension_position", ["audit_dimension_id", "position"])
    .execute();

  await db.schema
    .createTable("audit_checklist_item")
    .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
    .addColumn("audit_criterion_id", "integer", (col) => col.notNull())
    .addColumn("position", "integer", (col) => col.notNull())
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("created_at", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn("updated_at", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addForeignKeyConstraint(
      "fk_audit_checklist_item_audit_criterion_id",
      ["audit_criterion_id"],
      "audit_criterion",
      ["id"],
      (cb) => cb.onDelete("cascade")
    )
    .addUniqueConstraint("ux_audit_checklist_item_criterion_position", [
      "audit_criterion_id",
      "position",
    ])
    .execute();

  await db.schema
    .createTable("audit_version")
    .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
    .addColumn("audit_id", "integer", (col) => col.notNull())
    .addColumn("version_no", "integer", (col) => col.notNull())
    .addColumn("content_json", "text", (col) => col.notNull())
    .addColumn("published_at", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn("published_by_user_id", "text")
    .addForeignKeyConstraint("fk_audit_version_audit_id", ["audit_id"], "audit", ["id"], (cb) =>
      cb.onDelete("cascade")
    )
    .addUniqueConstraint("ux_audit_version_audit_id_version_no", ["audit_id", "version_no"])
    .execute();

  await db.schema
    .createIndex("idx_audit_dimension_audit_id")
    .on("audit_dimension")
    .column("audit_id")
    .execute();

  await db.schema
    .createIndex("idx_audit_criterion_dimension_id")
    .on("audit_criterion")
    .column("audit_dimension_id")
    .execute();

  await db.schema
    .createIndex("idx_audit_checklist_item_criterion_id")
    .on("audit_checklist_item")
    .column("audit_criterion_id")
    .execute();

  await db.schema
    .createIndex("idx_audit_version_audit_id")
    .on("audit_version")
    .column("audit_id")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex("idx_audit_version_audit_id").ifExists().execute();
  await db.schema.dropIndex("idx_audit_checklist_item_criterion_id").ifExists().execute();
  await db.schema.dropIndex("idx_audit_criterion_dimension_id").ifExists().execute();
  await db.schema.dropIndex("idx_audit_dimension_audit_id").ifExists().execute();

  await db.schema.dropTable("audit_version").ifExists().execute();
  await db.schema.dropTable("audit_checklist_item").ifExists().execute();
  await db.schema.dropTable("audit_criterion").ifExists().execute();
  await db.schema.dropTable("audit_dimension").ifExists().execute();
  await db.schema.dropTable("audit").ifExists().execute();
}
