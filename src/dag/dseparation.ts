/**
 * D-separation (directional separation) engine for DAGs.
 *
 * Implements the three rules of d-separation:
 * 1. Fork:     X ← Z → Y  — blocked by conditioning on Z
 * 2. Pipe:     X → Z → Y  — blocked by conditioning on Z
 * 3. Collider: X → Z ← Y  — blocked UNLESS conditioning on Z (or descendant of Z)
 *
 * Plus the Descendant rule: conditioning on a descendant of Z
 * acts as a weaker version of conditioning on Z itself.
 *
 * Used to implement the Backdoor Criterion for causal inference.
 */

// ── Types ──

export type TripleType = 'fork' | 'pipe' | 'collider';

export interface PathEdge {
  from: string;
  to: string;
  /** True if the actual DAG edge goes from→to (forward), false if reversed */
  forward: boolean;
}

export interface UndirectedPath {
  nodes: string[];
  edges: PathEdge[];
}

export interface AdjustmentReason {
  variableId: string;
  reason: 'fork' | 'pipe-backdoor' | 'opened-collider';
  /** Human-readable explanation */
  explanation: string;
}

export interface BadControlWarning {
  variableId: string;
  type: 'collider' | 'post-treatment' | 'mediator-total';
  explanation: string;
}

export interface BackdoorResult {
  /** Variables to condition on (good controls) */
  adjustmentSet: AdjustmentReason[];
  /** Variables NOT to condition on (bad controls) */
  badControls: BadControlWarning[];
  /** All paths between treatment and outcome */
  allPaths: UndirectedPath[];
  /** Which paths are causal (front door) */
  causalPaths: UndirectedPath[];
  /** Which paths are non-causal (backdoor) */
  backdoorPaths: UndirectedPath[];
  /** Whether a valid adjustment set was found */
  identifiable: boolean;
}

// ── Helpers ──

/** Build directed adjacency: parent → children */
function buildForwardAdj(
  edges: { source: string; target: string }[],
): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  for (const e of edges) {
    if (!adj.has(e.source)) adj.set(e.source, new Set());
    adj.get(e.source)!.add(e.target);
  }
  return adj;
}

/** Build undirected adjacency (both directions) */
function buildUndirectedAdj(
  edges: { source: string; target: string }[],
): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  for (const e of edges) {
    if (!adj.has(e.source)) adj.set(e.source, new Set());
    if (!adj.has(e.target)) adj.set(e.target, new Set());
    adj.get(e.source)!.add(e.target);
    adj.get(e.target)!.add(e.source);
  }
  return adj;
}

/** Check if there's a directed edge from A to B */
function hasDirectedEdge(
  forwardAdj: Map<string, Set<string>>,
  a: string,
  b: string,
): boolean {
  return forwardAdj.get(a)?.has(b) ?? false;
}

/** Find all descendants of a node (following directed edges forward) */
export function findDescendants(
  nodeId: string,
  forwardAdj: Map<string, Set<string>>,
): Set<string> {
  const descendants = new Set<string>();
  const stack = [nodeId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    const children = forwardAdj.get(current);
    if (children) {
      for (const child of children) {
        if (!descendants.has(child)) {
          descendants.add(child);
          stack.push(child);
        }
      }
    }
  }
  return descendants;
}

/** Find all ancestors of a node (following directed edges backward) */
export function findAncestors(
  nodeId: string,
  edges: { source: string; target: string }[],
): Set<string> {
  const reverseAdj = new Map<string, Set<string>>();
  for (const e of edges) {
    if (!reverseAdj.has(e.target)) reverseAdj.set(e.target, new Set());
    reverseAdj.get(e.target)!.add(e.source);
  }
  const ancestors = new Set<string>();
  const stack = [...(reverseAdj.get(nodeId) || [])];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (ancestors.has(current)) continue;
    ancestors.add(current);
    const parents = reverseAdj.get(current);
    if (parents) for (const p of parents) stack.push(p);
  }
  return ancestors;
}

// ── Path Finding ──

/**
 * Find all undirected paths between source and target.
 * Follows edges in either direction but tracks the actual arrow direction.
 * Limited to avoid combinatorial explosion on large graphs.
 */
export function findAllUndirectedPaths(
  edges: { source: string; target: string }[],
  source: string,
  target: string,
  maxPaths = 50,
): UndirectedPath[] {
  const undirAdj = buildUndirectedAdj(edges);
  const forwardAdj = buildForwardAdj(edges);
  const results: UndirectedPath[] = [];

  function dfs(current: string, visited: Set<string>, path: string[]) {
    if (results.length >= maxPaths) return;
    if (current === target && path.length > 1) {
      const pathEdges: PathEdge[] = [];
      for (let i = 0; i < path.length - 1; i++) {
        const a = path[i], b = path[i + 1];
        pathEdges.push({
          from: a,
          to: b,
          forward: hasDirectedEdge(forwardAdj, a, b),
        });
      }
      results.push({ nodes: [...path], edges: pathEdges });
      return;
    }

    const neighbors = undirAdj.get(current);
    if (!neighbors) return;

    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        path.push(neighbor);
        dfs(neighbor, visited, path);
        path.pop();
        visited.delete(neighbor);
      }
    }
  }

  const visited = new Set([source]);
  dfs(source, visited, [source]);
  return results;
}

