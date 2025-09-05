import { sql } from "@vercel/postgres"
import { DictEntryFromNet } from "@/app/lib/types"
import { CollectionID } from "@/app/lib/collections"
import { PracticeData } from "@/app/lib/types"

async function insertWord(cid: CollectionID, word: string, dictEntry: DictEntryFromNet, timeString: string) {
  console.log("addWord ", timeString)
  await sql`INSERT INTO words (word, dict_entry, time_added, collection_id, practice_data) VALUES 
    (${word}, ${JSON.stringify(dictEntry)}, ${timeString}, ${cid}, ${JSON.stringify({ numSeen: 0, lastFive: [], numCorrect: 0 })})`
}

async function updatePracticeData(cid: CollectionID, word: string, practiceData: PracticeData) {
  await sql`UPDATE words SET practice_data = ${JSON.stringify(practiceData)} WHERE word = ${word} AND collection_id = ${cid}`
}

async function resetAllPracticeData(cid: CollectionID) {
  const defaultPracticeData = { numSeen: 0, lastFive: [], numCorrect: 0 }
  await sql`UPDATE words SET practice_data = ${JSON.stringify(defaultPracticeData)} WHERE collection_id = ${cid}`
}

async function getWordInfo(cid: CollectionID, word: string): Promise<DictEntryFromNet | null> {
  const res = await sql`SELECT dict_entry FROM words WHERE word = ${word} AND collection_id = ${cid}`
  return res.rows?.[0]?.dict_entry ?? null
}

export async function POST(req: Request) {
  const body = await req.json()
  
  // Handle practice data updates
  if (body.action === "updatePracticeData") {
    if (!body.cid || !body.word || !body.practiceData) {
      return new Response(`Missing cid, word, or practiceData`, { status: 400 })
    }
    await updatePracticeData(body.cid, body.word, body.practiceData)
    return new Response("OK")
  }

  // Handle resetting all practice data
  if (body.action === "resetAllPracticeData") {
    if (!body.cid) {
      return new Response(`Missing cid`, { status: 400 })
    }
    await resetAllPracticeData(body.cid)
    return new Response("OK")
  }
  
  // Handle adding new words
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