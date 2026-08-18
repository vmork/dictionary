"use client"

import { ArrowUpDown, ChevronDown, ChevronUp } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"
import { SortKey, SortKeyName } from "../lib/sorting"
import { cn } from "../lib/utils"

function directionLabel(sortKey: SortKey, ascending: boolean) {
  if (sortKey.name === "Alphabetical") return ascending ? "A to Z" : "Z to A"
  return ascending ? "Oldest first" : "Newest first"
}

function SortOption({
  inputId,
  sortKey,
  selected,
  onSelect,
  onToggleDirection,
}: {
  inputId: string
  sortKey: SortKey
  selected: boolean
  onSelect: (name: SortKeyName) => void
  onToggleDirection: (name: SortKeyName, ascending: boolean) => void
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded border px-3 py-2 text-sm whitespace-nowrap transition-colors",
        selected ? "border-primary bg-primary/20" : "border-border bg-light"
      )}
    >
      <input
        id={inputId}
        type="radio"
        name="word-sort-key"
        checked={selected}
        onChange={() => onSelect(sortKey.name)}
        className="h-4 w-4 flex-none accent-slate-700"
      />
      <label htmlFor={inputId} className="min-w-0 flex-1 cursor-pointer">
        {sortKey.name}
      </label>
      <div className="flex flex-shrink-0 gap-1" aria-label={`${sortKey.name} direction`} role="group">
        {[true, false].map((ascending) => (
          <button
            key={ascending ? "ascending" : "descending"}
            type="button"
            aria-label={directionLabel(sortKey, ascending)}
            aria-pressed={sortKey.ascending === ascending}
            title={directionLabel(sortKey, ascending)}
            className={cn(
              "rounded px-1.5 py-1 text-xs transition-colors",
              sortKey.ascending === ascending
                ? "bg-primary text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
            onClick={() => onToggleDirection(sortKey.name, ascending)}
          >
            {ascending ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        ))}
      </div>
    </div>
  )
}

export function SortDropdown({
  sortKeys,
  selectedSortKeyName,
  setSortKeys,
  setSelectedSortKeyName,
}: {
  sortKeys: SortKey[]
  selectedSortKeyName: SortKeyName
  setSortKeys: (sortKeys: SortKey[]) => void
  setSelectedSortKeyName: (name: SortKeyName) => void
}) {
  const [displayPopup, setDisplayPopup] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const popupId = useId()

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDisplayPopup(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setDisplayPopup(false)
    }

    if (displayPopup) {
      document.addEventListener("mousedown", handlePointerDown)
      document.addEventListener("keydown", handleKeyDown)
    }

    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [displayPopup])

  function handleToggleDirection(name: SortKeyName, ascending: boolean) {
    setSelectedSortKeyName(name)
    setSortKeys(
      sortKeys.map((item) => item.name === name ? { ...item, ascending } : item)
    )
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        aria-controls={popupId}
        aria-expanded={displayPopup}
        aria-haspopup="true"
        className="flex items-center gap-2 rounded bg-primary px-3 py-1 text-center text-base shadow-sm transition hover:brightness-110"
        onClick={() => setDisplayPopup((visible) => !visible)}
      >
        <ArrowUpDown size={13} />
        Sort
      </button>
      {displayPopup && (
        <fieldset
          id={popupId}
          className="absolute left-0 top-9 z-30 flex min-w-64 flex-col gap-1 rounded border border-border bg-light p-1 shadow-lg"
        >
          <legend className="sr-only">Sort words by</legend>
          {sortKeys.map((sortKey, index) => (
            <SortOption
              key={sortKey.name}
              inputId={`${popupId}-${index}`}
              sortKey={sortKey}
              selected={sortKey.name === selectedSortKeyName}
              onSelect={setSelectedSortKeyName}
              onToggleDirection={handleToggleDirection}
            />
          ))}
        </fieldset>
      )}
    </div>
  )
}
