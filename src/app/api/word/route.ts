import { sql } from "@vercel/postgres"
import { WordInfo } from "../../lib/scraping"

async function addWord(word: string, wordInfo: WordInfo) {
  await sql`INSERT INTO words (word, dict_entry) VALUES (${word}, ${JSON.stringify(wordInfo)})`
}

async function getWordInfo(word: string): Promise<WordInfo | null> {
  const res = await sql`SELECT dict_entry FROM words WHERE word = ${word}`
  return res.rows?.[0]?.dict_entry ?? null
}

export async function POST(req: Request) {
  const body = await req.json()
  if (!body.word || !body.info) return new Response(`Missing word or info (url=${req.url})`, { status: 400 })
  await addWord(body.word, body.info)
  return new Response("OK")
}

export async function DELETE(req: Request) {
  const word = new URL(req.url).searchParams.get("word")
  if (!word) return new Response(`Missing word (url=${req.url})`, { status: 400 })
  await sql`DELETE FROM words WHERE word = ${word}`
  return new Response("OK")
}

export async function GET(req: Request) {
  const word = new URL(req.url).searchParams.get("word")
  if (!word) return new Response(`Missing word (url=${req.url})`, { status: 400 })
  const info = await getWordInfo(word)
  if (!info) return new Response(`Not found: ${word}`, { status: 404 })
  return Response.json(info)
}

