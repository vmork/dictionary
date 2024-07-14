import { WordInfo } from "../lib/scraping"

export type WordsDBRow = {
    word: string
    dict_entry: WordInfo
}

export type WordsDataMap = Map<string, WordsDBRow>