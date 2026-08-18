import type {
  EtymologyRelation,
  EtymologyTree,
  EtymologyTreeNode,
  LinkWithTitle,
} from "./types"

const KAIKKI_BASE_URL = "https://kaikki.org/dictionary/All%20languages%20combined/meaning"
const KAIKKI_REVALIDATE_SECONDS = 60 * 60 * 24 * 7
const MAX_RESPONSE_BYTES = 1_500_000
const MAX_TREE_DEPTH = 5
const MAX_TREE_NODES = 24
const MAX_TREES = 3
const TREE_TIMEOUT_MS = 10_000

const LANGUAGE_NAMES: Record<string, string> = {
  ang: "Old English",
  en: "English",
  enm: "Middle English",
  fr: "French",
  frm: "Middle French",
  fro: "Old French",
  gem: "Germanic",
  "gem-pro": "Proto-Germanic",
  "gmw-pro": "Proto-West Germanic",
  grc: "Ancient Greek",
  "grk-pro": "Proto-Hellenic",
  ine: "Indo-European",
  "ine-pro": "Proto-Indo-European",
  it: "Italian",
  "itc-pro": "Proto-Italic",
  la: "Latin",
}

export type KaikkiTemplate = {
  name: string
  args: Record<string, string>
}

type KaikkiEntry = {
  word: string
  lang: string
  langCode: string
  pos?: string
  forms: Array<{ form: string; tags: string[] }>
  etymologyTemplates: KaikkiTemplate[]
}

export type EtymologyParentReference = {
  word: string
  lookupWord: string
  languageCode: string
  relation: EtymologyRelation
  gloss?: string
  romanization?: string
  uncertain?: boolean
  stopRecursion?: boolean
  parents?: EtymologyParentReference[]
}

type BuildContext = {
  signal: AbortSignal
  fetchedEntries: Map<string, Promise<KaikkiEntry[]>>
  nodeCount: number
}

