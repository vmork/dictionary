"use client"

import { useWordsDB, useResetAllPracticeData } from "@/app/api/queries"
import { Button } from "@/app/components/Button"
import Link from "next/link"
import { useMemo, Suspense } from "react"
import { DictEntryFromDB, WordsDataMap, PracticeData } from "../../lib/types"
import { ProbabilityScheduler, DEFAULT_SCHEDULER_CONFIG } from "../scheduler"
import { useSearchParams } from "next/navigation"
import { ArrowLeft, Target, TrendingUp, Clock, Award, RotateCcw } from "lucide-react"
import { cn } from "@/app/lib/utils"
import { TopMenu } from "@/app/components/TopMenu"
import { useQueryClient } from "@tanstack/react-query"

function PracticeOverviewInner({ wordsData, cid }: { wordsData: WordsDataMap; cid: number }) {
  const queryClient = useQueryClient()
  const resetAllPracticeDataMutation = useResetAllPracticeData(cid)

  const practiceDataMap = useMemo(() => {
    const map = new Map<string, PracticeData>()
    wordsData.forEach((data, word) => {
      map.set(word, data.practice_data)
    })
    return map
  }, [wordsData])

  const scheduler = useMemo(
    () => new ProbabilityScheduler(Array.from(wordsData.keys()), practiceDataMap, DEFAULT_SCHEDULER_CONFIG),
    [wordsData, practiceDataMap]
  )

  const wordAnalysis = useMemo(() => scheduler.getWordAnalysis(), [scheduler])

  const stats = useMemo(() => {
    const total = wordAnalysis.length
    const practiced = wordAnalysis.filter((w) => w.attempts > 0).length
    const struggling = wordAnalysis.filter((w) => w.category === "struggling").length
    const mastered = wordAnalysis.filter((w) => w.category === "mastered").length
    const averageAccuracy =
      practiced > 0
        ? Math.round(wordAnalysis.filter((w) => w.attempts > 0).reduce((sum, w) => sum + w.accuracy, 0) / practiced)
        : 0

    return { total, practiced, struggling, mastered, averageAccuracy }
  }, [wordAnalysis])

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "struggling":
        return "text-red-700 bg-red-50 border-red-200"
      case "recent_mistake":
        return "text-orange-700 bg-orange-50 border-orange-200"
      case "mastered":
        return "text-green-700 bg-green-50 border-green-200"
      case "new":
        return "text-blue-700 bg-blue-50 border-blue-200"
      default:
        return "text-gray-700 bg-gray-50 border-gray-200"
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "struggling":
        return <Target className="w-4 h-4" />
      case "recent_mistake":
        return <TrendingUp className="w-4 h-4" />
      case "mastered":
        return <Award className="w-4 h-4" />
      case "new":
        return <Clock className="w-4 h-4" />
      default:
        return null
    }
  }

  const handleResetPracticeData = () => {
    if (confirm("Are you sure you want to reset all practice data? This cannot be undone.")) {
      resetAllPracticeDataMutation.mutate(undefined, {
        onSuccess: () => {
          // Invalidate and refetch the words data to refresh the UI
          queryClient.invalidateQueries({ queryKey: ["wordsDB", cid] })
        },
        onError: (error) => {
          console.error("Failed to reset practice data:", error)
          alert("Failed to reset practice data. Please try again.")
        },
      })
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-4">
      {/* Header */}
      <div className="flex items-center mb-4">
        <div className="ml-2">
          <Button
            onClick={handleResetPracticeData}
            disabled={resetAllPracticeDataMutation.isPending}
            className="flex p-1.5 items-center gap-2 bg-red-100 hover:bg-red-200 text-red-700 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            {resetAllPracticeDataMutation.isPending ? "Resetting..." : "Reset Practice Data"}
          </Button>
        </div>
        <div className="ml-auto">
          {/* Reuse the same menu in the overview page */}
          <TopMenu cid={cid} />
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <div className="bg-white p-3 rounded-lg border border-border shadow-sm">
          <div className="text-2xl">{stats.total}</div>
          <div className="text-sm text-gray-600">Total Words</div>
        </div>
        <div className="bg-white p-3 rounded-lg border border-border shadow-sm">
          <div className="text-2xl text-gray-800">{stats.practiced}</div>
          <div className="text-sm text-gray-600">Practiced</div>
        </div>
        <div className="bg-white p-3 rounded-lg border border-border shadow-sm">
          <div className="text-2xl">{stats.struggling}</div>
          <div className="text-sm text-gray-600">Struggling</div>
        </div>
        <div className="bg-white p-3 rounded-lg border border-border shadow-sm">
          <div className="text-2xl">{stats.mastered}</div>
          <div className="text-sm text-gray-600">Mastered</div>
        </div>
        <div className="bg-white p-3 rounded-lg border border-border shadow-sm">
          <div className="text-2xl">{stats.averageAccuracy}%</div>
          <div className="text-sm text-gray-600">Avg Accuracy</div>
        </div>
      </div>

      {/* Words Table */}
      <div className="bg-white rounded-lg border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-3 font-semibold text-sm">Word</th>
                <th className="text-left p-3 font-semibold text-sm">Category</th>
                <th className="text-left p-3 font-semibold text-sm">Selection %</th>
                <th className="text-left p-3 font-semibold text-sm">Accuracy</th>
                <th className="text-left p-3 font-semibold text-sm">Attempts</th>
                <th className="text-left p-3 font-semibold text-sm">Recent</th>
              </tr>
            </thead>
            <tbody>
              {wordAnalysis.map((word, index) => {
                const practiceData = practiceDataMap.get(word.word)
                return (
                  <tr
                    key={word.word}
                    className={cn(
                      "border-b border-border hover:bg-muted/30",
                      index % 2 === 0 ? "bg-white" : "bg-gray-25"
                    )}
                  >
                    <td className="p-3">{word.word}</td>
                    <td className="p-3">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border",
                          getCategoryColor(word.category)
                        )}
                      >
                        {getCategoryIcon(word.category)}
                        {word.category.replace("_", " ")}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="text-sm">{word.selectionProbability.toFixed(2)}%</span>
                    </td>
                    <td className="p-3">
                      {word.attempts > 0 ? (
                        <span
                          className={cn(
                            "",
                            word.accuracy >= 80
                              ? "text-green-600"
                              : word.accuracy >= 60
                              ? "text-yellow-600"
                              : "text-red-600"
                          )}
                        >
                          {word.accuracy}%
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="p-3">{word.attempts}</td>
                    <td className="p-3">
                      {practiceData && practiceData.lastFive.length > 0 ? (
                        <div className="flex gap-1">
                          {practiceData.lastFive.map((correct, i) => (
                            <div
                              key={i}
                              className={cn("w-3 h-3 rounded-full", correct ? "bg-green-400" : "bg-red-400")}
                            />
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function PracticeOverviewContent() {
  const searchParams = useSearchParams()
  const cid = Number(searchParams.get("cid"))

  const wordsDataQuery = useWordsDB(cid)

  if (wordsDataQuery.isPending) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }
  if (wordsDataQuery.isError) {
    return (
      <div className="flex items-center justify-center h-screen text-red-600">
        Error loading data: {wordsDataQuery.error.message}
      </div>
    )
  }

  return <PracticeOverviewInner wordsData={wordsDataQuery.data} cid={cid} />
}

export default function PracticeOverview() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
      <PracticeOverviewContent />
    </Suspense>
  )
}
