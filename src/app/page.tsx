"use client"

import { fetchWordInfo, NotFound, type WordInfo } from "./api/api"
import WordPage from "./wordPage"
import { useState, useEffect } from "react"
import { QueryClientProvider, QueryClient, useQuery } from "@tanstack/react-query"
import { Button } from "./Button"
import { cn } from "./utils"

const queryClient = new QueryClient()

export default function Page() {
  return (
    <QueryClientProvider client={queryClient}>
      <Main />
    </QueryClientProvider>
  )
}

function Main() {
  const [inputText, setInputText] = useState<string>("test")
  const [currentWord, setCurrentWord] = useState<string>("test")
  const [wordList, setWordList] = useState<string[]>(["test", "alacrity", "manage"])

  const queryInfo = useQuery<WordInfo | NotFound>({
    queryKey: ["word", currentWord],
    enabled: currentWord !== "",
    queryFn: () => fetchWordInfo(currentWord),
    retry: 1,
  })
  const { data: wordInfo, status: queryStatus, error: queryError } = queryInfo

  const canAddCurrentWord =
    currentWord !== "" &&
    !wordList.includes(currentWord) &&
    wordInfo?.word === currentWord &&
    (wordInfo as WordInfo)?.definitions?.length

  return (
    <div className="h-screen flex flex-col">
      <div
        className={
          `grid sm:grid-cols-[2fr_3fr] sm:grid-rows-1 sm:divide-x-4 sm:divide-y-0 
           grid-rows-[3fr_2fr] grid-cols-1 divide-y-reverse divide-y-4 divide-primary h-full overflow-auto`
        }
      >
        <div className="p-2 flex m-4 flex-col overflow-auto row-start-2 sm:row-start-auto">
          <h2 className="text-2xl font-bold mb-2">{wordList.length} words added</h2>
          <ul className="flex sm:flex-col flex-row gap-2 sm:gap-1" >
            {wordList.map((word, i) => (
              <li
                key={i}
                onClick={() => {
                  setInputText(word)
                  setCurrentWord(word)
                }}
                className={cn("cursor-pointer", word === currentWord && "text-primary font-bold")}
              >
                {word}
              </li>
            ))}
          </ul>
        </div>
        <div className="p-2 overflow-auto">
          <WordPage
            setCurrentWord={(word) => {
              setInputText(word)
              setCurrentWord(word)
            }}
            queryInfo={queryInfo}
          />
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
        <Button disabled={!canAddCurrentWord}>Add</Button>
      </div>
    </div>
  )
}
