import "dotenv/config"
import { randomUUID } from "node:crypto"
import { hashPassword } from "better-auth/crypto"
import { closeSql, getSql } from "../lib/db"

async function promptForPassword() {
  if (process.env.AUTH_USER_PASSWORD) return process.env.AUTH_USER_PASSWORD
  if (!process.stdin.isTTY || !process.stdin.setRawMode) {
    throw new Error("Run from an interactive terminal or set AUTH_USER_PASSWORD temporarily")
  }

  process.stdout.write("New password (12+ characters): ")
  process.stdin.setRawMode(true)
  process.stdin.resume()
  process.stdin.setEncoding("utf8")
  return new Promise<string>((resolve, reject) => {
    let password = ""
    const finish = (error?: Error) => {
      process.stdin.setRawMode(false)
      process.stdin.pause()
      process.stdin.removeListener("data", onData)
      process.stdout.write("\n")
      if (error) reject(error)
      else resolve(password)
    }
    const onData = (chunk: string) => {
      for (const character of chunk) {
        if (character === "\u0003") return finish(new Error("Cancelled"))
        if (character === "\r" || character === "\n") return finish()
        if (character === "\u007f") password = password.slice(0, -1)
        else if (character >= " ") password += character
      }
    }
    process.stdin.on("data", onData)
  })
}

async function main() {
  const emailIndex = process.argv.indexOf("--email")
  const email = emailIndex === -1 ? "" : process.argv[emailIndex + 1]?.trim().toLowerCase()
  if (!email) throw new Error("Provide --email")

  const sql = getSql()
  const users = await sql<{ id: string }[]>`SELECT id FROM auth_users WHERE lower(email) = ${email}`
  if (users.length !== 1) throw new Error("User not found")
  const password = await promptForPassword()
  if (password.length < 12) throw new Error("Password must contain at least 12 characters")

  const hashedPassword = await hashPassword(password)
  await sql.begin(async (transaction) => {
    const updated = await transaction`
      UPDATE auth_accounts
      SET password = ${hashedPassword}, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ${users[0].id} AND provider_id = 'credential'
      RETURNING id
    `
    if (!updated.length) {
      await transaction`
        INSERT INTO auth_accounts (
          id, account_id, provider_id, user_id, password, created_at, updated_at
        ) VALUES (
          ${randomUUID()}, ${users[0].id}, 'credential', ${users[0].id},
          ${hashedPassword}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `
    }
    await transaction`DELETE FROM auth_sessions WHERE user_id = ${users[0].id}`
  })
  console.log(`Password reset for ${email}; existing sessions revoked`)
  await closeSql()
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
