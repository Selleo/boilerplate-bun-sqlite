import { Database } from "bun:sqlite";
import { BunSqliteDialect } from "kysely-bun-sqlite";
import { Kysely, type Migration, Migrator } from "kysely";
import fs from "node:fs";

import * as Mig001 from "./migrations/001_create_auth_tables.ts";

fs.mkdirSync("data", { recursive: true });

export async function migrateToLatest() {
  const db = new Kysely<Database>({
    dialect: new BunSqliteDialect({
      database: new Database("data/app.sqlite"),
    }),
  });

  const migrator = new Migrator({
    db,
    provider: {
      async getMigrations(): Promise<Record<string, Migration>> {
        return {
          "001": Mig001,
        };
      },
    },
  });

  const { error, results } = await migrator.migrateToLatest();

  results?.forEach((it) => {
    if (it.status === "Success") {
      console.log(`migration "${it.migrationName}" was executed successfully`);
    } else if (it.status === "Error") {
      console.error(`failed to execute migration "${it.migrationName}"`);
    }
  });

  if (error) {
    console.error("failed to migrate");
    console.error(error);
    process.exit(1);
  }

  await db.destroy();
}
