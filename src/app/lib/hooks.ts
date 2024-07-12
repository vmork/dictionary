import { NotFound as NotWord, WordInfo } from "./scraping"
import { useQuery, useMutation } from "@tanstack/react-query"
import { fetchWordInfoFromWeb } from "./scraping"

async function addWord(word: string, info: WordInfo) {
  const res = await fetch("/api/word", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ word, info }),
  })
  if (!res.ok) throw new Error(res.status + ": " + res.statusText)
}

async function deleteWord(word: string) {
  const res = await fetch(`/api/word?word=${word}`, { method: "DELETE" })
  if (!res.ok) throw new Error(res.status + ": " + res.statusText)
}

async function getWordInfo(word: string): Promise<WordInfo | null> {
  const res = await fetch(`/api/word?word=${word}`)
  if (!res.ok) return null
  return res?.json() ?? null
}

export async function getAllWords() {
  const res = await fetch("/api/allWords")
  return res.json()
}

// Hooks: useWordInfo, useWordList, useAddWord, useDeleteWord

export function useWordInfo(word: string, wordList: string[]) {
  return useQuery<WordInfo | NotWord, Error>({
    queryKey: ["word", word],
    enabled: word !== "",
    queryFn: () => {
      if (wordList.includes(word)) return getWordInfo(word) as unknown as WordInfo
      return fetchWordInfoFromWeb(word)
    },
    retry: 1,
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
