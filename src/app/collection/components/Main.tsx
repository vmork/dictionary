"use client"

import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { DateTime } from "luxon"
import Link from "next/link"
import { Suspense, useEffect, useId, useMemo, useRef, useState } from "react"
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
import { defaultSortKeyName, defaultSortKeys, sortEntries, SortKey, SortKeyName } from "../../lib/sorting"
import WordDataPage from "./DictEntryPage"
import { MoveLeft, MoveRight } from "lucide-react"
import { CollectionID } from "@/app/lib/collections"
import { TopMenu } from "@/app/components/TopMenu"
import { useResizableSplit } from "@/app/lib/resizeSplit"

export default function Main({ cid }: { cid: CollectionID }) {
  // Resizing bounds in percentages
  const WORDLIST_MIN_SIZE_DESKTOP = 20 // %
  const WORDLIST_MAX_SIZE_DESKTOP = 80 // %
  const MAIN_CONTENT_MIN_SIZE_MOBILE = 20 // % (word list uses the remaining height)
  const MAIN_CONTENT_MAX_SIZE_MOBILE = 80 // %

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
  const [selectedSortKeyName, setSelectedSortKeyName] = useState<SortKeyName>(defaultSortKeyName)
  const [confirmDeleteWord, setConfirmDeleteWord] = useState<string | null>(null)

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
    
    const selectedSortKey = sortKeys.find((sortKey) => sortKey.name === selectedSortKeyName) ?? sortKeys[0]
    const sortedEntries = sortEntries(entries, selectedSortKey)
    return sortedEntries.map(entry => entry.word)
  }, [selectedSortKeyName, sortKeys, wordsData])

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
        setConfirmDeleteWord(null)
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
  // Keep this aligned with the custom `sm` breakpoint in tailwind.config.ts.
  const isMobile = screenWidth ? screenWidth < 768 : false
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
    minPercent: MAIN_CONTENT_MIN_SIZE_MOBILE,
    maxPercent: MAIN_CONTENT_MAX_SIZE_MOBILE,
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
        className="relative grid h-full grid-cols-1 grid-rows-[3fr_2fr] overflow-hidden sm:grid-rows-1"
        style={isMobile ? mobile.containerStyle : desktop.containerStyle}
      >
        {/* Word list section */}
        <div className="p-2 sm:px-4 flex flex-col overflow-auto row-start-2 sm:row-start-auto relative">
          <div className="flex sm:mb-2 mb-1 items-center">
            <h2 className="sm:text-2xl text-lg font-bold">
              {wordsDataQuery.isPending ? `Loading...` : `${wordSet.size} words`}
            </h2>
            <div className="ml-3">
              <SortDropdown
                sortKeys={sortKeys}
                selectedSortKeyName={selectedSortKeyName}
                setSortKeys={setSortKeys}
                setSelectedSortKeyName={setSelectedSortKeyName}
              />
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
              onChange={(e) => {
                setInputText(e.target.value)
                setConfirmDeleteWord(null)
              }}
            />
            <Button className="hidden sm:block" disabled={inputText === ""} onClick={search}>
              Search
            </Button>
            {searchAddDeleteState === "search" ? (
              <Button className="sm:hidden" disabled={inputText === ""} onClick={search}>
                Search
              </Button>
            ) : (
              <WordActionButton
                className="sm:hidden"
                action={searchAddDeleteState}
                word={currentWord}
                canAdd={Boolean(canAddCurrentWord)}
                addPending={addWordMutation.isPending}
                deletePending={deleteWordMutation.isPending}
                deleteConfirmationOpen={confirmDeleteWord === currentWord}
                onAdd={() => dbAddWord(currentWord, currentWordData as DictEntry)}
                onRequestDelete={() => setConfirmDeleteWord(currentWord)}
                onCancelDelete={() => setConfirmDeleteWord(null)}
                onConfirmDelete={() => dbDeleteWord(currentWord)}
              />
            )}
          </div>
        </div>

        {/* Word info section */}
        <div className="relative min-h-0 overflow-hidden">
          <div className="h-full overflow-auto p-3 sm:px-5 sm:pb-24">
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
          {searchAddDeleteState !== "search" && (
            <WordActionButton
              className="absolute bottom-5 left-1/2 z-30 hidden -translate-x-1/2 sm:block"
              action={searchAddDeleteState}
              word={currentWord}
              canAdd={Boolean(canAddCurrentWord)}
              addPending={addWordMutation.isPending}
              deletePending={deleteWordMutation.isPending}
              deleteConfirmationOpen={confirmDeleteWord === currentWord}
              onAdd={() => dbAddWord(currentWord, currentWordData as DictEntry)}
              onRequestDelete={() => setConfirmDeleteWord(currentWord)}
              onCancelDelete={() => setConfirmDeleteWord(null)}
              onConfirmDelete={() => dbDeleteWord(currentWord)}
            />
          )}
        </div>

        {/* Drag handles */}
        {!isMobile && (
          <div
            role="separator"
            aria-label="Resize word list and definition"
            aria-orientation="vertical"
            aria-valuemin={WORDLIST_MIN_SIZE_DESKTOP}
            aria-valuemax={WORDLIST_MAX_SIZE_DESKTOP}
            aria-valuenow={Math.round(desktop.primaryPercent)}
            tabIndex={0}
            className="group absolute inset-y-0 z-20 hidden w-5 -translate-x-1/2 touch-none select-none cursor-col-resize items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:flex"
            style={desktop.dividerStyle}
            onPointerDown={desktop.onDividerPointerDown}
            onPointerMove={desktop.onDividerPointerMove}
            onPointerUp={desktop.onDividerPointerEnd}
            onPointerCancel={desktop.onDividerPointerEnd}
            onLostPointerCapture={desktop.onDividerPointerEnd}
            onKeyDown={desktop.onDividerKeyDown}
          >
            <div className="pointer-events-none h-full w-1 bg-primary transition-colors group-hover:brightness-90" />
          </div>
        )}
        {isMobile && (
          <div
            role="separator"
            aria-label="Resize definition and word list"
            aria-orientation="horizontal"
            aria-valuemin={MAIN_CONTENT_MIN_SIZE_MOBILE}
            aria-valuemax={MAIN_CONTENT_MAX_SIZE_MOBILE}
            aria-valuenow={Math.round(mobile.primaryPercent)}
            tabIndex={0}
            className="group absolute inset-x-0 z-20 flex h-11 -translate-y-1/2 touch-none select-none cursor-row-resize items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:hidden"
            style={mobile.dividerStyle}
            onPointerDown={mobile.onDividerPointerDown}
            onPointerMove={mobile.onDividerPointerMove}
            onPointerUp={mobile.onDividerPointerEnd}
            onPointerCancel={mobile.onDividerPointerEnd}
            onLostPointerCapture={mobile.onDividerPointerEnd}
            onKeyDown={mobile.onDividerKeyDown}
          >
            <div className="pointer-events-none relative h-px w-full bg-primary/60">
              <div className="absolute left-1/2 top-1/2 h-1.5 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-sm transition-transform group-active:scale-x-110" />
            </div>
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

function WordActionButton({
  action,
  word,
  canAdd,
  addPending,
  deletePending,
  deleteConfirmationOpen,
  onAdd,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
  className,
}: {
  action: "add" | "delete"
  word: string
  canAdd: boolean
  addPending: boolean
  deletePending: boolean
  deleteConfirmationOpen: boolean
  onAdd: () => void
  onRequestDelete: () => void
  onCancelDelete: () => void
  onConfirmDelete: () => void
  className?: string
}) {
  const confirmationId = useId()
  const confirmationLabelId = useId()

  if (action === "add") {
    return (
      <div className={cn("relative flex-none", className)}>
        <Button
          className="min-w-20 bg-green-600 text-white shadow-lg ring-1 ring-green-700/20"
          onClick={onAdd}
          disabled={!canAdd || addPending}
        >
          {addPending ? "Adding…" : "Add"}
        </Button>
      </div>
    )
  }

  return (
    <div
      className={cn("relative flex-none", className)}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault()
          onCancelDelete()
        }
      }}
    >
      <Button
        className="min-w-20 bg-reddish shadow-lg ring-1 ring-red-300/40"
        type="button"
        aria-controls={confirmationId}
        aria-expanded={deleteConfirmationOpen}
        aria-haspopup="dialog"
        onClick={deleteConfirmationOpen ? onCancelDelete : onRequestDelete}
        disabled={deletePending}
      >
        Delete
      </Button>
      {deleteConfirmationOpen && (
        <div
          id={confirmationId}
          role="dialog"
          aria-labelledby={confirmationLabelId}
          className="absolute bottom-[calc(100%+0.75rem)] right-0 z-40 w-64 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-white p-3 text-left shadow-xl sm:left-1/2 sm:right-auto sm:-translate-x-1/2"
        >
          <p id={confirmationLabelId} className="font-semibold text-dark">Delete “{word}”?</p>
          <p className="mt-1 text-sm text-neutral-600">Are you sure? This cannot be undone.</p>
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              className="rounded px-2.5 py-1.5 text-sm text-neutral-600 transition hover:bg-neutral-100"
              onClick={onCancelDelete}
              disabled={deletePending}
            >
              Cancel
            </button>
            <Button
              className="bg-red-600 px-2.5 py-1.5 text-sm text-white"
              onClick={onConfirmDelete}
              disabled={deletePending}
            >
              {deletePending ? "Deleting…" : "Delete"}
            </Button>
          </div>
          <span className="absolute -bottom-1.5 right-7 h-3 w-3 rotate-45 border-b border-r border-border bg-white sm:left-1/2 sm:right-auto sm:-translate-x-1/2" />
        </div>
      )}
    </div>
  )
}
