import { DictEntryFromDB } from "./types";

export type SortKey = {
  name: string;
  ascending: boolean;
  comparator: (a: DictEntryFromDB, b: DictEntryFromDB) => number;
};

export const defaultSortKeys: SortKey[] = [
  {
    name: "Word",
    ascending: true,
    comparator: (a, b) => a.word.localeCompare(b.word),
  },
  {
    name: "Time added",
    ascending: true,
    comparator: (a, b) => new Date(a.timeAdded).getTime() - new Date(b.timeAdded).getTime(),
  },
];

export function sortEntries(entries: DictEntryFromDB[], sortKeys: SortKey[]): DictEntryFromDB[] {
  return [...entries].sort((a, b) => {
    for (let key of sortKeys) {
      const c = (key.ascending ? 1 : -1) * key.comparator(a, b);
      if (c != 0) return c;
    }
    return 0;
  });
}