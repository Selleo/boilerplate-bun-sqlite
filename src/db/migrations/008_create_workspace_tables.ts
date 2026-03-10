import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("workspace")
    .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("created_at", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn("updated_at", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addUniqueConstraint("ux_workspace_name", ["name"])
    .execute();

  await db.schema
    .createTable("workspace_member")
    .addColumn("workspace_id", "integer", (col) => col.notNull())
    .addColumn("user_id", "text", (col) => col.notNull())
    .addColumn("role", "text", (col) => col.notNull().defaultTo("workspace_manager"))
    .addColumn("created_at", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addCheckConstraint(
      "chk_workspace_member_role",
      sql`role in ('workspace_manager')`
    )
    .addPrimaryKeyConstraint("pk_workspace_member", ["workspace_id", "user_id"])
    .addForeignKeyConstraint(
      "fk_workspace_member_workspace_id",
      ["workspace_id"],
      "workspace",
      ["id"],
      (cb) => cb.onDelete("cascade")
    )
    .addForeignKeyConstraint(
      "fk_workspace_member_user_id",
      ["user_id"],
      "user",
      ["id"],
      (cb) => cb.onDelete("cascade")
    )
    .execute();

  await db.schema
    .createTable("workspace_entity")
    .addColumn("workspace_id", "integer", (col) => col.notNull())
    .addColumn("entity_id", "integer", (col) => col.notNull())
    .addColumn("created_at", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addPrimaryKeyConstraint("pk_workspace_entity", ["workspace_id", "entity_id"])
    .addForeignKeyConstraint(
      "fk_workspace_entity_workspace_id",
      ["workspace_id"],
      "workspace",
      ["id"],
      (cb) => cb.onDelete("cascade")
    )
    .addForeignKeyConstraint(
      "fk_workspace_entity_entity_id",
      ["entity_id"],
      "entity",
      ["id"],
      (cb) => cb.onDelete("cascade")
    )
    .execute();

  await db.schema
    .createIndex("idx_workspace_member_user_workspace")
    .on("workspace_member")
    .columns(["user_id", "workspace_id"])
    .execute();

  await db.schema
    .createIndex("idx_workspace_entity_entity")
    .on("workspace_entity")
    .column("entity_id")
    .execute();

  await db
    .executeQuery(
      sql`insert into workspace (name) values ('Default Workspace')`.compile(db)
    );
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex("idx_workspace_entity_entity").ifExists().execute();
  await db.schema.dropIndex("idx_workspace_member_user_workspace").ifExists().execute();
  await db.schema.dropTable("workspace_entity").ifExists().execute();
  await db.schema.dropTable("workspace_member").ifExists().execute();
  await db.schema.dropTable("workspace").ifExists().execute();
}
