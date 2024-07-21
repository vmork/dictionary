"use client"

import { fetchWordInfoFromWeb } from "../lib/scraping"
import { APIError, NotFound, WordInfo, WordInfoFromDB, WordInfoFromNet } from "../lib/types"
import WordPage from "./WordPage"
import { useState, useMemo, useDeferredValue, Suspense, useRef } from "react"
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { Button } from "./Button"
import { cn } from "../lib/utils"
import { useAddWord, useDeleteWord, useWordsDB } from "../db/queries"
import { WordsDataMap } from "../lib/types"
import { useScreenSize } from "../lib/hooks"
import Link from "next/link"
import { DateTime } from "luxon"

export default function Main() {
  const queryClient = useQueryClient()

  const [inputText, setInputText] = useState<string>("")
  const [currentWord, setCurrentWord] = useState<string>("")

  const wordsDataQuery = useWordsDB()
  const wordsData: WordsDataMap = useMemo(() => wordsDataQuery.data ?? new Map(), [wordsDataQuery])
  const wordSet = useMemo(() => new Set(wordsData.keys()), [wordsData])
  const wordList = useMemo(
    () =>
      Array.from(wordsData.entries())
        .sort((a, b) => DateTime.fromISO(b[1].time_added).toMillis() - DateTime.fromISO(a[1].time_added).toMillis())
        .map(([word, data]) => word),
    [wordsData]
  )

  const addWordMutation = useAddWord()
  const deleteWordMutation = useDeleteWord()

  const inputRef = useRef<HTMLInputElement>(null)

  const currentWordDataQuery = useSuspenseQuery<WordInfo | NotFound | APIError | null>({
    queryKey: ["word", currentWord],
    queryFn: async () => {
      if (currentWord === "") return null
      if (wordsData.has(currentWord)) {
        const data = wordsData.get(currentWord)!
        return { ...data.dict_entry, type: "db", timeAdded: data.time_added } as WordInfoFromDB
      }
      return await fetchWordInfoFromWeb(currentWord)
    },
    retry: 0,
  })
  const currentWordData = currentWordDataQuery.data

  const canAddCurrentWord =
    currentWord !== "" &&
    !(currentWordData instanceof APIError) &&
    !wordSet.has(currentWord) &&
    currentWordData?.word === currentWord &&
    !(currentWordData instanceof NotFound) &&
    currentWordData?.definitions?.length

  const searchAddDeleteState: "search" | "add" | "delete" =
    currentWord !== inputText || inputText === "" ? "search" : wordsData.has(currentWord) ? "delete" : "add"

  function dbAddWord(word: string, info: WordInfo) {
    const isoNow = DateTime.now().toISO()

    addWordMutation.mutate(
      { word, info, timeString: isoNow },
      {
        onSuccess: () => {
          queryClient.setQueryData(["wordsDB"], (old: WordsDataMap) => {
            const newMap = new Map(old)
            newMap.set(word, { word, dict_entry: info, time_added: isoNow })
            return newMap
          })
          queryClient.setQueryData(["word", word], (old: WordInfoFromNet) => {
            return {...old, type: "db", timeAdded: isoNow} as WordInfoFromDB
          })
        },
        onError: (e) => console,
      }
    )
  }

  function dbDeleteWord(word: string) {
    deleteWordMutation.mutate(word, {
      onSuccess: () => {
        queryClient.setQueryData(["wordsDB"], (old: WordsDataMap) => {
          const newMap = new Map(old)
          newMap.delete(word)
          return newMap
        })
        queryClient.setQueryData(["word", word], (old: WordInfoFromDB) => {
          return {...old, type: "net"} as WordInfoFromNet
        })
      },
      onError: (e) => console,
    })
  }

  const { width: screenWidth } = useScreenSize()
  const isMobile = screenWidth ? screenWidth < 640 : false

  function search() {
    setCurrentWord(inputText.toLowerCase().trim())
    setInputText(inputText.toLowerCase().trim())
    if (isMobile) inputRef.current?.blur()
  }

  return (
    <div className="h-full flex flex-col">
      <div
        className={`grid sm:grid-cols-[2fr_3fr] sm:grid-rows-1 sm:divide-x-4 sm:divide-y-0 
             grid-rows-[3fr_2fr] grid-cols-1 divide-y-reverse divide-y-4 divide-primary h-full overflow-auto`}
      >
        {/* Word list section */}
        <div className="p-2 sm:px-4 flex flex-col overflow-auto row-start-2 sm:row-start-auto relative">
          <div className="flex sm:mb-2 mb-1 items-center">
            <h2 className="sm:text-2xl text-lg font-bold">
              {wordsDataQuery.isPending ? `Loading...` : `${wordSet.size} words`}
            </h2>
            <Link href="/practice" className="ml-auto">
              <Button className="p-1">Practice</Button>
            </Link>
          </div>
          <ul className="flex sm:flex-col flex-row flex-wrap gap-2 sm:gap-y-1 sm:gap-x-10 overflow-y-auto content-start">
            {wordList.map(word => (
              <li key={word} className="w-max">
                <span
                  onClick={() => {
                    setInputText(word)
                    setCurrentWord(word)
                  }}
                  className={cn("cursor-pointer", word === currentWord && "text-primary")}
                >
                  {word}
                </span>
              </li>
            ))}
          </ul>

          {/* Input section */}
          <div className="w-[100%] mb-2 sm:mb-4 mt-auto flex gap-1">
            <input
              ref={inputRef}
              className="border-2 p-2 border-gray rounded-lg w-full"
              type="text"
              value={inputText}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (searchAddDeleteState === "search") search()
                  else if (searchAddDeleteState === "add") dbAddWord(currentWord, currentWordData as WordInfo)
                }
              }}
              onChange={(e) => setInputText(e.target.value)}
            />
            {searchAddDeleteState === "search" ? (
              <Button disabled={inputText === ""} onClick={search}>
                Search
              </Button>
            ) : searchAddDeleteState === "delete" ? (
              <Button onClick={() => dbDeleteWord(currentWord)}>Delete</Button>
            ) : (
              <Button onClick={() => dbAddWord(currentWord, currentWordData as WordInfo)} disabled={!canAddCurrentWord}>
                Add
              </Button>
            )}
          </div>
        </div>

        {/* Word info section */}
        <div className="p-2 overflow-auto">
          {currentWordData instanceof APIError ? (
            <h2 className="text-red-600 font-bold">
              API error: <span className="text-black font-normal">{currentWordData.message}</span>
            </h2>
          ) : (
            <Suspense fallback={<h2 className="text-3xl">Loading...</h2>}>
              <div
                className={
                  cn()
                  // wordDataIsStale && "opacity-50 pointer-events-none"
                }
              >
                <WordPage
                  setCurrentWord={(word) => {
                    setInputText(word)
                    setCurrentWord(word)
                  }}
                  data={currentWordData}
                  wordSet={wordSet}
                />
              </div>
            </Suspense>
          )}
        </div>
      </div>
    </div>
  )
}
