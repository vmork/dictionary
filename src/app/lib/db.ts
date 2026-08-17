import postgres from "postgres"

type Sql = ReturnType<typeof postgres>

const globalForDatabase = globalThis as typeof globalThis & {
  dictionarySql?: Sql
}

function getPoolSize() {
  const configuredSize = Number(process.env.DATABASE_POOL_SIZE ?? 5)
  return Number.isInteger(configuredSize) && configuredSize > 0 ? configuredSize : 5
}

export function getSql() {
  if (globalForDatabase.dictionarySql) return globalForDatabase.dictionarySql

  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured")
  }

  globalForDatabase.dictionarySql = postgres(connectionString, {
    max: getPoolSize(),
    connect_timeout: 10,
    idle_timeout: 20,
  })

  return globalForDatabase.dictionarySql
}

export async function closeSql() {
  if (!globalForDatabase.dictionarySql) return
  await globalForDatabase.dictionarySql.end({ timeout: 5 })
  delete globalForDatabase.dictionarySql
}
