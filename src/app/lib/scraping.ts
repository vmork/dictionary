import { parse } from "node-html-parser"
import { Definition, Translation, Etymology, NotFound, APIError, DictEntryFromNet, LinkWithTitle } from "./types"
import { fetchEtymologyTrees, getEtymologyTreeSource } from "./etymologyTree"

// Wrapper result types used only at fetch stage
export type DefinitionsResult = { definitions: Definition[]; source: LinkWithTitle }
export type TranslationsResult = { translations: Translation[]; source: LinkWithTitle }
export type EtymologyResult = { etymologies: Etymology[]; source: LinkWithTitle }

// Merriam-Webster API embeds formatting / cross-ref markup using brace syntax.
// Examples:
//   {it}degeneration{/it} => keep inner text (remove formatting tokens)
//   {bc} => block colon / formatting cue, drop entirely
//   {sx|secretive||} => synonym cross-ref; keep the display term (first field after tag)
// Generic pattern: {tag|display|...} where we want 'display'. Some tags appear without pipes.
function removeBraces(s: string | undefined) {
  if (!s) return s
  let out = s
  // 1. Convert cross-ref style tokens {tag|display|...} to just display.
  //    Tag (letters/underscores), then a pipe, capture first non-pipe, non-brace run as display, then consume until closing brace.
  out = out.replace(/\{[a-z_]+\|([^|}]+)[^}]*\}/gi, (_, display) => display)
  // 2. Remove standalone/open/close simple tokens like {it} {/it} {bc} etc.
  out = out.replace(/\{\/?[a-z_]+\}/gi, "")
  // 3. Collapse whitespace produced by removals.
  out = out.replace(/\s{2,}/g, " ").trim()
  return out
}

function normalizeString(s: string) {
  return s.replace(/[^\p{L}\p{N}\s-]/gu, "").toLowerCase()
}

function parseEntry(d: any): Definition[] {
  return d.def[0].sseq
    .flat(Infinity)
    .filter((s: string | object) => s !== "sense")
    .map((s: any) => {
      return {
        wordType: d.fl,
        definition: removeBraces(s.dt[0][1]),
        example: removeBraces(s.dt?.[1]?.[1]?.[0]?.t),
        synonyms: s?.syn_list?.flat(Infinity)?.map((syn: any) => syn.wd) ?? [],
      }
    })
}

async function fetchDefinitionsFromSource(
  word: string,
  source: "thesaurus" | "dictionary"
): Promise<Definition[] | NotFound> {
  const baseUrl = "https://www.dictionaryapi.com/api/v3/references"
  const url =
    source === "thesaurus"
      ? `${baseUrl}/thesaurus/json/${encodeURIComponent(word)}?key=${
          process.env.MERRIAM_WEBSTER_API_KEY_THESAURUS
        }`
      : `${baseUrl}/collegiate/json/${encodeURIComponent(word)}?key=${
          process.env.MERRIAM_WEBSTER_API_KEY_DICTIONARY
        }`

  let data: any[]
  let res: Response
  try {
    res = await fetch(url, { cache: "force-cache" })
  } catch (e: any) {
    throw new APIError(`(MW ${source}) ` + e.message)
  }

  if (!res.ok) {
    throw new APIError(`(MW ${source}) ` + `(${res.status}) ${res.statusText}`)
  }

  const resText = await res.text()
  try {
    data = JSON.parse(resText)
  } catch (e: any) {
    throw new APIError(`(MW ${source}) ` + resText)
  }

  if (!data[0]?.fl) {
    return new NotFound(data, word)
  }

  const exact = data.filter((d: any) => normalizeString(d?.hwi?.hw) === word)

  if (!exact.length) {
    return new NotFound(
      data.map((d: any) => d.hwi.hw),
      word
    )
  }
  return exact.flatMap(parseEntry)
}

async function fetchDefinitions(word: string): Promise<DefinitionsResult | NotFound> {
  const thesaurusSource: LinkWithTitle = {
    title: "merriam-webster.com/thesaurus",
    href: `https://www.merriam-webster.com/thesaurus/${word}`,
  }
  const dictionarySource: LinkWithTitle = {
    title: "merriam-webster.com/dictionary",
    href: `https://www.merriam-webster.com/dictionary/${word}`,
  }

  const thesaurusDefs = await fetchDefinitionsFromSource(word, "thesaurus")
  if (!(thesaurusDefs instanceof NotFound)) {
    return { definitions: thesaurusDefs, source: thesaurusSource }
  }
  const dictionaryDefs = await fetchDefinitionsFromSource(word, "dictionary")
  if (!(dictionaryDefs instanceof NotFound)) {
    return { definitions: dictionaryDefs, source: dictionarySource }
  }
  return thesaurusDefs
}

