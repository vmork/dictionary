"use client"

import { APIError, fetchWordInfoFromWeb, NotFound, type WordInfo } from "./lib/scraping"
import WordPage from "./wordPage"
import { useState, useMemo, useDeferredValue, Suspense, useRef } from "react"
import { QueryClientProvider, QueryClient, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { Button } from "./Button"
import { cn } from "./lib/utils"
import { useAddWord, useDeleteWord, useWordsDB } from "./db/hooks"
import { WordsDataMap } from "./db/types"
import { useScreenSize } from "./lib/hooks"

const queryClient = new QueryClient()

export default function Page() {
  return (
    <QueryClientProvider client={queryClient}>
      <Main />
      {/* <ReactQueryDevtools initialIsOpen={true} position="right" /> */}
    </QueryClientProvider>
  )
}

function Main() {
  const queryClient = useQueryClient()

  const [inputText, setInputText] = useState<string>("")
  const [currentWord, setCurrentWord] = useState<string>("")

  const wordsDataQuery = useWordsDB()
  const wordsData: WordsDataMap = useMemo(() => wordsDataQuery.data ?? new Map(), [wordsDataQuery])
  const wordSet = useMemo(() => new Set(wordsData.keys()), [wordsData])

  const addWordMutation = useAddWord()
  const deleteWordMutation = useDeleteWord()

  const inputRef = useRef<HTMLInputElement>(null)

  const currentWordDataQuery = useSuspenseQuery<WordInfo | NotFound | APIError | null>({
    queryKey: ["word", currentWord],
    queryFn: () => {
      if (currentWord === "") return null
      if (wordsData.has(currentWord)) return wordsData.get(currentWord)!.dict_entry
      return fetchWordInfoFromWeb(currentWord)
    },
    retry: 0,
  })
  const deferredCurrentWordDataQuery = useDeferredValue(currentWordDataQuery)
  const wordDataIsStale = currentWordDataQuery !== deferredCurrentWordDataQuery

  const currentWordData = deferredCurrentWordDataQuery.data

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
    addWordMutation.mutate(
      { word, info },
      {
        onSuccess: () => {
          queryClient.setQueryData(["wordsDB"], (old: WordsDataMap) => {
            const newMap = new Map(old)
            newMap.set(word, { word, dict_entry: info })
            return newMap
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
          <h2 className="sm:text-2xl text-lg font-bold sm:mb-2">
            {wordsDataQuery.isPending ? `Loading...` : `${wordSet.size} words`}
          </h2>
          <ul className="flex sm:flex-col flex-row flex-wrap gap-2 sm:gap-y-1 sm:gap-x-10 overflow-y-auto content-start">
            {Array.from(wordSet).map((word, i) => (
              <li key={word} className="w-max">
                <span
                  onClick={() => {
                    setInputText(word)
                    setCurrentWord(word)
                  }}
                  className={cn("cursor-pointer", word === currentWord && "text-primary font-bold")}
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
