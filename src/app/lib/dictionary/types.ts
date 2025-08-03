export type PracticeData = {
  numSeen: number
  lastFive: boolean[]
  numCorrect: number
}

export type DictDBRow = {
  word: string
  dict_entry: DictEntry
  time_added: string
  practice_data: PracticeData
}

export type WordsDataMap = Map<string, DictDBRow>

export type Definition = {
  wordType: string // e.g. noun, verb, etc.
  definition: string
  synonyms: string[]
  example: string
}

export type DefinitionSource = "thesaurus" | "dictionary"

type _DictEntry = {
  word: string
  definitions: Definition[]
  translations: string[]
  source: DefinitionSource
  type: "net" | "db"
}

export type DictEntryFromNet = _DictEntry & {
  type: "net"
}

export type DictEntryFromDB = _DictEntry & {
  type: "db"
  timeAdded: string
  practiceData: PracticeData
}

export type DictEntry = DictEntryFromNet | DictEntryFromDB

export class NotFound {
  constructor(public didYouMean: string[], public word: string) {}
}

export class APIError {
  constructor(public message: string) {}
}
