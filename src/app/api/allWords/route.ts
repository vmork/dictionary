import { sql, db } from "@vercel/postgres"

async function getAllWords() {
  const client = await db.connect()
  const res = await client.sql`SELECT word FROM words`

  console.log(res.rows)
  return res.rows.map((row) => row.word)
}

export async function GET(req: Request) {
  const words = await getAllWords()
  return Response.json(words)
}