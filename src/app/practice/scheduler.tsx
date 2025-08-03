import { PracticeData } from "../lib/dictionary/types"

export type AnswerData = "correct" | "wrong"

export interface WordStats {
  correctGuesses: number
  totalGuesses: number
  recentGuesses: boolean[] // last 5 guesses, true = correct
}

export interface Scheduler<ItemType> {
  itemList: ItemType[]
  getNext: () => ItemType
  onAnswer: (item: ItemType, answerData: AnswerData) => void
}

export interface SchedulerConfig {
  // Control how often new words appear vs reviewed words
  newWordProbability: number  // 0.1 = 10% chance for new words when many unpracticed exist
  
  // Weight factors for difficulty calculation
  recentPerformanceWeight: number  // 0.8 = 80% weight on recent performance
  overallPerformanceWeight: number // 0.2 = 20% weight on overall performance
  
  // How many attempts before we trust the accuracy measurement
  confidenceThreshold: number  // 10 attempts = full confidence
  
  // Boost multipliers for different word categories
  strugglingWordBoost: number   // 3.0 = 3x more likely to see struggling words
  recentMistakeBoost: number   // 2.5 = 2.5x more likely after recent mistake
  newWordBoost: number         // 1.2 = slight boost for completely new words
  
  // Accuracy thresholds
  strugglingThreshold: number  // 0.4 = words with <40% accuracy are "struggling"
  masteredThreshold: number    // 0.9 = words with >90% accuracy are "mastered"
  
  // Recent mistake detection
  recentMistakeWindow: number  // 2 = last 2 attempts matter for "recent mistake"
}

export const DEFAULT_SCHEDULER_CONFIG: SchedulerConfig = {
  newWordProbability: 0.5,
  recentPerformanceWeight: 0.75,
  overallPerformanceWeight: 0.25,
  confidenceThreshold: 5,
  strugglingWordBoost: 4.0,
  recentMistakeBoost: 2.8,
  newWordBoost: 1.3,
  strugglingThreshold: 0.4,
  masteredThreshold: 0.85,
  recentMistakeWindow: 2
}

export class RandomScheduler<T> implements Scheduler<T> {
  itemList: T[]

  constructor(items: T[]) {
    this.itemList = items
  }

  getNext() {
    const idx = Math.floor(Math.random() * this.itemList.length)
    return this.itemList[idx]
  }

  onAnswer(item: T, answerData: AnswerData) {
    console.log("scheduler received: ", item, answerData) 
  }
}

export class ProbabilityScheduler {
  private words: string[]
  private practiceDataMap: Map<string, PracticeData>
  private config: SchedulerConfig
  private lastSelectedWord?: string
  
  constructor(words: string[], practiceDataMap: Map<string, PracticeData>, config: SchedulerConfig = DEFAULT_SCHEDULER_CONFIG) {
    this.words = words
    this.practiceDataMap = practiceDataMap
    this.config = config
  }

  private calculateWordDifficulty(word: string): number {
    const practiceData = this.practiceDataMap.get(word)
    
    // New word (never practiced)
    if (!practiceData || practiceData.numSeen === 0) {
      return this.config.newWordBoost
    }

    // Calculate accuracies
    const overallAccuracy = practiceData.numCorrect / practiceData.numSeen
    const recentAttempts = practiceData.lastFive.slice(-this.config.recentMistakeWindow)
    const recentCorrect = recentAttempts.filter(Boolean).length
    const recentAccuracy = recentAttempts.length > 0 ? recentCorrect / recentAttempts.length : overallAccuracy
    
    // Weighted accuracy (recent performance matters more)
    const weightedAccuracy = 
      this.config.recentPerformanceWeight * recentAccuracy + 
      this.config.overallPerformanceWeight * overallAccuracy
    
    // Confidence factor: how much we trust this accuracy
    const confidenceFactor = Math.min(practiceData.numSeen / this.config.confidenceThreshold, 1.0)
    
    // Base difficulty (inverse of accuracy)
    let difficulty = 1 - (weightedAccuracy * confidenceFactor)
    
    // Apply category-specific boosts
    if (weightedAccuracy < this.config.strugglingThreshold) {
      // Struggling words get major boost
      difficulty *= this.config.strugglingWordBoost
    } else if (recentAttempts.length > 0 && recentCorrect === 0) {
      // Recent mistake boost (even if overall accuracy is good)
      difficulty *= this.config.recentMistakeBoost
    } else if (weightedAccuracy > this.config.masteredThreshold && practiceData.numSeen >= this.config.confidenceThreshold) {
      // Mastered words get reduced probability
      difficulty *= 0.3
    }
    
    // Ensure reasonable bounds
    return Math.max(0.05, Math.min(10.0, difficulty))
  }

