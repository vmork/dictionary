"use client"

import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { DateTime } from "luxon"
import Link from "next/link"
import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import { useAddWord, useDeleteWord, useWordsDB } from "../../api/queries"
import { useScreenSize } from "../../lib/screenSizeHook"

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
import { TopMenu } from "@/app/components/TopMenu"
import { useResizableSplit } from "@/app/lib/resizeSplit"

export default function Main({ cid }: { cid: CollectionID }) {
  // Resizing bounds in percentages
  const WORDLIST_MIN_SIZE_DESKTOP = 20 // %
  const WORDLIST_MAX_SIZE_DESKTOP = 80 // %
  const WORDLIST_MIN_SIZE_MOBILE  = 11 // % (height of word list)
  const WORDLIST_MAX_SIZE_MOBILE  = 89 // %

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
  const didAutoSelect = useRef(false)

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
  const desktop = useResizableSplit({
    orientation: "vertical",
    initialPercent: 40,
    minPercent: WORDLIST_MIN_SIZE_DESKTOP,
    maxPercent: WORDLIST_MAX_SIZE_DESKTOP,
    active: !isMobile,
  })
  const mobile = useResizableSplit({
    orientation: "horizontal",
    initialPercent: 60,
    minPercent: WORDLIST_MIN_SIZE_MOBILE,
    maxPercent: WORDLIST_MAX_SIZE_MOBILE,
    active: isMobile,
  })

  // Auto-select the most recently added word on first load
  useEffect(() => {
    if (didAutoSelect.current) return
    if (!wordsData || wordsData.size === 0) return
    // Find entry with max time_added
    let latestWord: string | null = null
    let latestTime = -Infinity
    for (const [word, data] of wordsData.entries()) {
      const t = new Date(data.time_added).getTime()
      if (t > latestTime) {
        latestTime = t
        latestWord = word
      }
    }
    if (latestWord) {
      didAutoSelect.current = true
      setInputText(latestWord)
      updateCurrentWord(latestWord)
    }
  }, [wordsData])

  function search() {
    updateCurrentWord(inputText.toLowerCase().trim())
    setInputText(inputText.toLowerCase().trim())
    if (isMobile) inputRef.current?.blur()
  }

  return (
    <div className="h-full flex flex-col">
      <div
        ref={(el) => {
          desktop.setRef(el as HTMLDivElement | null)
          mobile.setRef(el as HTMLDivElement | null)
        }}
  className={`grid sm:grid-rows-1 grid-rows-[3fr_2fr] grid-cols-1 h-full overflow-auto relative`}
  style={isMobile ? mobile.containerStyle : desktop.containerStyle}
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
          </div>
      <ul className="flex flex-wrap gap-2 overflow-y-auto sm:block sm:columns-[120px] sm:gap-x-3">
            {wordList.map((word) => (
        <li key={word} className="w-max sm:w-full break-inside-avoid py-0.5">
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
        <div className="p-3 sm:px-5 overflow-auto">
          {currentWordData instanceof APIError ? (
            <h2 className="text-red-600 font-bold">
              API error: <span className="text-black font-normal">{currentWordData.message}</span>
            </h2>
          ) : (
            <Suspense fallback={<h2 className="text-3xl">Loading...</h2>}>
              {currentWordData && (
                <div className="flex mb-2 gap-1 sticky top-[-12px] bg-background items-center">
                  <NavigationButtons />
                  <div className="ml-auto">
                    <TopMenu cid={cid} />
                  </div>
                </div>
              )}
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

        {/* Drag handles */}
        {!isMobile && (
          <div
            className="hidden sm:block absolute top-0 bottom-0 w-3 cursor-col-resize z-20"
            style={desktop.dividerStyle}
            onMouseDown={desktop.onDividerMouseDown}
            onTouchStart={desktop.onDividerTouchStart}
          >
            <div className="w-[4px] h-full bg-primary mx-auto mr" />
          </div>
        )}
        {isMobile && (
          <div
            className="block sm:hidden absolute left-0 right-0 h-3 cursor-row-resize z-20"
            style={mobile.dividerStyle}
            onMouseDown={mobile.onDividerMouseDown}
            onTouchStart={mobile.onDividerTouchStart}
          >
            <div className="h-[4px] w-full bg-primary my-auto" />
          </div>
        )}
      </div>
    </div>
  )

  function NavigationButtons() {
    return (
      <div className="flex gap-1">
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
