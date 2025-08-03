import { sql } from "@vercel/postgres"
import { DictEntryFromNet } from "@/app/lib/dictionary/types"
import { CollectionID } from "@/app/lib/collections"

async function insertWord(cid: CollectionID, word: string, dictEntry: DictEntryFromNet, timeString: string) {
  console.log("addWord ", timeString)
  await sql`INSERT INTO words (word, dict_entry, time_added, collection_id) VALUES 
    (${word}, ${JSON.stringify(dictEntry)}, ${timeString}, ${cid})`
}

async function getWordInfo(cid: CollectionID, word: string): Promise<DictEntryFromNet | null> {
  const res = await sql`SELECT dict_entry FROM words WHERE word = ${word} AND collection_id = ${cid}`
  return res.rows?.[0]?.dict_entry ?? null
}

export async function POST(req: Request) {
  const body = await req.json()
  if (!body.cid || !body.word || !body.info || !body.timeString ) {
    return new Response(`Missing cid or word or info or timeString (url=${req.url})`, { status: 400 })
  }
  await insertWord(body.cid, body.word, body.info, body.timeString)
  return new Response("OK")
}

export async function DELETE(req: Request) {
  const params = new URL(req.url).searchParams
  const cid = params.get("cid")
  const word = params.get("word")
  if (!cid || isNaN(Number(cid)) || !word) return new Response(`Missing cid or word (url=${req.url})`, { status: 400 })
  await sql`DELETE FROM words WHERE word = ${word} AND collection_id = ${cid}`
  return new Response("OK")
}

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams
  const word = params.get("word")
  const cid = params.get("cid")
  if (!cid || isNaN(Number(cid)) || !word) return new Response(`Missing cid or word (url=${req.url})`, { status: 400 })
  const info = await getWordInfo(Number(cid), word)
  if (!info) return new Response(`Not found: ${word}`, { status: 404 })
  return Response.json(info)
}