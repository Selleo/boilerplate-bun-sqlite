import { Database } from "bun:sqlite";
import { Kysely } from "kysely";
import { BunSqliteDialect } from "kysely-bun-sqlite";
import type { DB } from "./types";

export function createDb(databasePath = "data/app.sqlite"): Kysely<DB> {
  return new Kysely<DB>({
    dialect: new BunSqliteDialect({
      database: new Database(databasePath),
    }),
  });
}

