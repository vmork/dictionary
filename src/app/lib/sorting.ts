import { DictEntryFromDB } from "./types";

export type SortKeyName = "Alphabetical" | "Recently added";

export type SortKey = {
  name: SortKeyName;
  ascending: boolean;
  comparator: (a: DictEntryFromDB, b: DictEntryFromDB) => number;
};

export const defaultSortKeyName: SortKeyName = "Alphabetical";

export const defaultSortKeys: SortKey[] = [
  {
    name: "Alphabetical",
    ascending: true,
    comparator: (a, b) => a.word.localeCompare(b.word),
  },
  {
    name: "Recently added",
    ascending: false,
    comparator: (a, b) => new Date(a.timeAdded).getTime() - new Date(b.timeAdded).getTime(),
  },
];

export function sortEntries(entries: DictEntryFromDB[], sortKey: SortKey): DictEntryFromDB[] {
  return [...entries].sort((a, b) => {
    const comparison = (sortKey.ascending ? 1 : -1) * sortKey.comparator(a, b);
    return comparison || a.word.localeCompare(b.word);
  });
}
