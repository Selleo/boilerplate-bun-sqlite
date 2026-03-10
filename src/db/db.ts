import { Database } from "bun:sqlite";
import { BunSqliteDialect } from "kysely-bun-sqlite";
import {
  Kysely,
  type Migration,
  Migrator,
} from 'kysely'
import fs from "node:fs"

import * as Mig001 from "./migrations/001_create_auth_tables.ts"
import * as Mig002 from "./migrations/002_create_audit_tables.ts"
import * as Mig003 from "./migrations/003_create_assessment_tables.ts"
import * as Mig004 from "./migrations/004_add_assessment_share_hash.ts"
import * as Mig005 from "./migrations/005_add_assessment_score_json.ts"
import * as Mig006 from "./migrations/006_add_assessment_grade.ts"
import * as Mig007 from "./migrations/007_add_entity_type.ts"
import * as Mig008 from "./migrations/008_create_workspace_tables.ts"
import * as Mig009 from "./migrations/009_add_user_roles.ts"
import * as Mig010 from "./migrations/010_add_audit_manager_role.ts"
import * as Mig011 from "./migrations/011_create_workspace_audit_table.ts"
import * as Mig012 from "./migrations/012_add_assessment_workspace_id.ts"

fs.mkdirSync("data", { recursive: true });

export async function migrateToLatest() {
  const db = new Kysely<Database>({
    dialect: new BunSqliteDialect({
      database: new Database('data/app.sqlite')
    }),
  })

  const migrator = new Migrator({
    db,
    provider: {
      async getMigrations(): Promise<Record<string, Migration>> {
        return {
          "001": Mig001,
          "002": Mig002,
          "003": Mig003,
          "004": Mig004,
          "005": Mig005,
          "006": Mig006,
          "007": Mig007,
          "008": Mig008,
          "009": Mig009,
          "010": Mig010,
          "011": Mig011,
          "012": Mig012,
        }
      },
    },
  })

  const { error, results } = await migrator.migrateToLatest()

  results?.forEach((it) => {
    if (it.status === 'Success') {
      console.log(`migration "${it.migrationName}" was executed successfully`)
    } else if (it.status === 'Error') {
      console.error(`failed to execute migration "${it.migrationName}"`)
    }
  })

  if (error) {
    console.error('failed to migrate')
    console.error(error)
    process.exit(1)
  }

  await db.destroy()
}
