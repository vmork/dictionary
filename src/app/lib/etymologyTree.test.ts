import assert from "node:assert/strict"
import test from "node:test"
import {
  dedupeEtymologyTrees,
  extractEtymologyParentReferences,
  fetchEtymologyTrees,
  parseKaikkiJsonLines,
  type KaikkiTemplate,
} from "./etymologyTree"
import { findCollapsedSharedAncestryPaths } from "./etymologyTreeDisplay"
import type { EtymologyTree } from "./types"

test("parseKaikkiJsonLines keeps valid ancestry fields and ignores malformed lines", () => {
  const input = [
    "not json",
    JSON.stringify({ word: "missing language" }),
    JSON.stringify({
      word: "meretricious",
      lang: "English",
      lang_code: "en",
      pos: "adj",
      forms: [{ form: "meretricious", tags: ["canonical"] }],
      etymology_templates: [{ name: "uder", args: { 1: "en", 2: "la", 3: "meretrīcius" } }],
    }),
  ].join("\n")

  assert.deepEqual(parseKaikkiJsonLines(input), [{
    word: "meretricious",
    lang: "English",
    langCode: "en",
    pos: "adj",
    forms: [{ form: "meretricious", tags: ["canonical"] }],
    etymologyTemplates: [{ name: "uder", args: { 1: "en", 2: "la", 3: "meretrīcius" } }],
  }])
})

test("a direct derivation takes precedence over a broad root shortcut", () => {
  const templates: KaikkiTemplate[] = [
    { name: "root", args: { 1: "en", 2: "ine-pro", 3: "*(s)mer-" } },
    { name: "uder", args: { 1: "en", 2: "la", 3: "meretrīcius" } },
  ]

  assert.deepEqual(extractEtymologyParentReferences(templates), [{
    word: "meretrīcius",
    lookupWord: "meretrīcius",
    languageCode: "la",
    relation: "derived",
    gloss: undefined,
    romanization: undefined,
    uncertain: false,
    stopRecursion: false,
  }])
})

test("ordered direct sources form an ancestry chain", () => {
  const templates: KaikkiTemplate[] = [
    { name: "root", args: { 1: "en", 2: "ine-pro", 3: "*puH-" } },
    { name: "bor", args: { 1: "en", 2: "frm", 3: "purulent" } },
    { name: "der", args: { 1: "en", 2: "la", 3: "pūrulentus" } },
  ]

  assert.deepEqual(extractEtymologyParentReferences(templates), [{
    word: "purulent",
    lookupWord: "purulent",
    languageCode: "frm",
    relation: "borrowed",
    gloss: undefined,
    romanization: undefined,
    uncertain: false,
    stopRecursion: false,
    parents: [{
      word: "pūrulentus",
      lookupWord: "pūrulentus",
      languageCode: "la",
      relation: "derived",
      gloss: undefined,
      romanization: undefined,
      uncertain: false,
      stopRecursion: false,
    }],
  }])
})

test("new etymon syntax becomes annotated word-formation parents", () => {
  const templates: KaikkiTemplate[] = [{
    name: "ety",
    args: {
      1: "la",
      2: ":af",
      3: "meretrīx<t:female earner, prostitute>",
      4: "-ius<t:-ious: forming adjectives>",
    },
  }]

  assert.deepEqual(extractEtymologyParentReferences(templates), [
    {
      word: "meretrīx",
      lookupWord: "meretrīx",
      languageCode: "la",
      relation: "formed",
      gloss: "female earner, prostitute",
      romanization: undefined,
      uncertain: false,
      stopRecursion: false,
    },
    {
      word: "-ius",
      lookupWord: "-ius",
      languageCode: "la",
      relation: "formed",
      gloss: "-ious: forming adjectives",
      romanization: undefined,
      uncertain: false,
      stopRecursion: true,
    },
  ])
})

