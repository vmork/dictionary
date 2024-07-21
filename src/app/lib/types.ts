export type WordsDBRow = {
  word: string
  dict_entry: WordInfo
  time_added: string
}

export type WordsDataMap = Map<string, WordsDBRow>

export type Definition = {
  wordType: string // e.g. noun, verb, etc.
  definition: string
  synonyms: string[]
  example: string
}

export type DefinitionSource = "thesaurus" | "dictionary"

type _WordInfo = {
  word: string
  definitions: Definition[]
  translations: string[]
  source: DefinitionSource
  type: "net" | "db"
}

export type WordInfoFromNet = _WordInfo & {
  type: "net"
}

export type WordInfoFromDB = _WordInfo & {
  type: "db"
  timeAdded: string
}

export type WordInfo = WordInfoFromNet | WordInfoFromDB

export class NotFound {
  constructor(public didYouMean: string[], public word: string) {}
}

export class APIError {
  constructor(public message: string) {}
}
