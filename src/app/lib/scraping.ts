import * as cheerio from "cheerio"
import { Definition, NotFound, APIError, DefinitionSource, WordInfoFromNet } from "./types"

function removeBraces(s: string | undefined) {
  return s?.replace(/\{([^}]+)\}/g, "")
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
  source: DefinitionSource
): Promise<Definition[] | NotFound> {
  const baseUrl = "https://www.dictionaryapi.com/api/v3/references"
  const url =
    source === "thesaurus"
      ? `${baseUrl}/thesaurus/json/${encodeURIComponent(word)}?key=${
          process.env.NEXT_PUBLIC_MERRIAM_WEBSTER_API_KEY_THESAURUS
        }`
      : `${baseUrl}/collegiate/json/${encodeURIComponent(word)}?key=${
          process.env.NEXT_PUBLIC_MERRIAM_WEBSTER_API_KEY_DICTIONARY
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
    // sometimes returns 200 with an error message
    data = JSON.parse(resText)
  } catch (e: any) {
    console.error("in scraping", e.message)
    throw new APIError(`(MW ${source}) ` + resText)
  }

  if (!data[0]?.fl) {
    return new NotFound(data, word)
  }

  const exact = data.filter((d: any) => normalizeString(d?.hwi?.hw) === word)

  console.log("hws: ", data.map((d: any) => normalizeString(d.hwi.hw)))
  console.log("word: ", word)

  if (!exact.length) {
    return new NotFound(
      data.map((d: any) => d.hwi.hw),
      word
    )
  }

  return exact.flatMap(parseEntry)
}

async function fetchDefinitions(word: string): Promise<{definitions: Definition[] | NotFound, source: DefinitionSource}> {
  const thesaurusDefs = await fetchDefinitionsFromSource(word, "thesaurus")
  console.log("thesarus defs: ", thesaurusDefs)
  if (!(thesaurusDefs instanceof NotFound)) {
    return { definitions: thesaurusDefs, source: "thesaurus" }
  }
  const dictionaryDefs = await fetchDefinitionsFromSource(word, "dictionary")
  console.log("dictionary defs: ", dictionaryDefs)
  if (!(dictionaryDefs instanceof NotFound)) {
    return { definitions: dictionaryDefs, source: "dictionary" }
  }
  return { definitions: thesaurusDefs, source: "thesaurus" }
}

async function fetchTranslations(word: string) {
  let res
  try {
    res = await fetch(`https://www.wordreference.com/ensv/${encodeURIComponent(word)}`)
  } catch (e: any) {
    throw new APIError("(translations)" + e.message)
  }

  const html = await res.text()
  const $ = cheerio.load(html)

  const words = $("table.WRD td.ToWrd:not(:has(span.ph))")
    .map((_, el) =>
      $(el)
        .contents()
        .filter((_, node) => node.nodeType === 3)
        .first()
        .text()
        .trim()
    )
    .get()
  return words
}

export async function fetchWordInfoFromWeb(word: string): Promise<WordInfoFromNet | NotFound | APIError> {
  try {
    const { definitions, source } = await fetchDefinitions(word)
    const translations = await fetchTranslations(word)

    if (definitions instanceof NotFound) {
      return definitions
    }

    return {
      word,
      translations,
      definitions,
      source,
      type: "net",
    }
  } catch (e: any) {
    return new APIError(e.message)
  }
}