export type FetchEtymologyTreesOptions = {
  signal?: AbortSignal
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function getString(record: Record<string, unknown>, key: string): string | undefined {
  return typeof record[key] === "string" ? record[key] : undefined
}

function parseTemplate(value: unknown): KaikkiTemplate | null {
  const record = asRecord(value)
  if (!record) return null

  const name = getString(record, "name")
  const rawArgs = asRecord(record.args)
  if (!name || !rawArgs) return null

  const args: Record<string, string> = {}
  for (const [key, rawValue] of Object.entries(rawArgs)) {
    if (typeof rawValue === "string") args[key] = rawValue
  }

  return { name, args }
}

function parseForm(value: unknown): { form: string; tags: string[] } | null {
  const record = asRecord(value)
  if (!record) return null

  const form = getString(record, "form")
  if (!form) return null

  const tags = Array.isArray(record.tags)
    ? record.tags.filter((tag): tag is string => typeof tag === "string")
    : []
  return { form, tags }
}

export function parseKaikkiJsonLines(text: string): KaikkiEntry[] {
  const entries: KaikkiEntry[] = []

  for (const line of text.split("\n")) {
    if (!line.trim()) continue

    let value: unknown
    try {
      value = JSON.parse(line)
    } catch {
      continue
    }

    const record = asRecord(value)
    if (!record) continue

    const word = getString(record, "word")
    const lang = getString(record, "lang")
    const langCode = getString(record, "lang_code")
    if (!word || !lang || !langCode) continue

    const etymologyTemplates = Array.isArray(record.etymology_templates)
      ? record.etymology_templates
          .map(parseTemplate)
          .filter((template): template is KaikkiTemplate => template !== null)
      : []
    const forms = Array.isArray(record.forms)
      ? record.forms.map(parseForm).filter((form): form is { form: string; tags: string[] } => form !== null)
      : []

    entries.push({
      word,
      lang,
      langCode,
      pos: getString(record, "pos"),
      forms,
      etymologyTemplates,
    })
  }

  return entries
}

function relationFromCode(code: string): EtymologyRelation {
  const normalized = code.toLowerCase().replace(/^:/, "")

  if (["bor", "lbor", "obor", "ubor", "cal", "clq", "psm", "sl"].includes(normalized)) {
    return "borrowed"
  }
  if (normalized === "inh") return "inherited"
  if (
    [
      "af",
      "affix",
      "back-form",
      "blend",
      "clipping",
      "com",
      "compound",
      "confix",
      "prefix",
      "suffix",
      "univerbation",
    ].includes(normalized)
  ) {
    return "formed"
  }
  return "derived"
}

function extractInlineAnnotation(raw: string, name: string): string | undefined {
  const marker = `<${name}:`
  const start = raw.indexOf(marker)
  if (start === -1) return undefined

  const valueStart = start + marker.length
  const end = raw.indexOf(">", valueStart)
  if (end === -1) return undefined
  return raw.slice(valueStart, end).trim() || undefined
}

function parseAnnotatedTerm(
  raw: string,
  fallbackLanguageCode: string,
  relation: EtymologyRelation
): EtymologyParentReference | null {
  const trimmed = raw.trim()
  if (!trimmed || trimmed === "-") return null

  const annotationStart = trimmed.indexOf("<")
  let term = (annotationStart === -1 ? trimmed : trimmed.slice(0, annotationStart)).trim()
  let languageCode = fallbackLanguageCode

  const languageSeparator = term.indexOf(":")
  if (languageSeparator > 0) {
    const possibleLanguageCode = term.slice(0, languageSeparator)
    if (/^[a-z][a-z0-9-]*$/i.test(possibleLanguageCode)) {
      languageCode = possibleLanguageCode
      term = term.slice(languageSeparator + 1)
    }
  }

  term = term.trim()
  if (!term) return null

  return {
    word: term,
    lookupWord: term,
    languageCode,
    relation,
    gloss: extractInlineAnnotation(trimmed, "t"),
    romanization: extractInlineAnnotation(trimmed, "tr"),
    uncertain: trimmed.includes("<q:uncertain>") || trimmed.includes("<qq:uncertain>"),
    stopRecursion: term.startsWith("-") || term.endsWith("-"),
  }
}

function numericArgs(args: Record<string, string>, start: number): Array<[number, string]> {
  return Object.entries(args)
    .map(([key, value]): [number, string] => [Number(key), value])
    .filter(([index, value]) => Number.isInteger(index) && index >= start && Boolean(value.trim()))
    .sort(([left], [right]) => left - right)
}

function extractEtyReferences(template: KaikkiTemplate): EtymologyParentReference[] {
  const currentLanguageCode = template.args["1"]
  if (!currentLanguageCode) return []

  const relation = relationFromCode(template.args["2"] ?? "derived")
  return numericArgs(template.args, 3)
    .map(([, raw]) => parseAnnotatedTerm(raw, currentLanguageCode, relation))
    .filter((reference): reference is EtymologyParentReference => reference !== null)
}

const DIRECT_RELATION_TEMPLATES = new Set([
  "bor",
  "cal",
  "clq",
  "der",
  "inh",
  "lbor",
  "obor",
  "psm",
  "sl",
  "ubor",
  "uder",
])

function extractDirectReference(template: KaikkiTemplate): EtymologyParentReference[] {
  const name = template.name.toLowerCase()
  if (!DIRECT_RELATION_TEMPLATES.has(name) && name !== "root") return []

  const sourceLanguageCode = template.args["2"]
  const rawTerm = template.args["3"] || template.args["4"]
  if (!sourceLanguageCode || !rawTerm) return []

  const parsed = parseAnnotatedTerm(rawTerm, sourceLanguageCode, relationFromCode(name))
  if (!parsed) return []

  const positionalAlt = template.args["3"] ? template.args["4"] : undefined
  const displayWord = template.args.alt || positionalAlt || parsed.word
  return [{
    ...parsed,
    word: displayWord,
    gloss: template.args.t || template.args.gloss || template.args["5"] || parsed.gloss,
    romanization: template.args.tr || parsed.romanization,
    uncertain: parsed.uncertain || template.args.uncertain === "1" || template.args.nocap === "uncertain",
  }]
}

const FORMATION_TEMPLATES = new Set([
  "affix",
  "back-form",
  "blend",
  "clipping",
  "com",
  "compound",
  "confix",
  "prefix",
  "suffix",
  "univerbation",
])

function extractFormationReferences(template: KaikkiTemplate): EtymologyParentReference[] {
  const name = template.name.toLowerCase()
  if (!FORMATION_TEMPLATES.has(name)) return []

  const languageCode = template.args["1"]
  if (!languageCode) return []

  const components = numericArgs(template.args, 2)
  return components.flatMap(([index, rawTerm], componentIndex) => {
    const parsed = parseAnnotatedTerm(rawTerm, languageCode, "formed")
    if (!parsed) return []

    let lookupWord = parsed.lookupWord
    let displayWord = template.args[`alt${componentIndex + 1}`] || parsed.word
    if (name === "suffix" && index === components.at(-1)?.[0] && !displayWord.startsWith("-")) {
      displayWord = `-${displayWord}`
      lookupWord = `-${lookupWord}`
    }
    if (name === "prefix" && index === components[0]?.[0] && !displayWord.endsWith("-")) {
      displayWord = `${displayWord}-`
      lookupWord = `${lookupWord}-`
    }

    return [{
      ...parsed,
      word: displayWord,
      lookupWord,
      gloss: template.args[`t${componentIndex + 1}`] || template.args[`gloss${componentIndex + 1}`] || parsed.gloss,
      romanization: template.args[`tr${componentIndex + 1}`] || parsed.romanization,
      stopRecursion: lookupWord.startsWith("-") || lookupWord.endsWith("-"),
    }]
  })
}

function referenceKey(reference: EtymologyParentReference): string {
  const parents = reference.parents?.map(referenceKey).sort().join("|") ?? ""
  return `${reference.languageCode}:${reference.lookupWord}:${reference.relation}:[${parents}]`
}

function dedupeReferences(references: EtymologyParentReference[]): EtymologyParentReference[] {
  const seen = new Set<string>()
  return references.filter((reference) => {
    const key = referenceKey(reference)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function chainDirectReferences(references: EtymologyParentReference[]): EtymologyParentReference[] {
  if (references.length < 2) return references

  let chain = references.at(-1) as EtymologyParentReference
  for (let index = references.length - 2; index >= 0; index -= 1) {
    chain = { ...references[index], parents: [chain] }
  }
  return [chain]
}

export function extractEtymologyParentReferences(templates: KaikkiTemplate[]): EtymologyParentReference[] {
  const treeReferences = templates
    .filter((template) => ["ety", "etymon"].includes(template.name.toLowerCase()))
    .flatMap(extractEtyReferences)
  if (treeReferences.length > 0) return dedupeReferences(treeReferences)

  const directReferences = dedupeReferences(templates
    .filter((template) => template.name.toLowerCase() !== "root")
    .flatMap(extractDirectReference))
  const formationReferences = dedupeReferences(templates.flatMap(extractFormationReferences))
  if (directReferences.length > 0 || formationReferences.length > 0) {
    return dedupeReferences([
      ...chainDirectReferences(directReferences),
      ...formationReferences,
    ])
  }

  return dedupeReferences(
    templates
      .filter((template) => template.name.toLowerCase() === "root")
      .flatMap(extractDirectReference)
  )
}

function stripDiacritics(word: string): string {
  return word.normalize("NFD").replace(/\p{M}+/gu, "").normalize("NFC")
}

function kaikkiWordUrl(word: string, extension: "html" | "jsonl"): string | null {
  const characters = Array.from(word)
  if (characters.length === 0) return null

  const first = characters[0]
  const firstTwo = characters.slice(0, 2).join("")
  return `${KAIKKI_BASE_URL}/${encodeURIComponent(first)}/${encodeURIComponent(firstTwo)}/${encodeURIComponent(word)}.${extension}`
}

export function getEtymologyTreeSource(word: string): LinkWithTitle {
  return {
    title: "Wiktionary via Kaikki.org",
    href: kaikkiWordUrl(word, "html") ?? "https://kaikki.org/dictionary/",
  }
}

async function readTextWithLimit(response: Response): Promise<string | null> {
  const contentLength = Number(response.headers.get("content-length"))
  if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) return null
  if (!response.body) return ""

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let byteCount = 0
  let text = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    byteCount += value.byteLength
    if (byteCount > MAX_RESPONSE_BYTES) {
      await reader.cancel()
      return null
    }
    text += decoder.decode(value, { stream: true })
  }

  return text + decoder.decode()
}

async function fetchKaikkiEntriesUncached(word: string, signal: AbortSignal): Promise<KaikkiEntry[]> {
  const normalized = word.normalize("NFC")
  const candidates = [...new Set([normalized, stripDiacritics(normalized)])]

  for (const candidate of candidates) {
    const url = kaikkiWordUrl(candidate, "jsonl")
    if (!url) return []

    const response = await fetch(url, {
      headers: { Accept: "application/x-ndjson, application/json" },
      next: { revalidate: KAIKKI_REVALIDATE_SECONDS },
      signal,
    })
    if (response.status === 404) continue
    if (!response.ok) throw new Error(`Kaikki request failed (${response.status})`)

    const text = await readTextWithLimit(response)
    return text === null ? [] : parseKaikkiJsonLines(text)
  }

  return []
}

function fetchKaikkiEntries(word: string, context: BuildContext): Promise<KaikkiEntry[]> {
  const key = word.normalize("NFC")
  const cached = context.fetchedEntries.get(key)
  if (cached) return cached

  const request = fetchKaikkiEntriesUncached(key, context.signal)
  context.fetchedEntries.set(key, request)
  return request
}

function canonicalForm(entry: KaikkiEntry): string | undefined {
  return entry.forms.find((form) => form.tags.includes("canonical"))?.form
}

function selectEntry(entries: KaikkiEntry[], languageCode: string): KaikkiEntry | undefined {
  const languageEntries = entries.filter((entry) => entry.langCode === languageCode)
  return languageEntries.find((entry) => entry.etymologyTemplates.length > 0) ?? languageEntries[0]
}

function fallbackLanguageName(languageCode: string): string {
  return LANGUAGE_NAMES[languageCode] ?? languageCode
}

async function buildParentNode(
  reference: EtymologyParentReference,
  depth: number,
  path: Set<string>,
  context: BuildContext
): Promise<EtymologyTreeNode | null> {
  context.signal.throwIfAborted()
  if (context.nodeCount >= MAX_TREE_NODES) return null
  context.nodeCount += 1

  const key = `${reference.languageCode}:${reference.lookupWord.normalize("NFC")}`
  const node: EtymologyTreeNode = {
    word: reference.word,
    language: fallbackLanguageName(reference.languageCode),
    languageCode: reference.languageCode,
    gloss: reference.gloss,
    romanization: reference.romanization,
    relationToChild: reference.relation,
    uncertain: reference.uncertain,
    parents: [],
  }

  if (depth >= MAX_TREE_DEPTH || reference.stopRecursion || path.has(key)) return node

  const explicitParentReferences = reference.parents ?? []
  const entry = selectEntry(
    await fetchKaikkiEntries(reference.lookupWord, context),
    reference.languageCode
  )
  if (entry) {
    node.word = canonicalForm(entry) ?? reference.word
    node.language = entry.lang
  }

  const parentReferences = explicitParentReferences.length > 0
    ? explicitParentReferences
    : entry
      ? extractEtymologyParentReferences(entry.etymologyTemplates)
      : []
  if (parentReferences.length === 0) return node

  const nextPath = new Set(path)
  nextPath.add(key)
  const remainingSlots = Math.max(0, MAX_TREE_NODES - context.nodeCount)
  const parentNodes = await Promise.all(
    parentReferences
      .slice(0, remainingSlots)
      .map((parent) => buildParentNode(parent, depth + 1, nextPath, context))
  )
  node.parents = parentNodes.filter((parent): parent is EtymologyTreeNode => parent !== null)
  return node
}

function referenceTreeSignature(references: EtymologyParentReference[]): string {
  function signatureValue(reference: EtymologyParentReference): unknown[] {
    return [
      reference.word,
      reference.lookupWord,
      reference.languageCode,
      reference.relation,
      reference.gloss ?? null,
      reference.romanization ?? null,
      reference.uncertain ?? false,
      reference.stopRecursion ?? false,
      (reference.parents ?? [])
        .map(signatureValue)
        .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
    ]
  }

  return JSON.stringify(
    references
      .map(signatureValue)
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)))
  )
}

