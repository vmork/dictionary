import { fetchEtymologyTrees, getEtymologyTreeSource } from "@/app/lib/etymologyTree"
import { getRequestSession } from "@/app/lib/session"
import type { EtymologyTree } from "@/app/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type InFlightLookup = {
  controller: AbortController
  consumers: number
  promise: Promise<EtymologyTree[]>
  settled: boolean
}

const inFlightLookups = new Map<string, InFlightLookup>()

function startLookup(word: string): InFlightLookup {
  const controller = new AbortController()
  const promise = fetchEtymologyTrees(word, { signal: controller.signal })
  const lookup: InFlightLookup = {
    controller,
    consumers: 0,
    promise,
    settled: false,
  }

  lookup.promise = promise.finally(() => {
    lookup.settled = true
    if (inFlightLookups.get(word) === lookup) inFlightLookups.delete(word)
  })
  inFlightLookups.set(word, lookup)
  return lookup
}

async function fetchSharedEtymologyTrees(
  word: string,
  signal: AbortSignal
): Promise<EtymologyTree[]> {
  signal.throwIfAborted()
  const lookup = inFlightLookups.get(word) ?? startLookup(word)
  lookup.consumers += 1

  let rejectForAbort: (() => void) | undefined
  const callerAbort = new Promise<never>((_resolve, reject) => {
    rejectForAbort = () => reject(
      signal.reason ?? new DOMException("Request aborted", "AbortError")
    )
    if (signal.aborted) rejectForAbort()
    else signal.addEventListener("abort", rejectForAbort, { once: true })
  })

  try {
    return await Promise.race([lookup.promise, callerAbort])
  } finally {
    if (rejectForAbort) signal.removeEventListener("abort", rejectForAbort)
    lookup.consumers -= 1
    if (!lookup.settled && lookup.consumers === 0) {
      if (inFlightLookups.get(word) === lookup) inFlightLookups.delete(word)
      lookup.controller.abort(new DOMException("No active requests", "AbortError"))
    }
  }
}

export async function GET(request: Request) {
  const session = await getRequestSession(request)
  if (!session) return new Response("Unauthorized", { status: 401 })

  const word = new URL(request.url).searchParams.get("word")?.toLowerCase().trim()
  if (!word) return new Response("Missing word", { status: 400 })

  try {
    return Response.json({
      trees: await fetchSharedEtymologyTrees(word, request.signal),
      source: getEtymologyTreeSource(word),
    })
  } catch (error) {
    if (request.signal.aborted) return new Response(null, { status: 499 })

    console.error(
      `Etymology tree lookup failed for ${JSON.stringify(word)}:`,
      error instanceof Error ? error.message : "Unknown error"
    )
    return Response.json(
      { error: "Origin lookup is temporarily unavailable" },
      { status: 503, headers: { "Retry-After": "2" } }
    )
  }
}
