// Sort whole alternatives, preserving their letters, text and answer association.
// Copy the array so displaying a question never mutates stored or restored data.
export function orderedOptions<T extends { key: string }>(options: readonly T[]): T[] {
  return [...options].sort((a, b) => a.key.localeCompare(b.key));
}
