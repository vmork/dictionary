import "dotenv/config"
import { auth, closeAuthPool } from "../lib/auth"
import { closeSql, getSql } from "../lib/db"

function readOwner() {
  const email = process.env.AUTH_USER_EMAIL?.trim().toLowerCase() ?? ""
  const name = process.env.AUTH_USER_NAME?.trim() ?? ""
  const password = process.env.AUTH_USER_PASSWORD ?? ""

  if (!email || !email.includes("@")) throw new Error("AUTH_USER_EMAIL must be a valid email address")
  if (!name) throw new Error("AUTH_USER_NAME is required")
  if (password.length < 12) throw new Error("AUTH_USER_PASSWORD must contain at least 12 characters")

  return { email, name, password }
}

async function main() {
  const owner = readOwner()
  const result = await auth.api.signUpEmail({ body: owner })
  const sql = getSql()
  const claimed = await sql`
    UPDATE collections
    SET owner_id = ${result.user.id}
    WHERE owner_id IS NULL
    RETURNING id
  `

  console.log(`Created the owner account and claimed ${claimed.length} existing collection(s)`)
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await Promise.all([closeAuthPool(), closeSql()])
  })
