import { Collection, CollectionID, Language } from "./collections"
import { DictEntryFromNet, DictDBRow, PracticeData, WordsDataMap } from "./types"
import { getSql } from "./db"

type CollectionRow = {
  id: number
  type: "dictionary" | "translations"
  name: string
  lang1: Language
  lang2: Language | null
  word_count: number | string
}

export class CollectionNotFoundError extends Error {}
export class CollectionNotEmptyError extends Error {}

function parseStoredJson(value: unknown): unknown {
  if (typeof value !== "string") return value
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function normalizeDictionaryEntry(value: unknown, word: string): DictEntryFromNet {
  const parsed = parseStoredJson(value)
  const entry = parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? parsed as Partial<DictEntryFromNet>
    : {}
  const definitions = Array.isArray(entry.definitions)
    ? entry.definitions.map((definition) => ({
        ...definition,
        synonyms: Array.isArray(definition.synonyms) ? definition.synonyms : [],
      }))
    : []

  return {
    ...entry,
    word: typeof entry.word === "string" ? entry.word : word,
    definitions,
    translations: Array.isArray(entry.translations) ? entry.translations : [],
    etymologies: Array.isArray(entry.etymologies) ? entry.etymologies : [],
    etymologyTrees: Array.isArray(entry.etymologyTrees) ? entry.etymologyTrees : undefined,
    type: "net",
  } as DictEntryFromNet
}

function normalizePracticeData(value: unknown): PracticeData {
  const parsed = parseStoredJson(value)
  const practice = parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? parsed as Partial<PracticeData>
    : {}

  return {
    numSeen: Number.isFinite(practice.numSeen) ? Number(practice.numSeen) : 0,
    numCorrect: Number.isFinite(practice.numCorrect) ? Number(practice.numCorrect) : 0,
    lastFive: Array.isArray(practice.lastFive) ? practice.lastFive.filter((value) => typeof value === "boolean") : [],
  }
}

function toCollection(row: CollectionRow): Collection {
  if (row.type === "dictionary") {
    return { id: row.id, type: row.type, name: row.name, language: "english", wordCount: Number(row.word_count) }
  }
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    language1: row.lang1,
    language2: row.lang2 ?? "english",
    wordCount: Number(row.word_count),
  }
}

export async function listCollections(userId: string): Promise<Collection[]> {
  const sql = getSql()
  const rows = await sql<CollectionRow[]>`
    SELECT c.id, c.type, c.name, c.lang1, c.lang2, count(w.id) AS word_count
    FROM collections c
    LEFT JOIN words w ON w.collection_id = c.id
    WHERE c.owner_id = ${userId}
    GROUP BY c.id
    ORDER BY c.name, c.id
  `
  return rows.map(toCollection)
}

export async function createCollection(
  userId: string,
  input: { name: string; type: "dictionary" | "translations"; lang1: Language; lang2: Language | null }
): Promise<Collection> {
  const sql = getSql()
  const rows = await sql<CollectionRow[]>`
    INSERT INTO collections (owner_id, name, type, lang1, lang2)
    VALUES (${userId}, ${input.name}, ${input.type}, ${input.lang1}, ${input.lang2})
    RETURNING id, type, name, lang1, lang2, 0::bigint AS word_count
  `
  return toCollection(rows[0])
}

export async function deleteEmptyCollection(userId: string, cid: CollectionID) {
  const sql = getSql()
  const rows = await sql<{ status: "deleted" | "not_empty" | "not_found" }[]>`
    WITH target AS (
      SELECT c.id, EXISTS (SELECT 1 FROM words w WHERE w.collection_id = c.id) AS has_words
      FROM collections c
      WHERE c.id = ${cid} AND c.owner_id = ${userId}
    ), deleted AS (
      DELETE FROM collections
      WHERE id IN (SELECT id FROM target WHERE NOT has_words)
      RETURNING id
    )
    SELECT CASE
      WHEN NOT EXISTS (SELECT 1 FROM target) THEN 'not_found'
      WHEN EXISTS (SELECT 1 FROM deleted) THEN 'deleted'
      ELSE 'not_empty'
    END AS status
  `

  if (rows[0].status === "not_found") throw new CollectionNotFoundError()
  if (rows[0].status === "not_empty") throw new CollectionNotEmptyError()
}

