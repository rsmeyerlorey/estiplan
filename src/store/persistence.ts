import type { Variable } from '../types/dag';
import type { Estimand, StatisticalModel } from '../types/dag';
import type { CausalEdge } from './slices/edgeSlice';
import type { NodePositions } from './useEstiplanStore';
import type { ThemeMode, FlowDirection } from '../types/theme';

const STORAGE_KEY = 'estiplan-save';

export interface SavedState {
  version: 1;
  variables: [string, Variable][];
  causalEdges: CausalEdge[];
  estimands: Estimand[];
  models?: StatisticalModel[];
  nodePositions: NodePositions;
  theme: ThemeMode;
  flowDirection: FlowDirection;
}

/**
 * Save the current state to localStorage.
 */
export function saveToLocalStorage(state: {
  variables: Map<string, Variable>;
  causalEdges: CausalEdge[];
  estimands: Estimand[];
  models: StatisticalModel[];
  nodePositions: NodePositions;
  theme: ThemeMode;
  flowDirection: FlowDirection;
}): void {
  const saved: SavedState = {
    version: 1,
    variables: Array.from(state.variables.entries()),
    causalEdges: state.causalEdges,
    estimands: state.estimands,
    models: state.models,
    nodePositions: state.nodePositions,
    theme: state.theme,
    flowDirection: state.flowDirection,
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  } catch {
    console.warn('Estiplan: failed to save to localStorage');
  }
}

/**
 * Load saved state from localStorage. Returns null if nothing saved.
 */
export function loadFromLocalStorage(): SavedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as SavedState;
    if (parsed.version !== 1) return null;

    return parsed;
  } catch {
    console.warn('Estiplan: failed to load from localStorage');
    return null;
  }
}

/**
 * Clear saved state.
 */
export function clearLocalStorage(): void {
  localStorage.removeItem(STORAGE_KEY);
}
