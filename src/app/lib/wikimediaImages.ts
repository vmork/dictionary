import { parse } from "node-html-parser"

export const WIKIMEDIA_IMAGE_SOURCES = ["wiktionary", "wikipedia"] as const

export type WikimediaImageSource = (typeof WIKIMEDIA_IMAGE_SOURCES)[number]

export type WordImage = {
  source: WikimediaImageSource
  sourceTitle: string
  sourcePageUrl: string
  filePageUrl: string
  imageUrl: string
  width: number
  height: number
  alt: string
  creator?: string
  license?: string
  licenseUrl?: string
}

type WikimediaFetchInit = RequestInit & {
  next?: { revalidate: number }
}

export type WikimediaFetcher = (
  input: string | URL | Request,
  init?: WikimediaFetchInit
) => Promise<Response>

type SourceConfig = {
  hostname: string
  title: string
}

const SOURCE_CONFIG: Record<WikimediaImageSource, SourceConfig> = {
  wiktionary: { hostname: "en.wiktionary.org", title: "Wiktionary" },
  wikipedia: { hostname: "en.wikipedia.org", title: "Wikipedia" },
}

const CACHE_SECONDS = 60 * 60 * 24 * 7
const USER_AGENT = "Dictionary/1.0 (https://dictionary.vmork.com)"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function readString(record: Record<string, unknown>, key: string) {
  return typeof record[key] === "string" ? record[key] : undefined
}

function cleanMetadataText(value: unknown) {
  if (!isRecord(value) || typeof value.value !== "string") return undefined
  const text = parse(value.value).text.replace(/\s+/g, " ").trim()
  return text || undefined
}

function cleanHttpsUrl(value: unknown) {
  if (!isRecord(value) || typeof value.value !== "string") return undefined
  try {
    const url = new URL(value.value)
    return url.protocol === "https:" ? url.toString() : undefined
  } catch {
    return undefined
  }
}

function wikiPageUrl(hostname: string, title: string) {
  return `https://${hostname}/wiki/${encodeURIComponent(title.replaceAll(" ", "_"))}`
}

function imageAlt(filename: string, word: string) {
  const description = filename
    .replace(/\.[^.]+$/, "")
    .replaceAll("_", " ")
    .replace(/\s+/g, " ")
    .trim()
  return description || `Illustration of ${word}`
}

function imageQueryUrl(hostname: string, word: string) {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    prop: "pageimages",
    titles: word,
    redirects: "1",
    piprop: "thumbnail|name",
    pithumbsize: "640",
    pilicense: "free",
  })
  return `https://${hostname}/w/api.php?${params}`
}

function metadataQueryUrl(hostname: string, filename: string) {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    prop: "imageinfo",
    titles: `File:${filename}`,
    iiprop: "extmetadata",
    iiextmetadatafilter: "Artist|LicenseShortName|LicenseUrl",
  })
  return `https://${hostname}/w/api.php?${params}`
}

async function fetchJson(url: string, fetcher: WikimediaFetcher, timeoutMs: number): Promise<unknown> {
  const response = await fetcher(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    next: { revalidate: CACHE_SECONDS },
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) throw new Error(`Wikimedia request failed with status ${response.status}`)
  return response.json() as Promise<unknown>
}

function parsePageImage(payload: unknown) {
  if (!isRecord(payload) || !isRecord(payload.query) || !Array.isArray(payload.query.pages)) return null
  const page = payload.query.pages[0]
  if (!isRecord(page) || page.missing === true || typeof page.title !== "string") return null
  if (!isRecord(page.thumbnail) || typeof page.pageimage !== "string") return null

  const imageUrl = readString(page.thumbnail, "source")
  const width = page.thumbnail.width
  const height = page.thumbnail.height
  if (!imageUrl || typeof width !== "number" || typeof height !== "number" || width <= 0 || height <= 0) return null

  return { title: page.title, filename: page.pageimage, imageUrl, width, height }
}

function parseImageMetadata(payload: unknown) {
  if (!isRecord(payload) || !isRecord(payload.query) || !Array.isArray(payload.query.pages)) return {}
  const page = payload.query.pages[0]
  if (!isRecord(page) || !Array.isArray(page.imageinfo)) return {}
  const imageInfo = page.imageinfo[0]
  if (!isRecord(imageInfo) || !isRecord(imageInfo.extmetadata)) return {}

  return {
    creator: cleanMetadataText(imageInfo.extmetadata.Artist),
    license: cleanMetadataText(imageInfo.extmetadata.LicenseShortName),
    licenseUrl: cleanHttpsUrl(imageInfo.extmetadata.LicenseUrl),
  }
}

export function isWikimediaImageSource(value: string | null): value is WikimediaImageSource {
  return WIKIMEDIA_IMAGE_SOURCES.some((source) => source === value)
}

export async function fetchWordImage(
  word: string,
  source: WikimediaImageSource,
  fetcher: WikimediaFetcher = fetch
): Promise<WordImage | null> {
  const config = SOURCE_CONFIG[source]
  const imagePayload = await fetchJson(imageQueryUrl(config.hostname, word), fetcher, 3_000)
  const image = parsePageImage(imagePayload)
  if (!image) return null

  let metadata: ReturnType<typeof parseImageMetadata> = {}
  try {
    const metadataPayload = await fetchJson(metadataQueryUrl(config.hostname, image.filename), fetcher, 2_000)
    metadata = parseImageMetadata(metadataPayload)
  } catch {
    // The source file page remains available when optional attribution metadata is temporarily unavailable.
  }

  return {
    source,
    sourceTitle: config.title,
    sourcePageUrl: wikiPageUrl(config.hostname, image.title),
    filePageUrl: wikiPageUrl(config.hostname, `File:${image.filename}`),
    imageUrl: image.imageUrl,
    width: image.width,
    height: image.height,
    alt: imageAlt(image.filename, word),
    ...metadata,
  }
}
