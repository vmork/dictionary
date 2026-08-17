import { fetchWordInfoFromWeb } from "@/app/lib/scraping"
import { APIError, NotFound } from "@/app/lib/types"
import { getRequestSession } from "@/app/lib/session"

// Ensure this route uses the Node.js runtime (cheerio & network scraping need Node, not Edge)
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const session = await getRequestSession(req)
  if (!session) return new Response("Unauthorized", { status: 401 })

  const params = new URL(req.url).searchParams
  const word = params.get("word")?.toLowerCase().trim()
  if (!word) return new Response("Missing word", { status: 400 })

  try {
    const result = await fetchWordInfoFromWeb(word)
    if (result instanceof NotFound) {
      return Response.json({ kind: "notfound", didYouMean: result.didYouMean, word: result.word })
    }
    if (result instanceof APIError) {
      return Response.json({ kind: "error", message: result.message }, { status: 500 })
    }
    return Response.json({ kind: "entry", entry: result })
  } catch (e: any) {
    return Response.json({ kind: "error", message: e?.message ?? "Unknown error" }, { status: 500 })
  }
}
