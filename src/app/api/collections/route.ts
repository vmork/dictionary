import {
  CollectionNotEmptyError,
  CollectionNotFoundError,
  createCollection,
  deleteEmptyCollection,
  listCollections,
} from "@/app/lib/dictionaryRepository"
import { Language } from "@/app/lib/collections"
import { getRequestSession } from "@/app/lib/session"

export const dynamic = "force-dynamic"

const languages = new Set<Language>(["english", "french", "spanish", "german"])

export async function GET(request: Request) {
  const session = await getRequestSession(request)
  if (!session) return new Response("Unauthorized", { status: 401 })
  return Response.json(await listCollections(session.user.id))
}

export async function POST(request: Request) {
  const session = await getRequestSession(request)
  if (!session) return new Response("Unauthorized", { status: 401 })

  const body = await request.json().catch(() => null)
  const name = typeof body?.name === "string" ? body.name.trim() : ""
  const type = body?.type === "translations" ? "translations" : body?.type === "dictionary" ? "dictionary" : null
  const lang1 = languages.has(body?.lang1) ? (body.lang1 as Language) : null
  const lang2 = body?.lang2 == null ? null : languages.has(body.lang2) ? (body.lang2 as Language) : null

  if (!name || name.length > 100 || !type || !lang1 || (type === "translations" && !lang2)) {
    return new Response("Invalid collection", { status: 400 })
  }

  try {
    const collection = await createCollection(session.user.id, { name, type, lang1, lang2 })
    return Response.json(collection, { status: 201 })
  } catch (error: any) {
    if (error?.code === "23505") return new Response("A collection with that name already exists", { status: 409 })
    throw error
  }
}

export async function DELETE(request: Request) {
  const session = await getRequestSession(request)
  if (!session) return new Response("Unauthorized", { status: 401 })

  const cid = Number(new URL(request.url).searchParams.get("cid"))
  if (!Number.isInteger(cid) || cid <= 0) return new Response("Invalid collection ID", { status: 400 })

  try {
    await deleteEmptyCollection(session.user.id, cid)
    return new Response(null, { status: 204 })
  } catch (error) {
    if (error instanceof CollectionNotFoundError) return new Response("Not found", { status: 404 })
    if (error instanceof CollectionNotEmptyError) return new Response("Only empty collections can be removed", { status: 409 })
    throw error
  }
}
