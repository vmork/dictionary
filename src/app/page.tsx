"use client"

import { fetchWordInfoFromWeb, NotFound, type WordInfo } from "./lib/scraping"
import WordPage from "./wordPage"
import { useState, useEffect, use } from "react"
import { QueryClientProvider, QueryClient, useQuery, useQueryClient } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { Button } from "./Button"
import { cn } from "./lib/utils"
import { getAllWords, useAddWord, useDeleteWord, useWordInfo, useWordList } from "./lib/hooks"
import { X } from "lucide-react"

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

  const wordListQuery = useWordList()
  const wordList = wordListQuery.data ?? []

  const addWordMutation = useAddWord()
  const deleteWordMutation = useDeleteWord()
  const getWordQuery = useWordInfo(currentWord, wordList)

  const currentWordInfo = getWordQuery.data

  const canAddCurrentWord =
    currentWord !== "" &&
    !wordList.includes(currentWord) &&
    currentWordInfo?.word === currentWord &&
    (currentWordInfo as WordInfo)?.definitions?.length

  function dbAddWord(word: string, info: WordInfo) {
    addWordMutation.mutate(
      { word, info },
      {
        onSuccess: () => {
          queryClient.setQueryData(["wordList"], (old: string[]) => [...old, word])
        },
        onError: (e) => console,
      }
    )
  }

  function dbDeleteWord(word: string) {
    deleteWordMutation.mutate(word, {
      onSuccess: () => {
        queryClient.setQueryData(["wordList"], (old: string[]) => old.filter((w) => w !== word))
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
        <div className="p-2 flex m-4 flex-col overflow-auto row-start-2 sm:row-start-auto">
          <h2 className="text-2xl font-bold mb-2">
            {wordListQuery.isPending ? `Loading...` : `${wordList.length} words`}
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
        </div>
        <div className="p-2 overflow-auto">
          {currentWord !== "" ? (
            <WordPage
              setCurrentWord={(word) => {
                setInputText(word)
                setCurrentWord(word)
              }}
              queryInfo={getWordQuery}
            />
          ) : (
            <></>
          )}
        </div>
      </div>

      <div className="sm:w-[41%] sm:mx-0 mx-auto w-[100%] px-4 pb-4 mt-2 flex gap-1">
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
          onClick={() => dbAddWord(currentWord, currentWordInfo as WordInfo)}
        >
          Add
        </Button>
      </div>
    </div>
  )
}
