/**
 * Given all paths between source and target,
 * find the set of intermediate node IDs (mediators).
 * Excludes source and target themselves.
 */
export function findMediators(
  paths: string[][],
  source: string,
  target: string,
): string[] {
  const mediatorSet = new Set<string>();

  for (const path of paths) {
    for (const nodeId of path) {
      if (nodeId !== source && nodeId !== target) {
        mediatorSet.add(nodeId);
      }
    }
  }

  return Array.from(mediatorSet);
}