export async function assertCollectionOwned(userId: string, cid: CollectionID) {
  const sql = getSql()
  const rows = await sql`
    SELECT 1
    FROM collections
    WHERE id = ${cid} AND owner_id = ${userId}
  `
  if (!rows.length) throw new CollectionNotFoundError()
}

export async function listWords(userId: string, cid: CollectionID, includeInfo: boolean) {
  const sql = getSql()
  if (includeInfo) {
    const rows = await sql<{
      id: number
      collection_id: number
      word: string
      dict_entry: unknown
      practice_data: unknown
      time_added: string | Date
    }[]>`
      SELECT w.*
      FROM words w
      JOIN collections c ON c.id = w.collection_id
      WHERE w.collection_id = ${cid} AND c.owner_id = ${userId}
      ORDER BY w.id
    `
    return rows.map((row) => ({
      ...row,
      dict_entry: normalizeDictionaryEntry(row.dict_entry, row.word),
      practice_data: normalizePracticeData(row.practice_data),
      time_added: row.time_added instanceof Date ? row.time_added.toISOString() : row.time_added,
    }))
  }
  const rows = await sql<{ word: string }[]>`
    SELECT w.word
    FROM words w
    JOIN collections c ON c.id = w.collection_id
    WHERE w.collection_id = ${cid} AND c.owner_id = ${userId}
    ORDER BY w.id
  `
  return rows.map((row) => row.word)
}

export async function getWordsDataMap(userId: string, cid: CollectionID): Promise<WordsDataMap> {
  await assertCollectionOwned(userId, cid)
  const rows = (await listWords(userId, cid, true)) as (DictDBRow & { id: number })[]
  return new Map(rows.map((row) => [row.word, row]))
}

export async function getWordInfo(userId: string, cid: CollectionID, word: string) {
  const sql = getSql()
  const rows = await sql<{ dict_entry: unknown }[]>`
    SELECT w.dict_entry
    FROM words w
    JOIN collections c ON c.id = w.collection_id
    WHERE w.collection_id = ${cid} AND w.word = ${word} AND c.owner_id = ${userId}
  `
  return rows[0] ? normalizeDictionaryEntry(rows[0].dict_entry, word) : null
}

export async function insertWord(
  userId: string,
  cid: CollectionID,
  word: string,
  dictEntry: DictEntryFromNet,
  timeString: string
) {
  await assertCollectionOwned(userId, cid)
  const sql = getSql()
  const normalizedEntry = normalizeDictionaryEntry(dictEntry, word)
  await sql`
    INSERT INTO words (word, dict_entry, time_added, collection_id, practice_data)
    VALUES (
      ${word},
      ${sql.json(normalizedEntry)},
      ${timeString},
      ${cid},
      ${sql.json({ numSeen: 0, lastFive: [], numCorrect: 0 })}
    )
  `
}

export async function updatePracticeData(
  userId: string,
  cid: CollectionID,
  word: string,
  practiceData: PracticeData
) {
  await assertCollectionOwned(userId, cid)
  const sql = getSql()
  const normalizedPracticeData = normalizePracticeData(practiceData)
  await sql`
    UPDATE words
    SET practice_data = ${sql.json(normalizedPracticeData)}
    WHERE word = ${word} AND collection_id = ${cid}
  `
}

export async function resetAllPracticeData(userId: string, cid: CollectionID) {
  await assertCollectionOwned(userId, cid)
  const sql = getSql()
  const defaultPracticeData = { numSeen: 0, lastFive: [], numCorrect: 0 }
  await sql`
    UPDATE words
    SET practice_data = ${sql.json(defaultPracticeData)}
    WHERE collection_id = ${cid}
  `
}

export async function deleteWord(userId: string, cid: CollectionID, word: string) {
  await assertCollectionOwned(userId, cid)
  const sql = getSql()
  await sql`DELETE FROM words WHERE word = ${word} AND collection_id = ${cid}`
}
