import { WordInfoFromDB, WordsDataMap } from "../../lib/types"
import { useState, useEffect, useMemo } from "react"
import { Scheduler, RandomScheduler, AnswerData } from "../scheduler"
import { useWordsDB } from "@/app/db/queries"
import { Button } from "@/app/components/Button"
import WordPage from "@/app/components/WordPage"

type GameStatus = "question" | "answer"

export default function Practice() {
  const wordsDataQuery = useWordsDB()
  if (wordsDataQuery.isPending) {
    return <div>Loading...</div>
  }
  if (wordsDataQuery.isError) {
    return <div>Error loading data somehow: {wordsDataQuery.error.message}</div>
  }
  return <PracticeInner wordsData={wordsDataQuery.data} />
}

function PracticeInner({ wordsData }: { wordsData: WordsDataMap }) {
  const [gameStatus, setGameStatus] = useState<GameStatus>("question")
  const [currentWord, setCurrentWord] = useState<string>("")

  const currentWordData: WordInfoFromDB | null = useMemo(() => {
    if (currentWord === "" || !wordsData) return null
    const data = wordsData.get(currentWord)
    if (!data) throw new Error(`${currentWord} not found in map`)
    return { ...data.dict_entry, type: "db", timeAdded: data.time_added }
  }, [currentWord, wordsData])

  const wordSet = useMemo(() => new Set(wordsData.keys()), [wordsData])

  const scheduler = useMemo(() => new RandomScheduler(Array.from(wordsData.keys())), [wordsData])
  useEffect(() => setCurrentWord(scheduler.getNext()), [scheduler])

  function onAnswer(answer: AnswerData) {
    scheduler.onAnswer(currentWord, answer)
    setCurrentWord(scheduler.getNext())
    setGameStatus("question")
  }

  if (gameStatus === "question") {
    return (
      <div className="flex items-center h-full flex-col pt-32">
        <div className="flex-grow">
          <h1 className="text-5xl">{currentWord}</h1>
        </div>
        <div className="pt-4 mb-10 flex gap-2 h-[50px] flex-none">
          <Button className="flex-none h-max" onClick={() => setGameStatus("answer")}>
            Show answer
          </Button>
        </div>
      </div>
    )
  }
  if (gameStatus === "answer") {
    return (
      <div className="flex items-center flex-col h-full pt-2 ">
        <div className="overflow-y-auto flex-grow" >
          <WordPage data={currentWordData} wordSet={wordSet} setCurrentWord={() => null}></WordPage>
        </div>
        <div className="pt-4 mb-10 flex gap-2 h-[50px] flex-none">
          <Button className="bg-rose-300 flex-none h-max" onClick={() => onAnswer("wrong")}>
            Wrong
          </Button>
          <Button className="bg-primary flex-none h-max" onClick={() => onAnswer("correct")}>
            Correct
          </Button>
        </div>
      </div>
    )
  }
}
