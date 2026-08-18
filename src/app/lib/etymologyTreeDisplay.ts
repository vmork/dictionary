import type { EtymologyTreeNode } from "./types"

type NodeOccurrence = {
  depth: number
  order: number
  path: string
  signature: string
  size: number
}

function ancestrySignature(node: EtymologyTreeNode): string {
  const parentSignatures = node.parents
    .map((parent) => JSON.stringify([
      parent.relationToChild ?? null,
      parent.uncertain ?? false,
      ancestrySignature(parent),
    ]))
    .sort()

  return JSON.stringify([
    node.languageCode,
    node.word.normalize("NFC"),
    parentSignatures,
  ])
}

function subtreeSize(node: EtymologyTreeNode): number {
  return 1 + node.parents.reduce((total, parent) => total + subtreeSize(parent), 0)
}

function isWithinCollapsedPath(path: string, collapsedPaths: Set<string>): boolean {
  for (const collapsedPath of collapsedPaths) {
    if (path === collapsedPath || path.startsWith(`${collapsedPath}.`)) return true
  }
  return false
}

/**
 * Finds repeated ancestry that can be collapsed without hiding its only expanded
 * occurrence. A node's own gloss and relation to its child are deliberately not
 * part of its identity; internal ancestry relationships still are.
 */
export function findCollapsedSharedAncestryPaths(root: EtymologyTreeNode): Set<string> {
  const occurrencesBySignature = new Map<string, NodeOccurrence[]>()
  let order = 0

  function visit(node: EtymologyTreeNode, path: string, depth: number): void {
    if (node.parents.length > 0) {
      const occurrence: NodeOccurrence = {
        depth,
        order,
        path,
        signature: ancestrySignature(node),
        size: subtreeSize(node),
      }
      const occurrences = occurrencesBySignature.get(occurrence.signature) ?? []
      occurrences.push(occurrence)
      occurrencesBySignature.set(occurrence.signature, occurrences)
    }

    order += 1
    node.parents.forEach((parent, index) => visit(parent, `${path}.${index}`, depth + 1))
  }

  visit(root, "root", 0)

  const repeatedGroups = [...occurrencesBySignature.values()]
    .filter((occurrences) => occurrences.length > 1)
    .sort((left, right) => right[0].size - left[0].size)

  const collapsedPaths = new Set<string>()

  for (const group of repeatedGroups) {
    const visibleOccurrences = group.filter(({ path }) => !isWithinCollapsedPath(path, collapsedPaths))
    if (visibleOccurrences.length < 2) continue

    visibleOccurrences.sort((left, right) => left.depth - right.depth || left.order - right.order)
    for (const duplicate of visibleOccurrences.slice(1)) collapsedPaths.add(duplicate.path)
  }

  return collapsedPaths
}
