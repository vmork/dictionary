import { useWordsDB, useUpdatePracticeData } from "@/app/api/queries"
import WordDataPage from "@/app/collection/components/DictEntryPage"
import { Button } from "@/app/components/Button"
import { useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { DictEntryFromDB, WordsDataMap, PracticeData } from "../../lib/types"
import { AnswerData, ProbabilityScheduler, RandomScheduler, DEFAULT_SCHEDULER_CONFIG } from "../scheduler"
import Link from "next/link"
import { X } from "lucide-react"
import { TopMenu } from "@/app/components/TopMenu"

// Reusable navigation component
function TopNavigation({ cid }: { cid: number }) {
  return (
    <div className="fixed top-4 left-4 right-4 flex gap-2 z-50 items-center">
      <Link href={`/collection?cid=${cid}`}>
        <Button className="flex items-center gap-1 bg-primary hover:bg-gray-300 text-gray-700 py-1 px-3 transition-colors">
          <X size={16} />
          Quit
        </Button>
      </Link>
      <div className="ml-auto">
        <TopMenu cid={cid} />
      </div>
    </div>
  )
}

type GameStatus = "question" | "answer"

export default function Practice({cid}: {cid: number}) {

  const wordsDataQuery = useWordsDB(cid)

  if (wordsDataQuery.isPending) {
    return <div>Loading...</div>
  }
  if (wordsDataQuery.isError) {
    return <div>Error loading data: {wordsDataQuery.error.message}</div>
  }
  return <PracticeInner wordsData={wordsDataQuery.data} cid={cid} />
}

function PracticeInner({ wordsData, cid }: { wordsData: WordsDataMap; cid: number }) {
  const [gameStatus, setGameStatus] = useState<GameStatus>("question")
  const [currentWord, setCurrentWord] = useState<string>("")

  const updatePracticeDataMutation = useUpdatePracticeData(cid)

  const currentWordData: DictEntryFromDB | null = useMemo(() => {
    if (currentWord === "" || !wordsData) return null
    const data = wordsData.get(currentWord)
    if (!data) throw new Error(`${currentWord} not found in map`)
    return { ...data.dict_entry, type: "db", timeAdded: data.time_added, practiceData: data.practice_data }
  }, [currentWord, wordsData])

  const wordSet = useMemo(() => new Set(wordsData.keys()), [wordsData])

  const practiceDataMap = useMemo(() => {
    const map = new Map<string, PracticeData>()
    wordsData.forEach((data, word) => {
      map.set(word, data.practice_data)
    })
    return map
  }, [wordsData])

  const scheduler = useMemo(() => new ProbabilityScheduler(Array.from(wordsData.keys()), practiceDataMap, DEFAULT_SCHEDULER_CONFIG), [wordsData, practiceDataMap])
  useEffect(() => setCurrentWord(scheduler.getNext()), [scheduler])

  function onAnswer(answer: AnswerData) {
    const updatedPracticeData = scheduler.onAnswer(currentWord, answer)
    if (updatedPracticeData) {
      updatePracticeDataMutation.mutate(
        { word: currentWord, practiceData: updatedPracticeData },
        {
          onError: (error) => {
            console.error("Failed to update practice data:", error)
          }
        }
      )
    }
    setCurrentWord(scheduler.getNext())
    setGameStatus("question")
  }

  if (gameStatus === "question") {
    return (
      <div className="flex items-center h-full flex-col relative">
        <TopNavigation cid={cid} />
        
        <div className="flex-grow flex items-center">
          <h1 className="text-5xl">{currentWord}</h1>
        </div>
        <div className="pb-10 flex gap-2 h-[50px] flex-none">
          <Button className="flex-none h-max bg-secondary hover:bg-primary text-gray-700 transition-colors" onClick={() => setGameStatus("answer")}>
            Show answer
          </Button>
        </div>
      </div>
    )
  }
  if (gameStatus === "answer") {
    return (
      <div className="flex items-center flex-col h-full pt-2 mx-4 relative">
        <TopNavigation cid={cid} />
        
        <div className="overflow-y-auto flex-grow mt-12" >
          <WordDataPage data={currentWordData} wordSet={wordSet} setCurrentWord={() => null}></WordDataPage>
        </div>
        <div className="pt-4 mb-10 flex gap-2 h-[50px] flex-none">
          <Button className="bg-reddish flex-none h-max" onClick={() => onAnswer("wrong")}>
            Wrong
          </Button>
          <Button className="bg-greenish flex-none h-max" onClick={() => onAnswer("correct")}>
            Correct
          </Button>
        </div>
      </div>
    )
  }
}