test("classic suffix syntax preserves display forms and glosses", () => {
  const templates: KaikkiTemplate[] = [{
    name: "suffix",
    args: {
      1: "la",
      2: "mereō",
      3: "trīx",
      alt1: "mereō, meritum",
      t1: "to earn (a living)",
      t2: "-ess",
    },
  }]

  assert.deepEqual(extractEtymologyParentReferences(templates), [
    {
      word: "mereō, meritum",
      lookupWord: "mereō",
      languageCode: "la",
      relation: "formed",
      gloss: "to earn (a living)",
      romanization: undefined,
      uncertain: false,
      stopRecursion: false,
    },
    {
      word: "-trīx",
      lookupWord: "-trīx",
      languageCode: "la",
      relation: "formed",
      gloss: "-ess",
      romanization: undefined,
      uncertain: false,
      stopRecursion: true,
    },
  ])
})

test("identical trees shared by multiple parts of speech are shown once", () => {
  const nounTree: EtymologyTree = {
    partOfSpeech: "noun",
    root: {
      word: "flange",
      language: "English",
      languageCode: "en",
      parents: [{
        word: "flanche",
        language: "Middle French",
        languageCode: "frm",
        relationToChild: "borrowed",
        parents: [],
      }],
    },
  }
  const verbTree: EtymologyTree = {
    partOfSpeech: "verb",
    root: structuredClone(nounTree.root),
  }
  const distinctTree: EtymologyTree = {
    partOfSpeech: "verb",
    root: {
      ...structuredClone(nounTree.root),
      parents: [{
        ...structuredClone(nounTree.root.parents[0]),
        gloss: "flank, side",
      }],
    },
  }

  assert.deepEqual(dedupeEtymologyTrees([nounTree, verbTree, distinctTree]), [nounTree, distinctTree])
})

test("the deeper occurrence of the largest shared ancestry is collapsed", () => {
  const brouiller = {
    word: "brouiller",
    language: "French",
    languageCode: "fr",
    relationToChild: "formed" as const,
    parents: [{
      word: "brouiller",
      language: "Old French",
      languageCode: "fro",
      relationToChild: "inherited" as const,
      parents: [],
    }],
  }
  const firstEmbrouiller = {
    word: "embrouiller",
    language: "French",
    languageCode: "fr",
    gloss: "muddle, embroil",
    relationToChild: "derived" as const,
    parents: [structuredClone(brouiller)],
  }
  const secondEmbrouiller = {
    ...structuredClone(firstEmbrouiller),
    gloss: "to embroil, muddle",
  }
  const root: EtymologyTree["root"] = {
    word: "imbroglio",
    language: "English",
    languageCode: "en",
    parents: [{
      word: "imbroglio",
      language: "Italian",
      languageCode: "it",
      relationToChild: "borrowed",
      parents: [firstEmbrouiller],
    }, secondEmbrouiller],
  }

  assert.deepEqual([...findCollapsedSharedAncestryPaths(root)], ["root.0.0"])
})

test("tree fetch failures reject and caller cancellation reaches the upstream request", async () => {
  const originalFetch = globalThis.fetch

  try {
    globalThis.fetch = (async () => new Response("Unavailable", { status: 503 })) as typeof fetch
    await assert.rejects(
      fetchEtymologyTrees("purulent"),
      /Kaikki request failed \(503\)/
    )

    let upstreamSignal: AbortSignal | undefined
    globalThis.fetch = ((_input, init) => {
      upstreamSignal = init?.signal ?? undefined
      return new Promise<Response>((_resolve, reject) => {
        if (!upstreamSignal) {
          reject(new Error("Missing upstream abort signal"))
          return
        }

        const rejectForAbort = () => reject(
          upstreamSignal?.reason ?? new DOMException("Aborted", "AbortError")
        )
        if (upstreamSignal.aborted) {
          rejectForAbort()
        } else {
          upstreamSignal.addEventListener("abort", rejectForAbort, { once: true })
        }
      })
    }) as typeof fetch

    const controller = new AbortController()
    const lookup = fetchEtymologyTrees("purulent", { signal: controller.signal })
    controller.abort(new DOMException("Word changed", "AbortError"))

    await assert.rejects(lookup, (error) => (
      error instanceof DOMException
      && error.name === "AbortError"
      && error.message === "Word changed"
    ))
    assert.equal(upstreamSignal?.aborted, true)
  } finally {
    globalThis.fetch = originalFetch
  }
})
