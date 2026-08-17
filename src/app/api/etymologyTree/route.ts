import { fetchEtymologyTrees, getEtymologyTreeSource } from "@/app/lib/etymologyTree"
import { getRequestSession } from "@/app/lib/session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const session = await getRequestSession(request)
  if (!session) return new Response("Unauthorized", { status: 401 })

  const word = new URL(request.url).searchParams.get("word")?.toLowerCase().trim()
  if (!word) return new Response("Missing word", { status: 400 })

  return Response.json({
    trees: await fetchEtymologyTrees(word),
    source: getEtymologyTreeSource(word),
  })
}
