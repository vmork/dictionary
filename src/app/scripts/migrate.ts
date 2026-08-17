import "dotenv/config"
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { closeSql, getSql } from "../lib/db"

async function main() {
  const migrationsDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../migrations")
  const throughIndex = process.argv.indexOf("--through")
  const through = throughIndex === -1 ? undefined : process.argv[throughIndex + 1]
  if (throughIndex !== -1 && !through) throw new Error("--through requires a migration filename")

  const allMigrations = (await readdir(migrationsDirectory)).filter((name) => name.endsWith(".sql")).sort()
  const migrations = through ? allMigrations.filter((name) => name <= through) : allMigrations
  if (through && !allMigrations.includes(through)) throw new Error(`Unknown migration: ${through}`)

  const sql = getSql()
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `
  const appliedRows = await sql<{ name: string }[]>`SELECT name FROM schema_migrations`
  const applied = new Set(appliedRows.map((row) => row.name))

  for (const migration of migrations) {
    if (applied.has(migration)) continue
    const contents = await readFile(path.join(migrationsDirectory, migration), "utf8")
    await sql.begin(async (transaction) => {
      await transaction.unsafe(contents, [], { prepare: false })
      await transaction`INSERT INTO schema_migrations (name) VALUES (${migration})`
    })
    console.log(`Applied ${migration}`)
  }

  await closeSql()
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
