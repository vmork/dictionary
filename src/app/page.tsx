"use client"

import { APIError, fetchWordInfoFromWeb, NotFound, type WordInfo } from "./lib/scraping"
import WordPage from "./wordPage"
import { useState, useDeferredValue, Suspense } from "react"
import {
  QueryClientProvider,
  QueryClient,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { Button } from "./Button"
import { cn } from "./lib/utils"
import { useAddWord, useDeleteWord, useWordsDB } from "./db/hooks"
import { X } from "lucide-react"
import { WordsDataMap } from "./db/types"

const queryClient = new QueryClient()

export default function Page() {
  return (
    <QueryClientProvider client={queryClient}>
      <Main />
      <ReactQueryDevtools initialIsOpen={true} position="right" />
    </QueryClientProvider>
  )
}

function Main() {
  const queryClient = useQueryClient()

  const [inputText, setInputText] = useState<string>("")
  const [currentWord, setCurrentWord] = useState<string>("")

  const wordsDataQuery = useWordsDB()
  const wordsData: WordsDataMap = new Map()
  wordsDataQuery.data?.forEach((row) => wordsData.set(row.word, row))
  const wordList = Array.from(wordsData.keys())

  const addWordMutation = useAddWord()
  const deleteWordMutation = useDeleteWord()

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
    !wordList.includes(currentWord) &&
    currentWordData?.word === currentWord &&
    (currentWordData as WordInfo)?.definitions?.length // not NotFound

  function dbAddWord(word: string, info: WordInfo) {
    addWordMutation.mutate(
      { word, info },
      {
        onSuccess: () => {
          queryClient.setQueryData(["wordsDB"], (old: WordsDataMap) => {
            const newMap = new Map(old)
            newMap.set(word, { word, dict_entry: info })
            setInputText("")
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
        setCurrentWord("")
      },
      onError: (e) => console,
    })
  }

  return (
    <div className="h-screen flex flex-col">
      <div
        className={`grid sm:grid-cols-[2fr_3fr] sm:grid-rows-1 sm:divide-x-4 sm:divide-y-0 
           grid-rows-[3fr_2fr] grid-cols-1 divide-y-reverse divide-y-4 divide-primary h-full overflow-auto`}
      >
        {/* Word list section */}
        <div className="p-2 flex m-4 flex-col overflow-auto row-start-2 sm:row-start-auto relative">
          <h2 className="text-2xl font-bold mb-2">
            {wordsDataQuery.isPending ? `Loading...` : `${wordList.length} words`}
          </h2>
          <ul className="flex sm:flex-col flex-row gap-2 sm:gap-1">
            {wordList.map((word, i) => (
              <li key={word} className="flex items-center">
                <span
                  onClick={() => {
                    setInputText(word)
                    setCurrentWord(word)
                  }}
                  className={cn("cursor-pointer", word === currentWord && "text-primary font-bold")}
                >
                  {word}
                </span>
                {word === currentWord && (
                  <X
                    className="text-gray cursor-pointer ml-2 hover:bg-neutral-200 transition rounded-md p-1"
                    size={24}
                    onClick={() => dbDeleteWord(word)}
                  />
                )}
              </li>
            ))}
          </ul>

          {/* Input section */}
          <div className="w-[95%] absolute bottom-0 pb-4 mt-2 flex gap-1">
            <input
              className="border-2 p-2 border-gray rounded-lg w-full"
              type="text"
              value={inputText}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setCurrentWord(inputText)
                }
              }}
              onChange={(e) => setInputText(e.target.value)}
            />
            <Button
              disabled={!canAddCurrentWord}
              onClick={() => dbAddWord(currentWord, currentWordData as WordInfo)}
            >
              Add
            </Button>
          </div>
        </div>

        {/* Word info section */}
        <div className="p-2 overflow-auto">
          {currentWordData instanceof APIError ? (
            <h2 className="text-red-600 font-bold">API error: <span className="text-black font-normal">{currentWordData.message}</span></h2>
          ) : (
            <Suspense fallback={<h2 className="text-3xl">Loading...</h2>}>
              <div className={cn(
                // wordDataIsStale && "opacity-50 pointer-events-none"
              )}>
                <WordPage
                  setCurrentWord={(word) => {
                    setInputText(word)
                    setCurrentWord(word)
                  }}
                  data={currentWordData}
                />
              </div>
            </Suspense>
          )}
        </div>
      </div>
    </div>
  )
}
