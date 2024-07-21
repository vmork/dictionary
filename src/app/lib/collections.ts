export type Collection = DictionaryCollection | TranslationsCollection 

export type Language = "english" | "french" | "spanish" | "german"

export type CollectionID = number

export type DictionaryCollection = {
  type: "dictionary"
  id: CollectionID
  name: string
  language: "english" // only english for now
}

export type TranslationsCollection = {
  type: "translations"
  id: CollectionID
  name: string
  language1: Language
  language2: Language
}