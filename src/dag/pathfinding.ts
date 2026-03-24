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
