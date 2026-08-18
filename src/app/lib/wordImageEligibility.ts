export function hasNounDefinition(
  definitions: ReadonlyArray<{ wordType: string }>,
) {
  return definitions.some((definition) => /\bnoun\b/i.test(definition.wordType))
}
