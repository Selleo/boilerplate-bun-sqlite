# Database Migrations

## SQL

Always use singular table names.
Column names are underscore case.
Primary key constrains should start with `pk_` and foreign keys with `fk_`.
Indexes should start with `idx_`.
Migrations should be imported into code and added to provider map in correct order.

## Create A New Migration
- Add a new file in `src/db/migrations` with a numeric prefix, e.g. `002_add_users.ts`.
- Keep filenames lowercase with underscores.

## Write A Migration
- Export `up` and `down` functions.
- Use Kysely schema builder to create/alter/drop tables.
- Keep migrations idempotent and small.

## Example
```ts
import type { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("users")
    .addColumn("id", "text", col => col.primaryKey())
    .addColumn("email", "text", col => col.notNull().unique())
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable("users").execute();
}
```
