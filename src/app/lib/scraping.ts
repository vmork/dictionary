import * as cheerio from "cheerio"
import { ApiError } from "next/dist/server/api-utils"

type Definition = {
  wordType: string // e.g. noun, verb, etc.
  definition: string
  synonyms: string[]
  example: string
}

export type WordInfo = {
  word: string
  definitions: Definition[]
  translations: string[]
}

export class NotFound {
  constructor(public didYouMean: string[], public word: string) {}
}

export class APIError {
  constructor(public message: string) {}
}

function parseEntry(d: any): Definition[] {
  console.log(d)
  return d.def[0].sseq
    .flat(Infinity)
    .filter((s: string | object) => s !== "sense")
    .map((s: any) => {
      return {
        wordType: d.fl,
        definition: s.dt[0][1],
        example: s.dt?.[1]?.[1]?.[0]?.t,
        synonyms: s?.syn_list?.flat(Infinity)?.map((syn: any) => syn.wd) ?? [],
      }
    })
}

async function fetchDefinitions(word: string): Promise<Definition[] | NotFound> {
  let data, res
  try {
    res = await fetch(
      `https://www.dictionaryapi.com/api/v3/references/thesaurus/json/${encodeURIComponent(
        word
      )}?key=${process.env.NEXT_PUBLIC_MERRIAM_WEBSTER_API_KEY_THESAURUS}`,
      { cache: "force-cache" }
    )
  } catch (e: any) {
    throw new APIError(e.message)
  }

  if (!res.ok) {
    throw new APIError(`(${res.status}) ${res.statusText}`)
  }

  const resText = await res.text()
  try {
    // sometimes returns 200 with an error message
    data = JSON.parse(resText)
  } catch (e: any) {
    console.error("in scraping", e.message)
    throw new APIError(resText)
  }

  if (!data[0]?.fl) {
    return new NotFound(data, word)
  }

  return data.filter((d: any) => d?.hwi?.hw === word).flatMap(parseEntry)
}

async function fetchTranslations(word: string) {
  let res
  try {
    res = await fetch(`https://www.wordreference.com/ensv/${encodeURIComponent(word)}`)
  } catch (e: any) {
    throw new APIError(e.message)
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

export async function fetchWordInfoFromWeb(word: string): Promise<WordInfo | NotFound | APIError> {
  try {

    const definitions = await fetchDefinitions(word)
    const translations = await fetchTranslations(word)
    console.log(definitions, translations)

    if (definitions instanceof NotFound) {
      return definitions
    }

    return {
      word,
      translations,
      definitions,
    }
  } catch (e: any) {
    return new APIError(e.message)
  }
}
