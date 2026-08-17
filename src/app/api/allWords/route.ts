import { assertCollectionOwned, CollectionNotFoundError, listWords } from "@/app/lib/dictionaryRepository"
import { getRequestSession } from "@/app/lib/session"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const session = await getRequestSession(req)
  if (!session) return new Response("Unauthorized", { status: 401 })

  const params = new URL(req.url).searchParams

  const cid = params.get("cid")
  if (!cid || isNaN(Number(cid))) {
    return new Response("Missing collection ID", { status: 400 })
  }

  try {
    await assertCollectionOwned(session.user.id, Number(cid))
    return Response.json(await listWords(session.user.id, Number(cid), params.get("info") === "true"))
  } catch (error) {
    if (error instanceof CollectionNotFoundError) return new Response("Not found", { status: 404 })
    throw error
  }
}
