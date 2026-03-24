/**
 * Confound detection for DAGs.
 *
 * Implements identification of elemental confound patterns,
 * starting with the Fork (A06). Pipe, Collider, and Descendant
 * will be added after A07.
 *
 * A "fork" is Z → X and Z → Y: Z is a common cause of X and Y.
 * If we want the causal effect of X on Y, we must condition on Z
 * to block the spurious association flowing through the fork.
 */

import { buildAdjacency } from './pathfinding';

export interface Fork {
  /** The common cause variable ID */
  commonCause: string;
  /** The two "prong" variable IDs */
  left: string;
  right: string;
}

export interface ConfoundWarning {
  type: 'fork';
  /** Human-readable description */
  message: string;
  /** Variable IDs that should be conditioned on to address this */
  suggestedConditionOn: string[];
  /** The fork details */
  fork: Fork;
}

/**
 * Build a reverse adjacency map (child → parents).
 */
function buildReverseAdjacency(
  edges: { source: string; target: string }[],
): Map<string, string[]> {
  const rev = new Map<string, string[]>();
  for (const edge of edges) {
    if (!rev.has(edge.target)) {
      rev.set(edge.target, []);
    }
    rev.get(edge.target)!.push(edge.source);
  }
  return rev;
}

/**
 * Find all ancestors of a node (all nodes that can reach it via directed paths).
 */
function findAncestors(
  nodeId: string,
  reverseAdj: Map<string, string[]>,
): Set<string> {
  const ancestors = new Set<string>();
  const stack = [...(reverseAdj.get(nodeId) || [])];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (ancestors.has(current)) continue;
    ancestors.add(current);
    const parents = reverseAdj.get(current) || [];
    for (const p of parents) {
      stack.push(p);
    }
  }

  return ancestors;
}

/**
 * Find all fork confounds relevant to a treatment→outcome relationship.
 *
 * A fork confound for X→Y is any variable Z such that:
 * - Z is an ancestor of X (or Z === X's direct parent)
 * - Z is an ancestor of Y (or Z === Y's direct parent)
 * - Z is NOT on a directed path from X to Y (not a mediator)
 * - Z is NOT X and NOT Y
 *
 * These are "backdoor paths" — non-causal paths that create
 * spurious association between X and Y.
 */
export function findForkConfounds(
  edges: { source: string; target: string }[],
  treatmentId: string,
  outcomeId: string,
  mediatorIds: string[] = [],
): Fork[] {
  const reverseAdj = buildReverseAdjacency(edges);
  const adj = buildAdjacency(edges);

  const treatmentAncestors = findAncestors(treatmentId, reverseAdj);
  const outcomeAncestors = findAncestors(outcomeId, reverseAdj);

  const mediatorSet = new Set(mediatorIds);
  const forks: Fork[] = [];

  // A common cause is any variable that is an ancestor of BOTH
  // the treatment and the outcome (but not the treatment or outcome itself,
  // and not a mediator on the causal path)
  const allNodes = new Set<string>();
  for (const edge of edges) {
    allNodes.add(edge.source);
    allNodes.add(edge.target);
  }

  for (const z of allNodes) {
    if (z === treatmentId || z === outcomeId) continue;
    if (mediatorSet.has(z)) continue;

    const zReachesTreatment =
      treatmentAncestors.has(z) || (adj.get(z) || []).includes(treatmentId);
    const zReachesOutcome =
      outcomeAncestors.has(z) || (adj.get(z) || []).includes(outcomeId);

    if (zReachesTreatment && zReachesOutcome) {
      forks.push({
        commonCause: z,
        left: treatmentId,
        right: outcomeId,
      });
    }
  }

  return forks;
}

/**
 * Get the minimal conditioning set to block all fork confounds.
 *
 * For forks, we need to condition on the common causes (or their
 * descendants, but for simplicity we suggest the common causes directly).
 *
 * Returns deduplicated variable IDs to condition on.
 */
export function suggestConditioningSet(
  edges: { source: string; target: string }[],
  treatmentId: string,
  outcomeId: string,
  mediatorIds: string[] = [],
): string[] {
  const forks = findForkConfounds(edges, treatmentId, outcomeId, mediatorIds);

  const conditionOn = new Set<string>();
  for (const fork of forks) {
    conditionOn.add(fork.commonCause);
  }

  return Array.from(conditionOn);
}

/**
 * Generate confound warnings for a given treatment→outcome estimand.
 *
 * Checks whether the current conditioning set addresses all detected
 * confounds. Returns warnings for any unaddressed confounds.
 */
export function checkConfounds(
  edges: { source: string; target: string }[],
  treatmentId: string,
  outcomeId: string,
  currentConditionOn: string[] = [],
  mediatorIds: string[] = [],
): ConfoundWarning[] {
  const forks = findForkConfounds(edges, treatmentId, outcomeId, mediatorIds);
  const conditioned = new Set(currentConditionOn);
  const warnings: ConfoundWarning[] = [];

  for (const fork of forks) {
    if (!conditioned.has(fork.commonCause)) {
      warnings.push({
        type: 'fork',
        message: `Potential confound: common cause that influences both treatment and outcome`,
        suggestedConditionOn: [fork.commonCause],
        fork,
      });
    }
  }

  return warnings;
}
