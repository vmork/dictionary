"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import type {
  EtymologyRelation,
  EtymologyTree as EtymologyTreeData,
  EtymologyTreeNode,
  LinkWithTitle,
} from "@/app/lib/types"
import { findCollapsedSharedAncestryPaths } from "@/app/lib/etymologyTreeDisplay"
import { cn } from "@/app/lib/utils"

const PART_OF_SPEECH_LABELS: Record<string, string> = {
  adj: "adjective",
  adv: "adverb",
  noun: "noun",
  verb: "verb",
}

function edgeClass(relation?: EtymologyRelation): string {
  if (relation === "borrowed") return "border-sky-400 border-dashed"
  if (relation === "formed") return "border-neutral-400 border-dotted"
  return "border-neutral-400 border-solid"
}

function NodeCard({
  node,
  isRoot,
  sharedAncestry = false,
}: {
  node: EtymologyTreeNode
  isRoot: boolean
  sharedAncestry?: boolean
}) {
  return (
    <div
      className={cn(
        "relative z-10 w-max min-w-[7rem] max-w-[11rem] rounded-md border bg-white px-2.5 py-2 text-center shadow-sm",
        isRoot && "border-primary bg-primary/15 shadow"
      )}
    >
      <div className="mb-1 flex items-center justify-center gap-1">
        <span className="rounded-sm bg-primary/45 px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-700">
          {node.language}
        </span>
        {node.uncertain && (
          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[0.65rem] font-bold text-amber-800" title="Uncertain origin">
            ?
          </span>
        )}
      </div>
      <div className="break-words font-medium leading-tight">{node.word}</div>
      {node.romanization && node.romanization !== node.word && (
        <div className="mt-0.5 break-words text-xs italic text-neutral-500">{node.romanization}</div>
      )}
      {node.gloss && (
        <div className="mt-1 break-words text-xs leading-snug text-neutral-500">{node.gloss}</div>
      )}
      {sharedAncestry && (
        <div className="mt-1.5 border-t border-dashed border-neutral-300 pt-1 text-[0.65rem] font-medium uppercase tracking-wide text-neutral-400">
          shared ancestry
        </div>
      )}
    </div>
  )
}

function OriginNode({
  node,
  collapsedPaths,
  isRoot = false,
  path = "root",
}: {
  node: EtymologyTreeNode
  collapsedPaths: Set<string>
  isRoot?: boolean
  path?: string
}) {
  const sharedAncestry = collapsedPaths.has(path)
  const visibleParents = sharedAncestry ? [] : node.parents
  const hasMultipleParents = visibleParents.length > 1

  return (
    <div className="flex min-w-max flex-col items-center">
      {visibleParents.length > 0 && (
        <>
          <div className="flex items-end">
            {visibleParents.map((parent, index) => (
              <div
                className="relative flex min-w-max flex-col items-center px-2"
                key={`${parent.languageCode}:${parent.word}:${index}`}
              >
                <OriginNode
                  node={parent}
                  collapsedPaths={collapsedPaths}
                  path={`${path}.${index}`}
                />
                <div
                  aria-hidden="true"
                  className={cn("h-4 border-l-2", edgeClass(parent.relationToChild))}
                />
                {hasMultipleParents && (
                  <div
                    aria-hidden="true"
                    className={cn(
                      "absolute bottom-0 border-t-2 border-neutral-300",
                      index === 0 ? "left-1/2 right-0" : index === visibleParents.length - 1 ? "left-0 right-1/2" : "left-0 right-0"
                    )}
                  />
                )}
              </div>
            ))}
          </div>
          <div aria-hidden="true" className="h-4 border-l-2 border-neutral-300" />
        </>
      )}
      <NodeCard node={node} isRoot={isRoot} sharedAncestry={sharedAncestry} />
    </div>
  )
}

function LegendLine({ relation, label }: { relation: EtymologyRelation; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true" className={cn("w-5 border-t-2", edgeClass(relation))} />
      {label}
    </span>
  )
}

