export type AnswerData = "correct" | "wrong"

export type SchedulerDataDefault = {
  numSeen: number
  numCorrect: number
}

export interface Scheduler<ItemType, SchedulerData = SchedulerDataDefault> {
  itemList: ItemType[]
  getNext: () => ItemType
  onAnswer: (item: ItemType, answerData: AnswerData) => void
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