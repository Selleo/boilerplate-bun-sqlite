import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("workspace_audit")
    .addColumn("workspace_id", "integer", (col) => col.notNull())
    .addColumn("audit_id", "integer", (col) => col.notNull())
    .addColumn("created_at", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addPrimaryKeyConstraint("pk_workspace_audit", ["workspace_id", "audit_id"])
    .addForeignKeyConstraint(
      "fk_workspace_audit_workspace_id",
      ["workspace_id"],
      "workspace",
      ["id"],
      (cb) => cb.onDelete("cascade")
    )
    .addForeignKeyConstraint(
      "fk_workspace_audit_audit_id",
      ["audit_id"],
      "audit",
      ["id"],
      (cb) => cb.onDelete("cascade")
    )
    .execute();

  await db.schema
    .createIndex("idx_workspace_audit_audit_id")
    .on("workspace_audit")
    .column("audit_id")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex("idx_workspace_audit_audit_id").ifExists().execute();
  await db.schema.dropTable("workspace_audit").ifExists().execute();
}
