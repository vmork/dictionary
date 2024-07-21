import { DictEntry, DictEntryFromNet } from "../lib/dictionary/types"
import { useQuery, useMutation } from "@tanstack/react-query"
import { WordsDataMap, DictDBRow } from "../lib/dictionary/types"
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

async function deleteWord(cid: CollectionID, word: string) {
  const res = await fetch(`/api/word?cid=${cid}&word=${word}`, { method: "DELETE", cache: "no-cache" })
  if (!res.ok) throw new Error(res.status + ": " + res.statusText)
}

async function getWordInfo(cid: CollectionID, word: string): Promise<DictEntryFromNet | null> {
  const res = await fetch(`/api/word?cid=${cid}&word=${word}`, { cache: "no-cache" })
  if (!res.ok) return null
  return res?.json() ?? null
}

export async function getAllWords(cid: CollectionID): Promise<string[]> {
  const res = await fetch(`/api/allWords?cid=${cid}&info=false`, { cache: "no-cache" })
  return res.json()
}

export async function getWordsDB(cid: CollectionID): Promise<WordsDataMap> {
  const res = await fetch(`/api/allWords?cid=${cid}&info=true`, { cache: "no-cache" })
  const data: (DictDBRow & { id: number })[] = await res.json()
  const map: WordsDataMap = new Map()
  data.forEach((row) => map.set(row.word, row))
  return map
}

export async function getCollections(): Promise<Collection[]> {
  const res = await fetch("/api/collections", { cache: "no-cache" })
  console.log("collections: ", res)
  return res.json()
}

// Hooks: useWordInfo, useWordList, useAddWord, useDeleteWord

export function useCollectionList() {
  return useQuery<Collection[]>({
    queryKey: ["collections"],
    queryFn: getCollections,
  })
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