function treeNodeSignature(node: EtymologyTreeNode): string {
  return JSON.stringify([
    node.word,
    node.language,
    node.languageCode,
    node.gloss ?? null,
    node.romanization ?? null,
    node.relationToChild ?? null,
    node.uncertain ?? false,
    node.parents.map(treeNodeSignature).sort(),
  ])
}

export function dedupeEtymologyTrees(trees: EtymologyTree[]): EtymologyTree[] {
  const seen = new Set<string>()
  return trees.filter((tree) => {
    const signature = treeNodeSignature(tree.root)
    if (seen.has(signature)) return false
    seen.add(signature)
    return true
  })
}

export async function fetchEtymologyTrees(
  word: string,
  options: FetchEtymologyTreesOptions = {}
): Promise<EtymologyTree[]> {
  const controller = new AbortController()
  const abortFromCaller = () => controller.abort(options.signal?.reason)
  if (options.signal?.aborted) {
    abortFromCaller()
  } else {
    options.signal?.addEventListener("abort", abortFromCaller, { once: true })
  }
  const timeout = setTimeout(() => {
    controller.abort(new DOMException("Etymology lookup timed out", "TimeoutError"))
  }, TREE_TIMEOUT_MS)
  const context: BuildContext = {
    signal: controller.signal,
    fetchedEntries: new Map(),
    nodeCount: 0,
  }

  try {
    const entries = (await fetchKaikkiEntries(word, context)).filter((entry) => entry.langCode === "en")
    const trees: EtymologyTree[] = []
    const seenReferences = new Set<string>()

    for (const entry of entries) {
      context.signal.throwIfAborted()
      if (trees.length >= MAX_TREES || context.nodeCount >= MAX_TREE_NODES) break

      const references = extractEtymologyParentReferences(entry.etymologyTemplates)
      if (references.length === 0) continue

      const referencesSignature = referenceTreeSignature(references)
      if (seenReferences.has(referencesSignature)) continue
      seenReferences.add(referencesSignature)

      const parents = await Promise.all(
        references.map((reference) => buildParentNode(reference, 1, new Set([`en:${word}`]), context))
      )
      const root: EtymologyTreeNode = {
        word: canonicalForm(entry) ?? word,
        language: entry.lang,
        languageCode: entry.langCode,
        parents: parents.filter((parent): parent is EtymologyTreeNode => parent !== null),
      }
      if (root.parents.length > 0) trees.push({ partOfSpeech: entry.pos, root })
    }

    return dedupeEtymologyTrees(trees)
  } finally {
    clearTimeout(timeout)
    options.signal?.removeEventListener("abort", abortFromCaller)
  }
}