  getNext(): string {
    if (this.words.length === 0) {
      throw new Error("No words available for practice")
    }
    
    if (this.words.length === 1) {
      return this.words[0]
    }

    // Separate new words from practiced words
    const newWords = this.words.filter(word => {
      const practiceData = this.practiceDataMap.get(word)
      return !practiceData || practiceData.numSeen === 0
    })
    
    const practicedWords = this.words.filter(word => {
      const practiceData = this.practiceDataMap.get(word)
      return practiceData && practiceData.numSeen > 0
    })

    // If we have many new words, limit how often they appear
    const shouldSelectNewWord = newWords.length > 0 && (
      practicedWords.length === 0 || // No choice but new words
      (newWords.length >= 20 && Math.random() < this.config.newWordProbability) || // Controlled introduction
      (newWords.length < 20 && Math.random() < this.config.newWordProbability * 2) // More liberal when few new words
    )

    let candidateWords: string[]
    if (shouldSelectNewWord) {
      candidateWords = newWords
    } else if (practicedWords.length > 0) {
      candidateWords = practicedWords
    } else {
      candidateWords = newWords // Fallback to new words
    }

    // Calculate difficulties for candidate words
    const difficulties = candidateWords.map(word => ({
      word,
      difficulty: this.calculateWordDifficulty(word)
    }))
    
    // Avoid repeating the same word immediately
    if (this.lastSelectedWord && difficulties.length > 1) {
      const lastWordIndex = difficulties.findIndex(d => d.word === this.lastSelectedWord)
      if (lastWordIndex !== -1) {
        difficulties[lastWordIndex].difficulty *= 0.1 // Heavy penalty for immediate repetition
      }
    }
    
    // Create weighted probability distribution
    const totalDifficulty = difficulties.reduce((sum, item) => sum + item.difficulty, 0)
    
    if (totalDifficulty === 0) {
      // All difficulties are 0, fallback to random
      const selected = candidateWords[Math.floor(Math.random() * candidateWords.length)]
      this.lastSelectedWord = selected
      return selected
    }
    
    // Weighted random selection
    const random = Math.random() * totalDifficulty
    let cumulativeDifficulty = 0
    
    for (const item of difficulties) {
      cumulativeDifficulty += item.difficulty
      if (random <= cumulativeDifficulty) {
        this.lastSelectedWord = item.word
        return item.word
      }
    }
    
    // Fallback (shouldn't happen)
    const selected = difficulties[difficulties.length - 1].word
    this.lastSelectedWord = selected
    return selected
  }

  onAnswer(word: string, answer: AnswerData): PracticeData | null {
    const practiceData = this.practiceDataMap.get(word)
    if (!practiceData) return null
    
    const isCorrect = answer === "correct"
    
    // Update totals
    practiceData.numSeen++
    if (isCorrect) {
      practiceData.numCorrect++
    }
    
    // Update recent guesses (keep only last 5)
    practiceData.lastFive.push(isCorrect)
    if (practiceData.lastFive.length > 5) {
      practiceData.lastFive.shift()
    }

    console.log("Scheduler: %s: %s", word, answer)
    console.log("Updated practice data:", word, practiceData)
    
    return practiceData
  }

  // Debug methods for tuning
  getWordAnalysis(): Array<{
    word: string
    category: 'new' | 'struggling' | 'recent_mistake' | 'mastered' | 'normal'
    difficulty: number
    accuracy: number
    attempts: number
    selectionProbability: number
  }> {
    // Calculate difficulties for all words (similar to getNext logic)
    const allDifficulties = this.words.map(word => ({
      word,
      difficulty: this.calculateWordDifficulty(word)
    }))
    
    const totalDifficulty = allDifficulties.reduce((sum, item) => sum + item.difficulty, 0)
    
    return this.words.map(word => {
      const practiceData = this.practiceDataMap.get(word)
      const difficulty = this.calculateWordDifficulty(word)
      const selectionProbability = totalDifficulty > 0 ? (difficulty / totalDifficulty) * 100 : 0
      
      if (!practiceData || practiceData.numSeen === 0) {
        return { 
          word, 
          category: 'new' as const, 
          difficulty, 
          accuracy: 0, 
          attempts: 0,
          selectionProbability
        }
      }
      
      const accuracy = practiceData.numCorrect / practiceData.numSeen
      const recentAttempts = practiceData.lastFive.slice(-this.config.recentMistakeWindow)
      const recentCorrect = recentAttempts.filter(Boolean).length
      
      let category: 'struggling' | 'recent_mistake' | 'mastered' | 'normal' = 'normal'
      
      if (accuracy < this.config.strugglingThreshold) {
        category = 'struggling'
      } else if (recentAttempts.length > 0 && recentCorrect === 0) {
        category = 'recent_mistake'
      } else if (accuracy > this.config.masteredThreshold && practiceData.numSeen >= this.config.confidenceThreshold) {
        category = 'mastered'
      }
      
      return { 
        word, 
        category, 
        difficulty, 
        accuracy: Math.round(accuracy * 100), 
        attempts: practiceData.numSeen,
        selectionProbability: Math.round(selectionProbability * 100) / 100
      }
    }).sort((a, b) => b.selectionProbability - a.selectionProbability)
  }

  getConfig(): SchedulerConfig {
    return this.config
  }

  updateConfig(newConfig: Partial<SchedulerConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }

  // Optional: method to get practice data for debugging
  getPracticeData(word: string): PracticeData | undefined {
    return this.practiceDataMap.get(word)
  }
}