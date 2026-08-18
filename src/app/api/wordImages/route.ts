import { fetchWordImage, isWikimediaImageSource } from "@/app/lib/wikimediaImages"
import { getRequestSession } from "@/app/lib/session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const session = await getRequestSession(request)
  if (!session) return new Response("Unauthorized", { status: 401 })

  const params = new URL(request.url).searchParams
  const word = params.get("word")?.toLowerCase().trim()
  const source = params.get("source")
  if (!word || word.length > 100 || !/[\p{L}\p{N}]/u.test(word)) {
    return new Response("Invalid word", { status: 400 })
  }
  if (!isWikimediaImageSource(source)) {
    return new Response("Invalid source", { status: 400 })
  }

  try {
    return Response.json(
      { image: await fetchWordImage(word, source) },
      { headers: { "Cache-Control": "private, max-age=3600" } }
    )
  } catch {
    return Response.json({ message: "Image source unavailable" }, { status: 502 })
  }
}
