import "dotenv/config"
import { randomUUID } from "node:crypto"
import { hashPassword } from "better-auth/crypto"
import { closeSql, getSql } from "../lib/db"

const defaultEmail = "codex-dev@dictionary.invalid"
const defaultName = "Codex development"

function readConfiguration() {
  if (process.env.DICTIONARY_ENABLE_DEV_ACCOUNT !== "1") {
    throw new Error("Refusing to prepare a development account without DICTIONARY_ENABLE_DEV_ACCOUNT=1")
  }

  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error("DATABASE_URL is not configured")

  const databaseUrl = new URL(connectionString)
  const databaseName = decodeURIComponent(databaseUrl.pathname.replace(/^\/+/, ""))
  const localHosts = new Set(["127.0.0.1", "localhost", "[::1]"])

  if (!localHosts.has(databaseUrl.hostname)) {
    throw new Error(`Refusing to prepare a development account through non-local host ${databaseUrl.hostname}`)
  }
  if (!/(^|[_-])(dev|test)([_-]|$)/i.test(databaseName)) {
    throw new Error(`Refusing to prepare a development account in database ${databaseName}`)
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to prepare a development account with NODE_ENV=production")
  }

  const email = (process.env.DICTIONARY_DEV_EMAIL ?? defaultEmail).trim().toLowerCase()
  const name = (process.env.DICTIONARY_DEV_NAME ?? defaultName).trim()
  const password = process.env.DICTIONARY_DEV_PASSWORD ?? ""

  if (!email.includes("@")) throw new Error("DICTIONARY_DEV_EMAIL must be a valid email address")
  if (!name) throw new Error("DICTIONARY_DEV_NAME is required")
  if (password.length < 12) throw new Error("DICTIONARY_DEV_PASSWORD must contain at least 12 characters")

  return { databaseName, email, name, password }
}

async function main() {
  const configuration = readConfiguration()
  const passwordHash = await hashPassword(configuration.password)
  const sql = getSql()

  const result = await sql.begin(async (transaction) => {
    const databaseRows = await transaction<{ database_name: string }[]>`
      SELECT current_database() AS database_name
    `
    if (databaseRows[0]?.database_name !== configuration.databaseName) {
      throw new Error("Connected database does not match DATABASE_URL")
    }

    const existingUsers = await transaction<{ id: string }[]>`
      SELECT id
      FROM auth_users
      WHERE lower(email) = ${configuration.email}
    `
    const userId = existingUsers[0]?.id ?? randomUUID()

    if (existingUsers.length === 0) {
      await transaction`
        INSERT INTO auth_users (id, name, email, email_verified, created_at, updated_at)
        VALUES (
          ${userId}, ${configuration.name}, ${configuration.email}, false,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `
    } else {
      await transaction`
        UPDATE auth_users
        SET name = ${configuration.name}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${userId}
      `
    }

    const credentialAccounts = await transaction<{ id: string }[]>`
      SELECT id
      FROM auth_accounts
      WHERE user_id = ${userId} AND provider_id = 'credential'
      ORDER BY created_at
    `
    if (credentialAccounts.length === 0) {
      await transaction`
        INSERT INTO auth_accounts (
          id, account_id, provider_id, user_id, password, created_at, updated_at
        ) VALUES (
          ${randomUUID()}, ${userId}, 'credential', ${userId}, ${passwordHash},
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `
    } else {
      await transaction`
        UPDATE auth_accounts
        SET password = ${passwordHash}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${credentialAccounts[0].id}
      `
      if (credentialAccounts.length > 1) {
        await transaction`
          DELETE FROM auth_accounts
          WHERE user_id = ${userId}
            AND provider_id = 'credential'
            AND id <> ${credentialAccounts[0].id}
        `
      }
    }

    const ownCollections = await transaction<{ count: number }[]>`
      SELECT COUNT(*)::integer AS count
      FROM collections
      WHERE owner_id = ${userId}
    `

    let claimedCollections = 0
    if (ownCollections[0]?.count === 0) {
      const sourceOwners = await transaction<{ owner_id: string }[]>`
        SELECT c.owner_id
        FROM collections c
        LEFT JOIN words w ON w.collection_id = c.id
        WHERE c.owner_id <> ${userId}
        GROUP BY c.owner_id
        ORDER BY COUNT(w.id) DESC, COUNT(DISTINCT c.id) DESC
        LIMIT 1
      `
      if (sourceOwners[0]) {
        const claimed = await transaction`
          UPDATE collections
          SET owner_id = ${userId}
          WHERE owner_id = ${sourceOwners[0].owner_id}
          RETURNING id
        `
        claimedCollections = claimed.length
      }
    }

    // A copied production password or session should never be usable in development.
    await transaction`DELETE FROM auth_sessions`
    await transaction`
      DELETE FROM auth_accounts
      WHERE provider_id = 'credential' AND user_id <> ${userId}
    `
    await transaction`DELETE FROM auth_rate_limits`

    const collections = await transaction<{ collection_count: number; word_count: number }[]>`
      SELECT
        COUNT(DISTINCT c.id)::integer AS collection_count,
        COUNT(w.id)::integer AS word_count
      FROM collections c
      LEFT JOIN words w ON w.collection_id = c.id
      WHERE c.owner_id = ${userId}
    `

    return {
      claimedCollections,
      collectionCount: collections[0]?.collection_count ?? 0,
      wordCount: collections[0]?.word_count ?? 0,
    }
  })

  console.log(
    `Prepared ${configuration.email} in ${configuration.databaseName}: ` +
      `${result.collectionCount} collection(s), ${result.wordCount} word(s)` +
      (result.claimedCollections ? `; assigned ${result.claimedCollections} collection(s) from the cloned owner` : "")
  )
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(closeSql)