// ── Triple Classification ──

/**
 * Classify the triple (A, B, C) on a path.
 * We need to know the direction of the edges on the path.
 */
export function classifyTriple(
  forwardAdj: Map<string, Set<string>>,
  a: string,
  b: string,
  c: string,
): TripleType {
  const aToB = hasDirectedEdge(forwardAdj, a, b);
  const bToA = hasDirectedEdge(forwardAdj, b, a);
  const bToC = hasDirectedEdge(forwardAdj, b, c);
  const cToB = hasDirectedEdge(forwardAdj, c, b);

  // Collider: A → B ← C (both arrows into B)
  if (aToB && cToB) return 'collider';

  // Fork: A ← B → C (both arrows out of B)
  if (bToA && bToC) return 'fork';

  // Pipe: everything else (A → B → C or A ← B ← C)
  return 'pipe';
}

// ── D-Separation ──

/**
 * Check if a path is blocked (d-separated) given a conditioning set.
 *
 * Rules:
 * - Fork/Pipe at node B: blocked if B is in conditionedSet
 * - Collider at node B: blocked UNLESS B or any descendant of B is in conditionedSet
 */
export function isPathBlocked(
  edges: { source: string; target: string }[],
  path: UndirectedPath,
  conditionedSet: Set<string>,
): boolean {
  if (path.nodes.length < 3) return false; // Direct edge, never blocked by conditioning

  const forwardAdj = buildForwardAdj(edges);

  for (let i = 1; i < path.nodes.length - 1; i++) {
    const a = path.nodes[i - 1];
    const b = path.nodes[i];
    const c = path.nodes[i + 1];

    const tripleType = classifyTriple(forwardAdj, a, b, c);

    if (tripleType === 'collider') {
      // Collider: blocked UNLESS b or a descendant of b is conditioned on
      const descendants = findDescendants(b, forwardAdj);
      const bOrDescendantConditioned =
        conditionedSet.has(b) ||
        [...descendants].some((d) => conditionedSet.has(d));
      if (!bOrDescendantConditioned) {
        return true; // Blocked — collider not opened
      }
    } else {
      // Fork or Pipe: blocked IF b is conditioned on
      if (conditionedSet.has(b)) {
        return true; // Blocked
      }
    }
  }

  return false; // Not blocked — path is open
}

/**
 * Check if a path is a backdoor path (has an arrow entering the treatment).
 * A path starting at X is a backdoor path if the first edge points INTO X
 * (i.e., the edge direction goes neighbor → X on the path).
 */
export function isBackdoorPath(path: UndirectedPath, treatmentId: string): boolean {
  if (path.nodes.length < 2) return false;
  if (path.nodes[0] !== treatmentId) return false;

  // First edge: from treatment to next node
  // If the actual DAG edge is next→treatment (not forward), it's a backdoor
  return !path.edges[0].forward;
}

/**
 * Check if a path is a causal (front door) path.
 * All edges must point forward along the path direction.
 */
export function isCausalPath(path: UndirectedPath): boolean {
  return path.edges.every((e) => e.forward);
}

// ── Backdoor Criterion ──

/**
 * Find the adjustment set using the backdoor criterion.
 *
 * Algorithm:
 * 1. Find all undirected paths between treatment and outcome
 * 2. Classify each as causal or backdoor
 * 3. For backdoor paths, find which variables to condition on
 * 4. Check that conditioning doesn't open colliders on other paths
 * 5. Warn about bad controls
 */
