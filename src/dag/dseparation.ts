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

/** Variable worth conditioning on for precision, not identification */
export interface PrecisionCovariate {
  variableId: string;
  explanation: string;
}

/** Warning about a sample-selection variable (conditioned on by design) */
export interface SelectionWarning {
  variableId: string;
  type: 'selection-collider' | 'selection-mediator';
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
  /** Parents of the outcome unrelated to treatment — optional precision covariates */
  precisionCandidates: PrecisionCovariate[];
  /** Warnings about sample-selection variables */
  selectionWarnings: SelectionWarning[];
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
  path: UndirectedPath,
  conditionedSet: Set<string>,
  forwardAdj: Map<string, Set<string>>,
): boolean {
  if (path.nodes.length < 3) return false; // Direct edge, never blocked by conditioning

  for (let i = 1; i < path.nodes.length - 1; i++) {
    const a = path.nodes[i - 1];
    const b = path.nodes[i];
    const c = path.nodes[i + 1];

    const tripleType = classifyTriple(forwardAdj, a, b, c);

    if (tripleType === 'collider') {
      // Collider: blocked UNLESS b or a descendant of b is conditioned on
      if (conditionedSet.has(b)) continue;
      const descendants = findDescendants(b, forwardAdj);
      let opened = false;
      for (const d of descendants) {
        if (conditionedSet.has(d)) { opened = true; break; }
      }
      if (!opened) {
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

// ── Minimal Set Enumeration ──

/** Generate all combinations of `size` elements from `arr`. */
function* combinations<T>(arr: T[], size: number): Generator<T[]> {
  if (size === 0) { yield []; return; }
  if (size > arr.length) return;
  if (size === arr.length) { yield [...arr]; return; }

  for (let i = 0; i <= arr.length - size; i++) {
    for (const rest of combinations(arr.slice(i + 1), size - 1)) {
      yield [arr[i], ...rest];
    }
  }
}

/**
 * Find the smallest subset of candidates that blocks all backdoor paths.
 * Enumerates subsets by increasing size (0, 1, 2, ...).
 *
 * `baseConditioned` holds variables conditioned on regardless of the
 * adjustment set (excluded mediators for direct effects, selection
 * variables) — every subset is evaluated together with them, so blocking
 * accounts for paths they close AND colliders they open.
 */
function findMinimalBlockingSet(
  candidates: string[],
  backdoorPaths: UndirectedPath[],
  forwardAdj: Map<string, Set<string>>,
  baseConditioned: Set<string> = new Set(),
): Set<string> {
  for (let size = 0; size <= candidates.length; size++) {
    for (const subset of combinations(candidates, size)) {
      const condSet = new Set([...subset, ...baseConditioned]);
      if (backdoorPaths.every((p) => isPathBlocked(p, condSet, forwardAdj))) {
        return new Set(subset);
      }
    }
  }
  // Shouldn't reach here if full candidate set works
  return new Set(candidates);
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
  unobservedIds: Set<string> = new Set(),
  selectionIds: Set<string> = new Set(),
): BackdoorResult {
  const forwardAdj = buildForwardAdj(edges);
  const allPaths = findAllUndirectedPaths(edges, treatmentId, outcomeId);

  const causalPaths = allPaths.filter((p) => isCausalPath(p));
  const backdoorPaths = allPaths.filter((p) => isBackdoorPath(p, treatmentId));
  // Non-standard paths: start forward then reverse (e.g., X -> A <- B -> Y).
  // These always contain a collider so they're blocked by default, but we must
  // verify the adjustment set doesn't accidentally open them.
  const nonStandardPaths = allPaths.filter(
    (p) => !isCausalPath(p) && !isBackdoorPath(p, treatmentId),
  );
  // All non-causal paths that must be blocked (backdoor + non-standard)
  const pathsToBlock = [...backdoorPaths, ...nonStandardPaths];

  // Conditioned on by design, independent of the adjustment set:
  // excluded mediators (direct effects) and selection variables (the sample
  // itself is stratified on them — selection acts exactly like conditioning).
  const baseConditioned = new Set<string>();
  for (const m of mediatorIdsForDirect) baseConditioned.add(m);
  for (const s of selectionIds) {
    if (s !== treatmentId && s !== outcomeId) baseConditioned.add(s);
  }

  // Descendants of treatment — cannot be in adjustment set
  const treatmentDescendants = findDescendants(treatmentId, forwardAdj);

  // Collect all nodes on paths that need blocking (excluding endpoints).
  // Backdoor-path nodes block classic confounding; non-standard-path nodes
  // only matter when base conditioning (mediator/selection) opens a collider
  // on such a path and an observed fork/pipe on it can re-block it.
  const backdoorNodes = new Set<string>();
  for (const path of pathsToBlock) {
    for (let i = 1; i < path.nodes.length - 1; i++) {
      backdoorNodes.add(path.nodes[i]);
    }
  }

  // Identify colliders on non-causal paths only.
  // A node that is a collider on a causal path is really a mediator,
  // not a "bad control collider" — the collider warning is only relevant
  // for nodes whose conditioning would open a NON-causal path.
  const colliderNodes = new Set<string>();
  const nonCausalPaths = allPaths.filter((p) => !isCausalPath(p));
  for (const path of nonCausalPaths) {
    for (let i = 1; i < path.nodes.length - 1; i++) {
      const a = path.nodes[i - 1];
      const b = path.nodes[i];
      const c = path.nodes[i + 1];
      if (classifyTriple(forwardAdj, a, b, c) === 'collider') {
        colliderNodes.add(b);
      }
    }
  }

  // Strategy: find the MINIMAL adjustment set.
  // Collect eligible candidates, then enumerate subsets by increasing size.
  // The first subset that blocks all backdoor paths is the smallest valid set.
  const candidates = new Set<string>();
  for (const nodeId of backdoorNodes) {
    if (
      !treatmentDescendants.has(nodeId) &&
      !colliderNodes.has(nodeId) &&
      !unobservedIds.has(nodeId) &&
      !baseConditioned.has(nodeId)
    ) {
      candidates.add(nodeId);
    }
  }

  const candidateArr = [...candidates];

  // Find the smallest subset of candidates that blocks all non-causal paths
  // (both backdoor and non-standard), given the base-conditioned variables.
  // isPathBlocked handles collider-opening correctly: if conditioning opens
  // a collider, the path is reported as unblocked, so the subset is rejected.
  // Cap at 15 candidates to avoid combinatorial explosion; fall back to full set.
  let adjustmentSet: Set<string>;
  if (candidateArr.length <= 15 && pathsToBlock.length > 0) {
    adjustmentSet = findMinimalBlockingSet(
      candidateArr,
      pathsToBlock,
      forwardAdj,
      baseConditioned,
    );
  } else if (pathsToBlock.length === 0) {
    adjustmentSet = new Set();
  } else {
    adjustmentSet = candidates; // fallback for very large DAGs
  }

  // Everything actually conditioned on in the model
  const fullConditioned = new Set([...adjustmentSet, ...baseConditioned]);

  // Assign reasons: check each variable's role on backdoor paths.
  // Variables that sit on no backdoor path are there to re-block a path
  // opened by conditioning on a mediator or selection variable.
  const reasons: AdjustmentReason[] = [];
  for (const nodeId of adjustmentSet) {
    let reasonType: AdjustmentReason['reason'] | null = null;
    for (const path of backdoorPaths) {
      const idx = path.nodes.indexOf(nodeId);
      if (idx <= 0 || idx >= path.nodes.length - 1) continue;
      const a = path.nodes[idx - 1];
      const c = path.nodes[idx + 1];
      if (classifyTriple(forwardAdj, a, nodeId, c) === 'fork') {
        reasonType = 'fork';
        break;
      }
      reasonType = 'pipe-backdoor';
    }
    if (reasonType === null) reasonType = 'opened-collider';
    reasons.push({
      variableId: nodeId,
      reason: reasonType,
      explanation:
        reasonType === 'fork'
          ? 'Common cause — blocks fork confound on backdoor path'
          : reasonType === 'opened-collider'
            ? 'Blocks a non-causal path opened by conditioning on a mediator or selection variable'
            : 'Blocks non-causal association on backdoor path',
    });
  }

  // Verify: are all non-causal paths blocked (backdoor + non-standard),
  // given everything conditioned on (adjustment set + mediators + selection)?
  let identifiable = pathsToBlock.every((p) =>
    isPathBlocked(p, fullConditioned, forwardAdj),
  );

  // ── Sample-selection warnings ──
  // Selection acts like conditioning that cannot be undone. Two failure modes:
  // 1. Selection on a mediator blocks part of the causal effect (survivorship).
  // 2. Selection on a collider opens a non-causal path; if no observed
  //    variable re-blocks it, the effect is not identifiable from this sample.
  const selectionWarnings: SelectionWarning[] = [];
  for (const s of selectionIds) {
    if (s === treatmentId || s === outcomeId) continue;

    const onCausalPath = causalPaths.some((p) => {
      const idx = p.nodes.indexOf(s);
      return idx > 0 && idx < p.nodes.length - 1;
    });
    if (onCausalPath && !mediatorIdsForDirect.includes(s)) {
      selectionWarnings.push({
        variableId: s,
        type: 'selection-mediator',
        explanation:
          'The sample is selected on this variable, which lies on a causal path — selection blocks part of the effect being estimated (survivorship bias)',
      });
      identifiable = false;
      continue;
    }

    const opensUnblockedPath = pathsToBlock.some((p) => {
      if (isPathBlocked(p, fullConditioned, forwardAdj)) return false;
      // Path is open — is this selection variable a collider-opener on it?
      for (let i = 1; i < p.nodes.length - 1; i++) {
        const b = p.nodes[i];
        const triple = classifyTriple(
          forwardAdj,
          p.nodes[i - 1],
          b,
          p.nodes[i + 1],
        );
        if (triple === 'collider') {
          if (b === s || findDescendants(b, forwardAdj).has(s)) return true;
        }
      }
      return false;
    });
    if (opensUnblockedPath) {
      selectionWarnings.push({
        variableId: s,
        type: 'selection-collider',
        explanation:
          'The sample is selected on this variable, which is a collider — selection opens a non-causal path that no observed variable can block',
      });
    }
  }

  // ── Precision covariates ──
  // Parents of the outcome with no causal connection to the treatment.
  // Not needed for identification, but conditioning on them soaks up outcome
  // variance and tightens the estimate (McElreath's wine judges, lecture A8).
  const nodesOnAnyPath = new Set<string>();
  for (const p of allPaths) for (const n of p.nodes) nodesOnAnyPath.add(n);

  const outcomeParents = new Set<string>();
  for (const e of edges) {
    if (e.target === outcomeId) outcomeParents.add(e.source);
  }

  const precisionCandidates: PrecisionCovariate[] = [];
  for (const parent of outcomeParents) {
    if (parent === treatmentId) continue;
    if (nodesOnAnyPath.has(parent)) continue; // has a causal role already
    if (treatmentDescendants.has(parent)) continue; // post-treatment
    if (unobservedIds.has(parent)) continue;
    if (selectionIds.has(parent)) continue;
    if (fullConditioned.has(parent)) continue;
    // Safety: conditioning on it must not open any path we rely on being blocked
    const safe = pathsToBlock.every((p) => {
      if (!isPathBlocked(p, fullConditioned, forwardAdj)) return true; // already open
      return isPathBlocked(
        p,
        new Set([...fullConditioned, parent]),
        forwardAdj,
      );
    });
    if (safe) {
      precisionCandidates.push({
        variableId: parent,
        explanation:
          'Direct cause of the outcome unrelated to the treatment — conditioning on it soaks up outcome variance and tightens the estimate. Optional: not needed for identification.',
      });
    }
  }

  // Build bad control warnings
  const badControls: BadControlWarning[] = [];
  const badControlSeen = new Set<string>();

  // For direct effects, the excluded mediators are SUPPOSED to be
  // conditioned on, so don't flag them as bad controls.
  const directExclusions = new Set(mediatorIdsForDirect);

  // Post-treatment / mediators for total effect (most informative, add first)
  for (const desc of treatmentDescendants) {
    if (desc === outcomeId) continue;
    if (directExclusions.has(desc)) continue; // Wanted for direct effect
    if (selectionIds.has(desc)) continue; // Conditioned by design — has its own warning
    if (badControlSeen.has(desc)) continue;

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
    badControlSeen.add(desc);
  }

  // Colliders — warn not to condition on them
  // Skip nodes already covered by mediator/post-treatment warnings
  for (const collider of colliderNodes) {
    if (collider === treatmentId || collider === outcomeId) continue;
    if (badControlSeen.has(collider)) continue;
    if (directExclusions.has(collider)) continue;
    if (selectionIds.has(collider)) continue; // Conditioned by design — has its own warning

    badControls.push({
      variableId: collider,
      type: 'collider',
      explanation:
        'Collider — conditioning on this creates spurious association (bad control)',
    });
    badControlSeen.add(collider);
  }

  // Descendants of colliders — also bad controls
  for (const collider of colliderNodes) {
    const colliderDescendants = findDescendants(collider, forwardAdj);
    for (const desc of colliderDescendants) {
      if (desc === treatmentId || desc === outcomeId) continue;
      if (badControlSeen.has(desc)) continue;
      if (directExclusions.has(desc)) continue;
      if (selectionIds.has(desc)) continue; // Conditioned by design — has its own warning
      if (colliderNodes.has(desc)) continue; // Already handled as collider

      badControls.push({
        variableId: desc,
        type: 'collider',
        explanation:
          'Descendant of collider — conditioning on this partially opens a non-causal path (bad control)',
      });
      badControlSeen.add(desc);
    }
  }

  return {
    adjustmentSet: reasons,
    badControls,
    allPaths,
    causalPaths,
    backdoorPaths,
    identifiable,
    precisionCandidates,
    selectionWarnings,
  };
}
