import { DictEntryFromNet } from "@/app/lib/types"
import { PracticeData } from "@/app/lib/types"
import {
  CollectionNotFoundError,
  deleteWord,
  getWordInfo,
  insertWord,
  resetAllPracticeData,
  updatePracticeData,
} from "@/app/lib/dictionaryRepository"
import { getRequestSession } from "@/app/lib/session"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const session = await getRequestSession(req)
  if (!session) return new Response("Unauthorized", { status: 401 })
  const body = await req.json()

  try {
    if (body.action === "updatePracticeData") {
      if (!body.cid || !body.word || !body.practiceData) {
        return new Response(`Missing cid, word, or practiceData`, { status: 400 })
      }
      await updatePracticeData(session.user.id, Number(body.cid), body.word, body.practiceData as PracticeData)
      return new Response("OK")
    }

    if (body.action === "resetAllPracticeData") {
      if (!body.cid) return new Response(`Missing cid`, { status: 400 })
      await resetAllPracticeData(session.user.id, Number(body.cid))
      return new Response("OK")
    }

    if (!body.cid || !body.word || !body.info || !body.timeString) {
      return new Response(`Missing cid or word or info or timeString`, { status: 400 })
    }
    await insertWord(session.user.id, Number(body.cid), body.word, body.info as DictEntryFromNet, body.timeString)
    return new Response("OK")
  } catch (error: any) {
    if (error instanceof CollectionNotFoundError) return new Response("Not found", { status: 404 })
    if (error?.code === "23505") return new Response("Word already exists", { status: 409 })
    throw error
  }
}

export async function DELETE(req: Request) {
  const session = await getRequestSession(req)
  if (!session) return new Response("Unauthorized", { status: 401 })
  const params = new URL(req.url).searchParams
  const cid = params.get("cid")
  const word = params.get("word")
  if (!cid || isNaN(Number(cid)) || !word) return new Response(`Missing cid or word (url=${req.url})`, { status: 400 })
  try {
    await deleteWord(session.user.id, Number(cid), word)
    return new Response("OK")
  } catch (error) {
    if (error instanceof CollectionNotFoundError) return new Response("Not found", { status: 404 })
    throw error
  }
}

export async function GET(req: Request) {
  const session = await getRequestSession(req)
  if (!session) return new Response("Unauthorized", { status: 401 })
  const params = new URL(req.url).searchParams
  const word = params.get("word")
  const cid = params.get("cid")
  if (!cid || isNaN(Number(cid)) || !word) return new Response(`Missing cid or word (url=${req.url})`, { status: 400 })
  const info = await getWordInfo(session.user.id, Number(cid), word)
  if (!info) return new Response(`Not found: ${word}`, { status: 404 })
  return Response.json(info)
}