export function findBackdoorAdjustmentSet(
  edges: { source: string; target: string }[],
  treatmentId: string,
  outcomeId: string,
  mediatorIdsForDirect: string[] = [],
): BackdoorResult {
  const forwardAdj = buildForwardAdj(edges);
  const allPaths = findAllUndirectedPaths(edges, treatmentId, outcomeId);

  const causalPaths = allPaths.filter((p) => isCausalPath(p));
  const backdoorPaths = allPaths.filter((p) => isBackdoorPath(p, treatmentId));

  // Descendants of treatment — cannot be in adjustment set
  const treatmentDescendants = findDescendants(treatmentId, forwardAdj);

  // Collect all nodes on backdoor paths (excluding treatment and outcome)
  const backdoorNodes = new Set<string>();
  for (const path of backdoorPaths) {
    for (let i = 1; i < path.nodes.length - 1; i++) {
      backdoorNodes.add(path.nodes[i]);
    }
  }

  // Identify colliders on all paths
  const colliderNodes = new Set<string>();
  for (const path of allPaths) {
    for (let i = 1; i < path.nodes.length - 1; i++) {
      const a = path.nodes[i - 1];
      const b = path.nodes[i];
      const c = path.nodes[i + 1];
      if (classifyTriple(forwardAdj, a, b, c) === 'collider') {
        colliderNodes.add(b);
      }
    }
  }

  // Strategy: try to find a minimal adjustment set
  // Start with non-collider, non-descendant nodes on backdoor paths
  const candidates = new Set<string>();
  for (const nodeId of backdoorNodes) {
    if (!treatmentDescendants.has(nodeId) && !colliderNodes.has(nodeId)) {
      candidates.add(nodeId);
    }
  }

  // Iteratively build adjustment set
  // Start with all candidates, then try to find which are actually needed
  const adjustmentSet = new Set<string>();
  const reasons: AdjustmentReason[] = [];

  // First pass: check which candidates are needed
  for (const candidate of candidates) {
    // Check if any backdoor path passes through this node as a fork or pipe
    let needed = false;
    let reasonType: AdjustmentReason['reason'] = 'fork';

    for (const path of backdoorPaths) {
      const idx = path.nodes.indexOf(candidate);
      if (idx <= 0 || idx >= path.nodes.length - 1) continue;

      const a = path.nodes[idx - 1];
      const c = path.nodes[idx + 1];
      const tripleType = classifyTriple(forwardAdj, a, candidate, c);

      if (tripleType === 'fork') {
        needed = true;
        reasonType = 'fork';
        break;
      } else if (tripleType === 'pipe') {
        needed = true;
        reasonType = 'pipe-backdoor';
        break;
      }
    }

    if (needed) {
      adjustmentSet.add(candidate);
      reasons.push({
        variableId: candidate,
        reason: reasonType,
        explanation:
          reasonType === 'fork'
            ? 'Common cause — blocks fork confound on backdoor path'
            : 'Blocks non-causal association on backdoor path',
      });
    }
  }

  // Check if conditioning on the adjustment set opens any colliders
  // If so, we need to also condition on something to block that opened path
  let changed = true;
  let iterations = 0;
  while (changed && iterations < 10) {
    changed = false;
    iterations++;

    for (const path of backdoorPaths) {
      if (!isPathBlocked(edges, path, adjustmentSet)) {
        // Path is still open — find a node to block it
        for (let i = 1; i < path.nodes.length - 1; i++) {
          const nodeId = path.nodes[i];
          if (
            adjustmentSet.has(nodeId) ||
            treatmentDescendants.has(nodeId) ||
            nodeId === treatmentId ||
            nodeId === outcomeId
          ) {
            continue;
          }

          const a = path.nodes[i - 1];
          const c = path.nodes[i + 1];
          const tt = classifyTriple(forwardAdj, a, nodeId, c);

          if (tt !== 'collider') {
            adjustmentSet.add(nodeId);
            reasons.push({
              variableId: nodeId,
              reason: 'opened-collider',
              explanation:
                'Needed to block path opened by conditioning on a collider',
            });
            changed = true;
            break;
          }
        }
      }
    }
  }

  // Verify: are all backdoor paths now blocked?
  const identifiable = backdoorPaths.every((p) =>
    isPathBlocked(edges, p, adjustmentSet),
  );

  // Build bad control warnings
  const badControls: BadControlWarning[] = [];

  // Colliders — warn not to condition on them
  for (const collider of colliderNodes) {
    if (collider !== treatmentId && collider !== outcomeId) {
      badControls.push({
        variableId: collider,
        type: 'collider',
        explanation:
          'Collider — conditioning on this creates spurious association (bad control)',
      });
    }
  }

  // Post-treatment / mediators for total effect
  for (const desc of treatmentDescendants) {
    if (desc === outcomeId) continue;
    // Check if this descendant is on a causal path (mediator)
    const isMediator = causalPaths.some(
      (p) => p.nodes.includes(desc) && p.nodes.indexOf(desc) > 0,
    );
    if (isMediator) {
      badControls.push({
        variableId: desc,
        type: 'mediator-total',
        explanation:
          'Mediator on causal path — conditioning blocks part of the causal effect (bad control for total effect)',
      });
    } else {
      badControls.push({
        variableId: desc,
        type: 'post-treatment',
        explanation:
          'Post-treatment variable — may introduce bias if conditioned on',
      });
    }
  }

  return {
    adjustmentSet: reasons,
    badControls,
    allPaths,
    causalPaths,
    backdoorPaths,
    identifiable,
  };
}
