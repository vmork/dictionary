import { WordInfo } from "../lib/scraping"
import { useQuery, useMutation } from "@tanstack/react-query"
import { WordsDataMap, WordsDBRow } from "./types"

async function addWord(word: string, info: WordInfo) {
  const res = await fetch("/api/word", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ word, info }),
    cache: "no-cache",
  })
  if (!res.ok) throw new Error(res.status + ": " + res.statusText)
}

async function deleteWord(word: string) {
  const res = await fetch(`/api/word?word=${word}`, { method: "DELETE", cache: "no-cache" })
  if (!res.ok) throw new Error(res.status + ": " + res.statusText)
}

async function getWordInfo(word: string): Promise<WordInfo | null> {
  const res = await fetch(`/api/word?word=${word}`, { cache: "no-cache" })
  if (!res.ok) return null
  return res?.json() ?? null
}

export async function getAllWords(): Promise<string[]> {
  const res = await fetch("/api/allWords?info=false", { cache: "no-cache" })
  return res.json()
}

export async function getWordsDB(): Promise<WordsDataMap> {
  const res = await fetch("/api/allWords?info=true", { cache: "no-cache" })
  const data: (WordsDBRow & { id: number })[] = await res.json()
  const map: WordsDataMap = new Map()
  data.forEach((row) => map.set(row.word, row))
  return map
}

// Hooks: useWordInfo, useWordList, useAddWord, useDeleteWord

export function useWordsDB() {
  return useQuery<WordsDataMap>({
    queryKey: ["wordsDB"],
    queryFn: getWordsDB,
  })
}

export function useWordList() {
  return useQuery<string[]>({
    queryKey: ["wordList"],
    queryFn: getAllWords,
  })
}

export function useAddWord() {
  return useMutation({
    mutationKey: ["addWord"],
    mutationFn: ({ word, info }: { word: string; info: WordInfo }) => addWord(word, info),
  })
}

export function useDeleteWord() {
  return useMutation({
    mutationKey: ["deleteWord"],
    mutationFn: (word: string) => deleteWord(word),
  })
}
