/**
 * Find all directed paths from source to target in a DAG.
 * Each path is an array of node IDs including source and target.
 */
export function findAllPaths(
  adjacency: Map<string, string[]>,
  source: string,
  target: string,
): string[][] {
  const results: string[][] = [];
  const visited = new Set<string>();

  function dfs(current: string, path: string[]) {
    if (current === target) {
      results.push([...path]);
      return;
    }

    visited.add(current);
    const neighbors = adjacency.get(current) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        path.push(neighbor);
        dfs(neighbor, path);
        path.pop();
      }
    }
    visited.delete(current);
  }

  dfs(source, [source]);
  return results;
}

/**
 * Build an adjacency list from an array of edges.
 */
export function buildAdjacency(
  edges: { source: string; target: string }[],
): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const edge of edges) {
    if (!adj.has(edge.source)) {
      adj.set(edge.source, []);
    }
    adj.get(edge.source)!.push(edge.target);
  }
  return adj;
}

/**
 * Check if adding an edge from `source` to `target` would create a cycle.
 * A cycle exists if there is already a path from `target` back to `source`
 * in the existing graph (meaning the new edge would complete a loop).
 */
export function wouldCreateCycle(
  edges: { source: string; target: string }[],
  newSource: string,
  newTarget: string,
): boolean {
  const adj = buildAdjacency(edges);
  // Check: can we reach newSource starting from newTarget?
  const visited = new Set<string>();
  const stack = [newTarget];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === newSource) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    const neighbors = adj.get(current) || [];
    for (const neighbor of neighbors) {
      stack.push(neighbor);
    }
  }

  return false;
}
