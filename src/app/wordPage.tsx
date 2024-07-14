import { UseSuspenseQueryResult } from "@tanstack/react-query"
import { WordInfo, NotFound } from "./lib/scraping"
import { fetchWordInfoFromWeb } from "./lib/scraping"
import { Button } from "./Button"
import Link from "next/link"
import { cn } from "./lib/utils"

export default function WordPage({
  data,
  wordSet,
  setCurrentWord,
}: {
  data: WordInfo | NotFound | null
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
    <div className="p-2">
      <h1 className="text-5xl font-bold mb-2">{data.word}</h1>

      <div className="text-sm text-neutral-400 flex gap-4">{wordSet.has(data.word) && <p>(In wordlist)</p>}</div>

      <h3 className="text-xl my-2">Translations:</h3>
      <ul className="flex flex-wrap gap-1 pb-2">
        {data.translations.map((t, i) => (
          <li className="bg-neutral-200 whitespace-nowrap px-1 py-0.5 rounded-md text-sm" key={i}>
            {t}
          </li>
        ))}
      </ul>

      <h3 className="text-xl my-2">
        Definitions:
        <span className="text-sm text-neutral-400">
          {" "}
          <Link
            target="_blank"
            rel="noopener noreferrer"
            className="hover:brightness-50 transition"
            href={`https://www.merriam-webster.com/${data.source}/${encodeURIComponent(data.word)}`}
          >
            ({data.source})
          </Link>
        </span>
      </h3>
      <ul className="space-y-3">
        {data.definitions.map((d, i) => (
          <li key={i}>
            <span className="font-bold">({d.wordType})</span>
            <span className="ml-2 text-base">{d.definition}</span>
            {d.example && <p className="italic text-gray">{d.example}</p>}
            <ul className="flex gap-1 mt-0.5 flex-wrap">
              {d.synonyms.map((s, i) => (
                <button
                  key={i}
                  className={cn(
                    "bg-neutral-200 whitespace-nowrap px-1 py-0.5 rounded-md text-sm sm:hover:brightness-90",
                    wordSet.has(s) && "bg-primary",
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
    </div>
  )
}