export default function EtymologyTree({
  word,
  trees,
  source,
}: {
  word: string
  trees?: EtymologyTreeData[]
  source?: LinkWithTitle
}) {
  const [fetchedTrees, setFetchedTrees] = useState<EtymologyTreeData[] | undefined>()
  const [fetchedSource, setFetchedSource] = useState<LinkWithTitle | undefined>()

  useEffect(() => {
    if (trees !== undefined) return

    const controller = new AbortController()

    async function loadTrees() {
      try {
        const response = await fetch(`/api/etymologyTree?word=${encodeURIComponent(word)}`, {
          signal: controller.signal,
        })
        if (!response.ok) throw new Error(`Origin lookup failed (${response.status})`)

        const result = await response.json() as {
          trees?: EtymologyTreeData[]
          source?: LinkWithTitle
        }
        if (!controller.signal.aborted) {
          setFetchedTrees(Array.isArray(result.trees) ? result.trees : [])
          setFetchedSource(result.source)
        }
      } catch {
        if (!controller.signal.aborted) setFetchedTrees([])
      }
    }

    void loadTrees()
    return () => controller.abort()
  }, [trees, word])

  const resolvedTrees = trees ?? fetchedTrees
  const resolvedSource = source ?? fetchedSource

  if (resolvedTrees === undefined) {
    return (
      <section
        aria-busy="true"
        aria-label={`Loading origin tree for ${word}`}
        className="mb-4 mt-1 max-w-full rounded-lg border border-neutral-200 bg-neutral-50/70 p-3 sm:p-4"
      >
        <h4 className="text-lg font-semibold">Origin</h4>
        <div className="mt-3 flex items-center gap-3 text-sm text-neutral-400">
          <span aria-hidden="true" className="h-8 w-24 animate-pulse rounded-md bg-neutral-200" />
          Tracing word history…
        </div>
      </section>
    )
  }

  if (resolvedTrees.length === 0) return null

  const collapsedPathsByTree = resolvedTrees.map((tree) => findCollapsedSharedAncestryPaths(tree.root))

  return (
    <section className="mb-4 mt-1 max-w-full rounded-lg border border-neutral-200 bg-neutral-50/70 p-3 sm:p-4">
      <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h4 className="text-lg font-semibold">Origin</h4>
        {resolvedSource && (
          <Link
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-neutral-500 underline transition hover:text-primary"
            href={resolvedSource.href}
          >
            {resolvedSource.title}
          </Link>
        )}
      </div>

      {resolvedTrees.map((tree, index) => (
        <figure
          aria-label={`Origin tree for ${tree.root.word}`}
          className={cn(index > 0 && "mt-5 border-t border-neutral-200 pt-4")}
          key={`${tree.partOfSpeech ?? "entry"}:${index}`}
        >
          {resolvedTrees.length > 1 && tree.partOfSpeech && (
            <div className="mb-2 text-center text-xs font-medium uppercase tracking-wide text-neutral-500">
              {PART_OF_SPEECH_LABELS[tree.partOfSpeech] ?? tree.partOfSpeech}
            </div>
          )}
          <div className="overflow-x-auto pb-2 pt-1">
            <div className="flex min-w-max justify-center px-2">
              <OriginNode
                node={tree.root}
                collapsedPaths={collapsedPathsByTree[index]}
                isRoot
              />
            </div>
          </div>
        </figure>
      ))}

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.7rem] text-neutral-500">
        <LegendLine relation="derived" label="derived/inherited" />
        <LegendLine relation="borrowed" label="borrowed" />
        <LegendLine relation="formed" label="word formation" />
      </div>
      <p className="mt-2 text-[0.7rem] leading-snug text-neutral-400">
        Wiktionary data, processed by Kaikki.org. Adapted under{" "}
        <Link
          target="_blank"
          rel="noopener noreferrer"
          className="underline transition hover:text-primary"
          href="https://creativecommons.org/licenses/by-sa/4.0/"
        >
          CC BY-SA 4.0
        </Link>
        .
      </p>
    </section>
  )
}
