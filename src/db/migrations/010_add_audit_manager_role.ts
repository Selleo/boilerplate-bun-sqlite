import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("user_role_new")
    .addColumn("user_id", "text", (col) => col.notNull().primaryKey())
    .addColumn("role", "text", (col) => col.notNull().defaultTo("user"))
    .addColumn("created_at", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn("updated_at", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addCheckConstraint("chk_user_role_role", sql`role in ('admin', 'audit_manager', 'user')`)
    .addForeignKeyConstraint("fk_user_role_user_id", ["user_id"], "user", ["id"], (cb) =>
      cb.onDelete("cascade")
    )
    .execute();

  await db.executeQuery(
    sql`insert into user_role_new (user_id, role, created_at, updated_at)
        select user_id, role, created_at, updated_at
        from user_role`
      .compile(db)
  );

  await db.schema.dropTable("user_role").execute();
  await db.schema.alterTable("user_role_new").renameTo("user_role").execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("user_role_old")
    .addColumn("user_id", "text", (col) => col.notNull().primaryKey())
    .addColumn("role", "text", (col) => col.notNull().defaultTo("user"))
    .addColumn("created_at", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn("updated_at", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addCheckConstraint("chk_user_role_role", sql`role in ('admin', 'user')`)
    .addForeignKeyConstraint("fk_user_role_user_id", ["user_id"], "user", ["id"], (cb) =>
      cb.onDelete("cascade")
    )
    .execute();

  await db.executeQuery(
    sql`insert into user_role_old (user_id, role, created_at, updated_at)
        select
          user_id,
          case when role = 'audit_manager' then 'user' else role end,
          created_at,
          updated_at
        from user_role`
      .compile(db)
  );

  await db.schema.dropTable("user_role").execute();
  await db.schema.alterTable("user_role_old").renameTo("user_role").execute();
}
