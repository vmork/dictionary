"use client"

import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { DateTime } from "luxon"
import Link from "next/link"
import { Suspense, useMemo, useRef, useState } from "react"
import { useAddWord, useDeleteWord, useWordsDB } from "../../api/queries"
import { useScreenSize } from "../../lib/hooks"
// Removed direct client-side scraping import to avoid CORS; use server API route instead
import {
  APIError,
  NotFound,
  DictEntry,
  DictEntryFromDB,
  DictEntryFromNet,
  WordsDataMap,
} from "../../lib/types"
import { cn } from "../../lib/utils"
import { Button } from "../../components/Button"
import { SortDropdown } from "../../components/SortDropdown"
import { defaultSortKeys, sortEntries, SortKey } from "../../lib/sorting"
import WordDataPage from "./DictEntryPage"
import { MoveLeft, MoveRight } from "lucide-react"
import { CollectionID } from "@/app/lib/collections"

export default function Main({ cid }: { cid: CollectionID }) {
  const history = useMemo(() => {
    class History {
      constructor(public history: string[] = [], public idx: number = -1) {}
      getCurrent() {
        return this.history[this.idx]
      }
      goBack() {
        this.idx = this.idx - (this.idx <= 0 ? 0 : 1)
        setCurrentWord(this.getCurrent())
      }
      goForward() {
        this.idx = this.idx + (this.idx === this.history.length - 1 ? 0 : 1)
        setCurrentWord(this.getCurrent())
      }
      add(word: string) {
        let i = this.history.indexOf(word)
        if (i !== -1) {
          // word already exists in history, just go back to that point
          this.idx = i
        } else {
          // new word, remove forward history and add the word
          this.history = this.history.slice(0, this.idx + 1)
          this.history.push(word)
          this.idx++
        }
      }
    }
    return new History()
  }, [])

  const queryClient = useQueryClient()

  const [inputText, setInputText] = useState<string>("")
  const [currentWord, setCurrentWord] = useState<string>("")
  const [sortKeys, setSortKeys] = useState<SortKey[]>(defaultSortKeys)

  const wordsDataQuery = useWordsDB(cid)
  const wordsData: WordsDataMap = useMemo(() => wordsDataQuery.data ?? new Map(), [wordsDataQuery])
  const wordSet = useMemo(() => new Set(wordsData.keys()), [wordsData])
  const wordList = useMemo(() => {
    const entries = Array.from(wordsData.entries()).map(([word, data]) => ({
      ...data.dict_entry,
      type: "db" as const,
      timeAdded: data.time_added,
      word
    })) as DictEntryFromDB[]
    
    const sortedEntries = sortEntries(entries, sortKeys)
    return sortedEntries.map(entry => entry.word)
  }, [wordsData, sortKeys])

  const addWordMutation = useAddWord(cid)
  const deleteWordMutation = useDeleteWord(cid)

  const inputRef = useRef<HTMLInputElement>(null)

  const currentWordDataQuery = useSuspenseQuery<DictEntry | NotFound | APIError | null>({
    queryKey: ["word", currentWord, cid],
    queryFn: async () => {
      if (currentWord === "") return null
      if (wordsData.has(currentWord)) {
        const data = wordsData.get(currentWord)!
        return { ...data.dict_entry, type: "db", timeAdded: data.time_added, practiceData: data.practice_data } as DictEntryFromDB
      }
      const res = await fetch(`/api/fetchWord?word=${encodeURIComponent(currentWord)}`)
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        return new APIError(json.message || res.status + ": " + res.statusText)
      }
      const json = await res.json()
      if (json.kind === "notfound") return new NotFound(json.didYouMean, json.word)
      if (json.kind === "error") return new APIError(json.message)
      return json.entry as DictEntry
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

  function updateCurrentWord(word: string) {
    history.add(word)
    setCurrentWord(word)
  }

  function dbAddWord(word: string, info: DictEntry) {
    const isoNow = DateTime.now().toISO()

    addWordMutation.mutate(
      { word, info, timeString: isoNow },
      {
        onSuccess: () => {
          queryClient.setQueryData(["wordsDB", cid], (old: WordsDataMap) => {
            const newMap = new Map(old)
            newMap.set(word, { 
              word, 
              dict_entry: info, 
              time_added: isoNow,
              practice_data: { numSeen: 0, lastFive: [], numCorrect: 0 }
            })
            return newMap
          })
          queryClient.setQueryData(["word", word, cid], (old: DictEntryFromNet) => {
            return { ...old, type: "db", timeAdded: isoNow, practiceData: { numSeen: 0, lastFive: [], numCorrect: 0 } } as DictEntryFromDB
          })
        },
        onError: (e) => console,
      }
    )
  }

  function dbDeleteWord(word: string) {
    deleteWordMutation.mutate(word, {
      onSuccess: () => {
        queryClient.setQueryData(["wordsDB", cid], (old: WordsDataMap) => {
          const newMap = new Map(old)
          newMap.delete(word)
          return newMap
        })
        queryClient.setQueryData(["word", word, cid], (old: DictEntryFromDB) => {
          return { ...old, type: "net" } as DictEntryFromNet
        })
      },
      onError: (e) => console,
    })
  }

  const { width: screenWidth } = useScreenSize()
  const isMobile = screenWidth ? screenWidth < 700 : false

  function search() {
    updateCurrentWord(inputText.toLowerCase().trim())
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
            <div className="ml-3">
              <SortDropdown sortKeys={sortKeys} setSortKeys={setSortKeys} />
            </div>
            <div className="flex ml-auto gap-2">
              <Link href={`/`}>
                <Button className="bg-primary hover:bg-primary text-dark text-sm px-3 py-1 transition-colors">
                  Home
                </Button>
              </Link>
              <Link href={`/practice?cid=${cid}`}>
                <Button className="bg-primary hover:bg-primary text-dark text-sm px-3 py-1 transition-colors">
                  Practice
                </Button>
              </Link>
            </div>
          </div>
          <ul className="flex flex-wrap gap-2 overflow-y-auto sm:grid sm:grid-cols-[repeat(auto-fill,minmax(120px,1fr))] sm:gap-x-5">
            {wordList.map((word) => (
              <li key={word} className="w-max">
                <span
                  onClick={() => {
                    setInputText(word)
                    updateCurrentWord(word)
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
                  else if (searchAddDeleteState === "add") dbAddWord(currentWord, currentWordData as DictEntry)
                }
              }}
              onChange={(e) => setInputText(e.target.value)}
            />
            {searchAddDeleteState === "search" ? (
              <Button disabled={inputText === ""} onClick={search}>
                Search
              </Button>
            ) : searchAddDeleteState === "delete" ? (
              <Button className={"bg-red-300"} onClick={() => dbDeleteWord(currentWord)}>Delete</Button>
            ) : (
              <Button
                onClick={() => dbAddWord(currentWord, currentWordData as DictEntry)}
                disabled={!canAddCurrentWord}
              >
                Add
              </Button>
            )}
          </div>
        </div>

        {/* Word info section */}
        <div className="p-3 overflow-auto">
          {currentWordData instanceof APIError ? (
            <h2 className="text-red-600 font-bold">
              API error: <span className="text-black font-normal">{currentWordData.message}</span>
            </h2>
          ) : (
            <Suspense fallback={<h2 className="text-3xl">Loading...</h2>}>
              {currentWordData && <NavigationButtons />}
              <WordDataPage
                setCurrentWord={(word) => {
                  setInputText(word)
                  updateCurrentWord(word)
                }}
                data={currentWordData}
                wordSet={wordSet}
              />
            </Suspense>
          )}
        </div>
      </div>
    </div>
  )

  function NavigationButtons() {
    return (
      <div className="flex mb-2 gap-1 sticky top-[-12px] bg-background">
        <Button
          className="bg-transparent whitespace-nowrap px-1 py-0.5 rounded-md text-sm transition hover:bg-neutral-300 disabled:hover:bg-transparent disabled:text-neutral-400 disabled:cursor-default"
          disabled={history.idx === 0}
          onClick={() => history.goBack()}
        >
          <MoveLeft />
        </Button>
        <Button
          className="bg-transparent whitespace-nowrap px-1 py-0.5 rounded-md text-sm transition hover:bg-neutral-300 disabled:hover:bg-transparent disabled:text-neutral-400 disabled:cursor-default"
          disabled={history.idx === history.history.length - 1}
          onClick={() => history.goForward()}
        >
          <MoveRight />
        </Button>
      </div>
    )
  }
}
