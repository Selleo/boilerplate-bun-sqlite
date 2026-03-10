import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("user_role")
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
    sql`insert into user_role (user_id, role)
        select id, 'admin' from user`
      .compile(db)
  );
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("user_role").ifExists().execute();
}