async function fetchTranslations(word: string): Promise<TranslationsResult> {
  let res
  try {
    res = await fetch(`https://www.wordreference.com/ensv/${encodeURIComponent(word)}`)
  } catch (e: any) {
    throw new APIError("Translations: " + e.message)
  }
  const html = await res.text()
  const root = parse(html)

  // Helper: case-insensitive class check
  const hasClassCI = (el: any, cls: string) =>
    ((el?.getAttribute?.("class") as string) || "")
      .split(/\s+/)
      .some((c) => c.toLowerCase() === cls.toLowerCase())

  // Find the first WRD table reliably, even if markup is malformed
  const article = root.querySelector("#articleWRD")
  let firstWRDTable = article?.querySelector("table")

  // Collect all ToWrd cells, but only those that belong to the first WRD table
  const allTDs = root.querySelectorAll("td") as any[]
  const toWrdTDs = allTDs.filter((td: any) => hasClassCI(td, "ToWrd"))

  const getAncestorTable = (el: any) => {
    let p = el?.parentNode
    while (p && (p as any).tagName !== "TABLE") p = p.parentNode
    return p
  }

  // If we couldn't detect the first WRD table explicitly, infer it from the first ToWrd cell's table
  if (!firstWRDTable && toWrdTDs.length) firstWRDTable = getAncestorTable(toWrdTDs[0])

  const inFirstTable = toWrdTDs // TODO

  // Build clean word list: remove POS markers, split on common delimiters, trim, dedupe
  const rawPieces: string[] = []
  for (const td of inFirstTable) {
    // Skip placeholder/header cells
    if (td.querySelector("span.ph")) continue

    // Construct text while skipping POS markers like <em class="POS2">s</em>
    const pieces: string[] = []
    for (const n of td.childNodes as any[]) {
      if (n.nodeType === 3) {
        pieces.push((n.rawText || "").trim())
      } else if ((n as any).tagName === "EM" && hasClassCI(n, "POS2")) {
        // drop POS abbreviation
      } else {
        pieces.push(((n as any).text || "").trim())
      }
    }
    // Remove parenthetical glosses like (vard.) or (fig.)
    const txt = pieces
      .join(" ")
      .replace(/\([^)]*\)/g, " ")
      .replace(/\s+/g, " ")
      .trim()
    if (txt) rawPieces.push(txt)
  }

  const splitAndClean = (s: string) =>
    s
      // split on commas, slashes, middots, semicolons, and explicit " or/eller "
      .split(/[,\/•·;]|\s+(?:eller|or)\s+/g)
      .map((x) => x.replace(/\s+/g, " ").trim())
      .filter(Boolean)

  const blacklist = new Set([
    "adj",
    "adv",
    "s",
    "n",
    "v",
    "vtr",
    "vi",
    "uttr",
    "pl",
    "sing",
    "abbr",
    "svenska",
  ])

  const words: string[] = []
  for (const chunk of rawPieces) {
    for (const w of splitAndClean(chunk)) {
      const normalized = w.trim()
      if (!normalized) continue
      if (blacklist.has(normalized.toLowerCase())) continue
      // Keep order, dedupe
      if (!words.includes(normalized)) words.push(normalized)
    }
  }

  return {
    translations: words.map((w) => ({ language: "swedish", word: w })),
    source: { title: "wordreference.com", href: `https://www.wordreference.com/ensv/${word}` },
  }
}

function parseEtymOnline(word: string, html: string): Etymology[] {
  const root = parse(html)

  const h2s = root.querySelectorAll('h2');
  const h2regex = /^(\w+)\s*\((.+)\)/;
  const entries: Etymology[] = [];

  for (const h2 of h2s) {

    const t = h2.text.trim();
    const m = t.match(h2regex);
    if (!m) continue;
    const word = m[1];
    const wordType = m[2].trim();

    let container = h2.parentNode as any;
    while (container && container.tagName !== 'DIV') container = container.parentNode;
    if (!container) continue;

    const sib = container.nextElementSibling;
    if (!sib || sib.tagName !== 'SECTION') continue;

    sib.querySelectorAll('a').forEach((a: any) => a.replaceWith(a.innerText));

    const descriptionHTML = sib.innerHTML.trim();
    entries.push({ word, wordType, descriptionHTML });
  }

  return entries
}

async function fetchEtymology(word: string): Promise<EtymologyResult> {
  let res
  try {
    res = await fetch(`https://www.etymonline.com/word/${encodeURIComponent(word)}`)
  } catch (e: any) {
    throw new APIError("Etymology: " + e.message)
  }
  if (!res.ok) {
    throw new APIError(`Etymology: (${res.status}) ${res.statusText}`)
  }
  const html = await res.text()
  const etys = parseEtymOnline(word, html)
  return {
    etymologies: etys,
    source: { title: "etymonline.com", href: `https://www.etymonline.com/search?q=${encodeURIComponent(word)}` },
  }
}

export async function fetchWordInfoFromWeb(word: string): Promise<DictEntryFromNet | NotFound | APIError> {
  try {
    const definitions = await fetchDefinitions(word)
    if (definitions instanceof NotFound) return definitions
    const [translationsRes, etymologyRes, etymologyTrees] = await Promise.all([
      fetchTranslations(word),
      fetchEtymology(word),
      fetchEtymologyTrees(word),
    ])
    return {
      word,
      definitions: definitions.definitions,
      translations: translationsRes.translations,
      etymologies: etymologyRes.etymologies,
      etymologyTrees,
      definitionsSource: definitions.source,
      translationsSource: translationsRes.source,
      etymologySource: etymologyRes.source,
      etymologyTreeSource: getEtymologyTreeSource(word),
      type: "net",
    }
  } catch (e: any) {
    return new APIError(e.message)
  }
}
