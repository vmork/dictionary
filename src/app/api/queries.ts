import { DictEntry, DictEntryFromNet, PracticeData } from "../lib/types"
import { useQuery, useMutation } from "@tanstack/react-query"
import { WordsDataMap, DictDBRow } from "../lib/types"
import { Collection, CollectionID } from "@/app/lib/collections"

async function addWord(cid: CollectionID, word: string, info: DictEntry, timeString: string) {
  const res = await fetch("/api/word", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cid, word, info, timeString }),
    cache: "no-cache",
  })
  if (!res.ok) throw new Error(res.status + ": " + res.statusText)
}

async function updatePracticeData(cid: CollectionID, word: string, practiceData: PracticeData) {
  const res = await fetch("/api/word", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "updatePracticeData", cid, word, practiceData }),
    cache: "no-cache",
  })
  if (!res.ok) throw new Error(res.status + ": " + res.statusText)
}

async function resetAllPracticeData(cid: CollectionID) {
  const res = await fetch("/api/word", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "resetAllPracticeData", cid }),
    cache: "no-cache",
  })
  if (!res.ok) throw new Error(res.status + ": " + res.statusText)
}

async function deleteWord(cid: CollectionID, word: string) {
  const res = await fetch(`/api/word?cid=${cid}&word=${encodeURIComponent(word)}`, { method: "DELETE", cache: "no-cache" })
  if (!res.ok) throw new Error(res.status + ": " + res.statusText)
}

async function getWordInfo(cid: CollectionID, word: string): Promise<DictEntryFromNet | null> {
  const res = await fetch(`/api/word?cid=${cid}&word=${word}`, { cache: "no-cache" })
  if (!res.ok) return null
  return res?.json() ?? null
}

export async function getAllWords(cid: CollectionID): Promise<string[]> {
  const res = await fetch(`/api/allWords?cid=${cid}&info=false`, { cache: "no-cache" })
  if (!res.ok) throw new Error(res.status + ": " + res.statusText)
  return res.json()
}

export async function getWordsDB(cid: CollectionID): Promise<WordsDataMap> {
  const res = await fetch(`/api/allWords?cid=${cid}&info=true`, { cache: "no-cache" })
  if (!res.ok) throw new Error(res.status + ": " + res.statusText)
  const data: (DictDBRow & { id: number })[] = await res.json()
  const map: WordsDataMap = new Map()
  data.forEach((row) => map.set(row.word, row))
  return map
}

export async function getCollections(): Promise<Collection[]> {
  const res = await fetch("/api/collections", { cache: "no-cache" })
  if (!res.ok) throw new Error(res.status + ": " + res.statusText)
  return res.json()
}

async function createCollection(name: string): Promise<Collection> {
  const res = await fetch("/api/collections", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, type: "dictionary", lang1: "english", lang2: null }),
  })
  if (!res.ok) throw new Error((await res.text()) || res.statusText)
  return res.json()
}

async function deleteCollection(cid: CollectionID) {
  const res = await fetch(`/api/collections?cid=${cid}`, { method: "DELETE" })
  if (!res.ok) throw new Error((await res.text()) || res.statusText)
}

// Hooks: useWordInfo, useWordList, useAddWord, useDeleteWord

export function useCollectionList() {
  return useQuery<Collection[]>({
    queryKey: ["collections"],
    queryFn: getCollections,
  })
}

export function useCreateCollection() {
  return useMutation({ mutationFn: (name: string) => createCollection(name) })
}

export function useDeleteCollection() {
  return useMutation({ mutationFn: (cid: CollectionID) => deleteCollection(cid) })
}

export function useWordsDB(cid: CollectionID) {
  return useQuery<WordsDataMap>({
    queryKey: ["wordsDB", cid],
    queryFn: () => getWordsDB(cid),
  })
}

export function useWordList(cid: CollectionID) {
  return useQuery<string[]>({
    queryKey: ["wordList", cid],
    queryFn: () => getAllWords(cid),
  })
}

export function useAddWord(cid: CollectionID) {
  return useMutation({
    mutationKey: ["addWord", cid],
    mutationFn: ({ word, info, timeString }: { word: string; info: DictEntry; timeString: string }) =>
      addWord(cid, word, info, timeString),
  })
}

export function useDeleteWord(cid: CollectionID) {
  return useMutation({
    mutationKey: ["deleteWord", cid],
    mutationFn: (word: string) => deleteWord(cid, word),
  })
}

export function useUpdatePracticeData(cid: CollectionID) {
  return useMutation({
    mutationKey: ["updatePracticeData", cid],
    mutationFn: ({ word, practiceData }: { word: string; practiceData: PracticeData }) =>
      updatePracticeData(cid, word, practiceData),
  })
}

export function useResetAllPracticeData(cid: CollectionID) {
  return useMutation({
    mutationKey: ["resetAllPracticeData", cid],
    mutationFn: () => resetAllPracticeData(cid),
  })
}
