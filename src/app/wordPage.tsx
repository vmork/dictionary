import { UseQueryResult } from "@tanstack/react-query"
import { WordInfo, NotFound } from "./api/api"
import { fetchWordInfo } from "./api/api"
import { Button } from "./Button"

export default function WordPage({
  queryInfo,
  setCurrentWord,
}: {
  queryInfo: UseQueryResult<NotFound | WordInfo, Error>
  setCurrentWord: (word: string) => void
}) {
  const { data, status, error } = queryInfo

  if (status === "pending") {
    return <div>Loading...</div>
  }

  if (status === "error") {
    console.error(error)
    return (
      <div>
        <h1 className="text-red-500 text-3xl">Error fetching data: </h1> <p>{error.message}</p>{" "}
      </div>
    )
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
            <Button className="cursor-pointer flex-none w-fit p-1 bg-neutral-200 hover:brightness-90" onClick={() => setCurrentWord(word)} key={i}>
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
      <h3 className="text-xl my-2">Translations:</h3>
      <ul className="flex flex-wrap gap-1 pb-2">
        {data.translations.map((t, i) => (
          <li className="bg-neutral-200 whitespace-nowrap px-1 py-0.5 rounded-md text-sm" key={i}>
            {t}
          </li>
        ))}
      </ul>

      <h3 className="text-xl my-2">Definitions:</h3>
      <ul className="space-y-3">
        {data.definitions.map((d, i) => (
          <li key={i}>
            <span className="font-bold">({d.wordType})</span>
            <span className="ml-2 text-base">{d.definition.replace(/\{([^}]+)\}/g, "")}</span>
            {d.example && (
              <p className="italic text-gray">{d.example.replace(/\{([^}]+)\}/g, "")}</p>
            )}
            <ul className="flex gap-1 mt-0.5 flex-wrap">
              {d.synonyms.map((s, i) => (
                <button
                  key={i}
                  className="bg-neutral-200 whitespace-nowrap px-1 py-0.5 rounded-md text-sm hover:brightness-90"
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
