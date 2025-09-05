export type PracticeData = {
  numSeen: number
  lastFive: boolean[]
  numCorrect: number
}

export type DefinitionSource = "thesaurus" | "dictionary"

export type LinkWithTitle = {
  title: string
  href: string
}

export type Definition = {
  wordType: string    // noun, verb, etc
  definition: string
  synonyms: string[]
  example: string
}

export type Translation = {
  language: string
  word: string
}

export type Etymology = {
  word: string
  wordType: string     // noun, verb, etc
  descriptionHTML: string
}

type _DictEntry = {
  word: string
  definitions: Definition[]
  translations: Translation[]
  etymologies: Etymology[]
  definitionsSource: LinkWithTitle
  translationsSource: LinkWithTitle
  etymologySource: LinkWithTitle
  type: "net" | "db"
}

export type DictDBRow = {
  word: string
  dict_entry: DictEntry
  time_added: string
  practice_data: PracticeData
}

export type WordsDataMap = Map<string, DictDBRow>

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
