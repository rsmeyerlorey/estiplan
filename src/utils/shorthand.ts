/**
 * Generate a shorthand letter for a variable name.
 * Rules:
 *  1. First letter of the name, uppercased
 *  2. If taken, try first letter of each word (for multi-word names)
 *  3. If taken, try first + second letter uppercased (e.g., "He")
 *  4. If still taken, append a number: "H2"
 */
export function generateShorthand(
  name: string,
  existingShorthands: Set<string>,
): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';

  // 1. First letter uppercased
  const firstLetter = trimmed[0].toUpperCase();
  if (!existingShorthands.has(firstLetter)) {
    return firstLetter;
  }

  // 2. First letter of each word (for multi-word names like "Body Mass" → "BM")
  const words = trimmed.split(/\s+/);
  if (words.length > 1) {
    const initials = words.map((w) => w[0].toUpperCase()).join('');
    if (!existingShorthands.has(initials)) {
      return initials;
    }
  }

  // 3. First two letters (e.g., "He" for Height when "H" is taken)
  if (trimmed.length >= 2) {
    const twoLetter = trimmed[0].toUpperCase() + trimmed[1].toLowerCase();
    if (!existingShorthands.has(twoLetter)) {
      return twoLetter;
    }
  }

  // 4. Append numbers
  let n = 2;
  while (existingShorthands.has(`${firstLetter}${n}`)) {
    n++;
  }
  return `${firstLetter}${n}`;
}
