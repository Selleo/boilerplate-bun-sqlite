import type { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("user")
    .addColumn("id", "text", (col) => col.notNull())
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("email", "text", (col) => col.notNull())
    .addColumn("emailVerified", "integer", (col) => col.notNull())
    .addColumn("image", "text")
    .addColumn("createdAt", "date", (col) => col.notNull())
    .addColumn("updatedAt", "date", (col) => col.notNull())
    .addPrimaryKeyConstraint("pk_user", ["id"])
    .execute();

  await db.schema
    .createIndex("idx_user_email")
    .on("user")
    .column("email")
    .unique()
    .execute();

  await db.schema
    .createTable("session")
    .addColumn("id", "text", (col) => col.notNull())
    .addColumn("expiresAt", "date", (col) => col.notNull())
    .addColumn("token", "text", (col) => col.notNull())
    .addColumn("createdAt", "date", (col) => col.notNull())
    .addColumn("updatedAt", "date", (col) => col.notNull())
    .addColumn("ipAddress", "text")
    .addColumn("userAgent", "text")
    .addColumn("userId", "text", (col) => col.notNull())
    .addPrimaryKeyConstraint("pk_session", ["id"])
    .addForeignKeyConstraint(
      "fk_session_userId",
      ["userId"],
      "user",
      ["id"],
      (cb) => cb.onDelete("cascade")
    )
    .execute();

  await db.schema
    .createIndex("idx_session_token")
    .on("session")
    .column("token")
    .unique()
    .execute();

  await db.schema
    .createIndex("idx_session_userId")
    .on("session")
    .column("userId")
    .execute();

  await db.schema
    .createTable("account")
    .addColumn("id", "text", (col) => col.notNull())
    .addColumn("accountId", "text", (col) => col.notNull())
    .addColumn("providerId", "text", (col) => col.notNull())
    .addColumn("userId", "text", (col) => col.notNull())
    .addColumn("accessToken", "text")
    .addColumn("refreshToken", "text")
    .addColumn("idToken", "text")
    .addColumn("accessTokenExpiresAt", "date")
    .addColumn("refreshTokenExpiresAt", "date")
    .addColumn("scope", "text")
    .addColumn("password", "text")
    .addColumn("createdAt", "date", (col) => col.notNull())
    .addColumn("updatedAt", "date", (col) => col.notNull())
    .addPrimaryKeyConstraint("pk_account", ["id"])
    .addForeignKeyConstraint(
      "fk_account_userId",
      ["userId"],
      "user",
      ["id"],
      (cb) => cb.onDelete("cascade")
    )
    .execute();

  await db.schema
    .createIndex("idx_account_userId")
    .on("account")
    .column("userId")
    .execute();

  await db.schema
    .createTable("verification")
    .addColumn("id", "text", (col) => col.notNull())
    .addColumn("identifier", "text", (col) => col.notNull())
    .addColumn("value", "text", (col) => col.notNull())
    .addColumn("expiresAt", "date", (col) => col.notNull())
    .addColumn("createdAt", "date", (col) => col.notNull())
    .addColumn("updatedAt", "date", (col) => col.notNull())
    .addPrimaryKeyConstraint("pk_verification", ["id"])
    .execute();

  await db.schema
    .createIndex("idx_verification_identifier")
    .on("verification")
    .column("identifier")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex("idx_verification_identifier").ifExists().execute();
  await db.schema.dropTable("verification").ifExists().execute();

  await db.schema.dropIndex("idx_account_userId").ifExists().execute();
  await db.schema.dropTable("account").ifExists().execute();

  await db.schema.dropIndex("idx_session_userId").ifExists().execute();
  await db.schema.dropIndex("idx_session_token").ifExists().execute();
  await db.schema.dropTable("session").ifExists().execute();

  await db.schema.dropIndex("idx_user_email").ifExists().execute();
  await db.schema.dropTable("user").ifExists().execute();
}
