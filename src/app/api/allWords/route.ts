import { CollectionID } from "@/app/lib/collections"
import { db } from "@vercel/postgres"

async function getWordList(cid: CollectionID) {
  const client = await db.connect()
  const res = await client.sql`SELECT word FROM words WHERE collection_id = ${cid}`
  return res.rows.map((row) => row.word)
}

async function getAllData(cid: CollectionID) {
  const client = await db.connect()
  const res = await client.sql`SELECT * FROM words WHERE collection_id = ${cid}`
  return res.rows
}

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams

  const cid = params.get("cid")
  if (!cid || isNaN(Number(cid))) {
    return new Response("Missing collection ID", { status: 400 })
  }

  const includeInfo = params.get("info") === "true"
  if (includeInfo) {
    return Response.json(await getAllData(Number(cid)))
  }
  return Response.json(await getWordList(Number(cid)))
}