import { db } from "@vercel/postgres"

async function getWordList() {
  const client = await db.connect()
  const res = await client.sql`SELECT word FROM words`
  return res.rows.map((row) => row.word)
}

async function getAllData() {
  const client = await db.connect()
  const res = await client.sql`SELECT * FROM words`
  return res.rows
}

export async function GET(req: Request) {
  const includeInfo = new URL(req.url).searchParams.get("info") === "true"
  if (includeInfo) {
    return Response.json(await getAllData())
  }
  return Response.json(await getWordList())
}