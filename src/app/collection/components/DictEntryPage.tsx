import { DictEntry, NotFound, PracticeData } from "../../lib/types"
import { Button } from "../../components/Button"
import Link from "next/link"
import { cn, formatDateString } from "../../lib/utils"
import { Check, X } from "lucide-react"
import EtymologyTree from "./EtymologyTree"

function PracticeStatsDisplay({ practiceData, timeAdded }: { practiceData: PracticeData; timeAdded: string }) {
  const recallPercentage =
    practiceData.numSeen > 0 ? Math.round((practiceData.numCorrect / practiceData.numSeen) * 100) : 0

  return (
    <div className="text-sm text-neutral-400 flex items-center gap-2 flex-wrap mb-2">
      {/* Recall percentage */}
      <span>
        Recall: {practiceData.numCorrect}/{practiceData.numSeen} ({recallPercentage}%)
      </span>

      {/* Recent attempts - only show if there are attempts */}
      {practiceData.lastFive.length > 0 && (
        <>
          <span className="hidden sm:inline">•</span>
          <div className="flex items-center gap-1">
            <span>Recent:</span>
            <div className="flex gap-1">
              {practiceData.lastFive.map((isCorrect, index) => (
                <div
                  key={index}
                  className={cn(
                    "w-4 h-4 rounded-full flex items-center justify-center text-white",
                    isCorrect ? "bg-greenish" : "bg-reddish"
                  )}
                >
                  {isCorrect ? <Check className="w-2.5 h-2.5" /> : <X className="w-2.5 h-2.5" />}
                </div>
              ))}
              {/* Fill remaining slots with empty circles if less than 5 */}
              {Array.from({ length: 5 - practiceData.lastFive.length }).map((_, index) => (
                <div key={`empty-${index}`} className="w-4 h-4 rounded-full border border-neutral-300" />
              ))}
            </div>
          </div>
        </>
      )}

      <span className="hidden sm:inline">•</span>

      {/* Added date (without time) */}
      <span>Added {formatDateString(timeAdded)}</span>
    </div>
  )
}

export default function WordDataPage({
  data,
  wordSet,
  setCurrentWord,
}: {
  data: DictEntry | NotFound | null
  wordSet: Set<string>
  setCurrentWord: (word: string) => void
}) {
  if (data == null) {
    return <span>Select a word</span>
  }

  if (data instanceof NotFound) {
    return (
      <div>
        <h2 className="text-2xl mb-2">
          <b>{data.word}</b> not found
        </h2>
        <p>Did you mean:</p>
        <ul className="flex gap-1 flex-wrap mt-2">
          {data.didYouMean.map((word, i) => (
            <Button
              className="cursor-pointer flex-none w-fit p-1 bg-neutral-200 hover:brightness-90"
              onClick={() => setCurrentWord(word)}
              key={i}
            >
              {word}
            </Button>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <div className="">
      <h1 className="text-5xl font-bold mb-2">{data.word}</h1>

      {data.type === "db" && <PracticeStatsDisplay practiceData={data.practiceData} timeAdded={data.timeAdded} />}

      {/* Translations */}
      {data.translations.length > 0 && (
        <>
          <div className="flex items-center gap-2">
            <h3 className="text-xl my-2 underline">Translations</h3>
            <span className="text-sm text-neutral-400">
              {data.translationsSource && (
                <Link
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary underline transition"
                  href={data.translationsSource?.href ?? "about:blank"}
                >
                  ({data.translationsSource?.title})
                </Link>
              )}
            </span>
          </div>
          <ul className="flex flex-wrap gap-1 pb-2">
            {data.translations.map((t, i) => (
              <li className="bg-neutral-200 whitespace-nowrap px-1 py-0.5 rounded-md text-sm" key={i}>
                {t.word}
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Definitions */}
      <div className="flex items-center gap-2">
        <h3 className="text-xl my-2 underline">Definitions</h3>
        <span className="text-sm text-neutral-400">
          {" "}
          {data.definitionsSource && (
            <Link
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary underline transition"
              href={data.definitionsSource?.href ?? "about:blank"}
            >
              ({data.definitionsSource?.title})
            </Link>
          )}
        </span>
      </div>
      <ul className="space-y-3">
        {data.definitions.map((d, i) => (
          <li key={i}>
            <span className="font-bold">({d.wordType})</span>
            <span className="ml-2 text-base">{d.definition}</span>
            {d.example && <p className="italic text-gray">{d.example}</p>}
            <ul className="flex gap-1 mt-0.5 flex-wrap">
              {d.synonyms.map((s, i) => (
                <button
                  key={s}
                  className={cn(
                    "bg-neutral-200 whitespace-nowrap px-1 py-0.5 rounded-md text-sm sm:hover:brightness-90",
                    wordSet.has(s) && "bg-greenish"
                  )}
                  onClick={() => setCurrentWord(s)}
                >
                  {s}
                </button>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      {/* Etymology */}
      {(data.etymologies?.length > 0 || (data.etymologyTrees?.length ?? 0) > 0) && (
        <>
          <div className="flex items-center gap-2">
            <h3 className="text-xl my-2 underline">Etymology</h3>
            <span className="text-sm text-neutral-400">
              {data.etymologySource && (
                <Link
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary underline transition"
                  href={data.etymologySource?.href ?? "about:blank"}
                >
                  ({data.etymologySource?.title})
                </Link>
              )}
            </span>
          </div>
          {data.etymologies?.length > 0 && (
            <ul className="space-y-3 max-w-[800px]">
              {data.etymologies.map((e, i) => (
                <li key={i}>
                  {e.wordType && <span className="font-bold mr-2">({e.wordType})</span>}
                  <span
                    className="whitespace-pre-line text-base opacity-70"
                    dangerouslySetInnerHTML={{ __html: e.descriptionHTML }}
                  />
                </li>
              ))}
            </ul>
          )}
          <EtymologyTree
            key={data.word}
            word={data.word}
            trees={data.etymologyTrees}
            source={data.etymologyTreeSource}
          />
        </>
      )}
    </div>
  )
}
