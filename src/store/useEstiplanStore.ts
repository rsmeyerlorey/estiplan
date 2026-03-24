import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import {
  type VariableSlice,
  createVariableSlice,
} from './slices/variableSlice';
import { type EdgeSlice, createEdgeSlice } from './slices/edgeSlice';
import {
  type EstimandSlice,
  createEstimandSlice,
} from './slices/estimandSlice';
import { type ThemeSlice, createThemeSlice } from './slices/themeSlice';
import type { Node, Edge } from '@xyflow/react';
import type { Variable, CausalEdgeData } from '../types/dag';
import { applyDagreLayout } from '../dag/layout';
import {
  saveToLocalStorage,
  loadFromLocalStorage,
  clearLocalStorage,
  type SavedState,
} from './persistence';
import { historyManager, type HistorySnapshot } from './history';

export interface NodePositions {
  [nodeId: string]: { x: number; y: number };
}

interface CanvasSlice {
  nodePositions: NodePositions;
  setNodePosition: (id: string, x: number, y: number) => void;
  getRfNodes: () => Node[];
  getRfEdges: () => Edge[];
  autoLayout: () => void;
  deleteVariable: (id: string) => void;
}

interface AppSlice {
  clearAll: () => void;
  loadState: (saved: SavedState) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  pushSnapshot: () => void;
  getSerializableState: () => SavedState;
}

type EstiplanStore = VariableSlice &
  EdgeSlice &
  EstimandSlice &
  ThemeSlice &
  CanvasSlice &
  AppSlice;

// Load saved state
const saved = loadFromLocalStorage();

export const useEstiplanStore = create<EstiplanStore>()(
  subscribeWithSelector((set, get, api) => {
    function getCurrentSnapshot(): HistorySnapshot {
      const s = get();
      return {
        variables: Array.from(s.variables.entries()),
        causalEdges: s.causalEdges,
        estimands: s.estimands,
        nodePositions: s.nodePositions,
      };
    }

    function applySnapshot(snapshot: HistorySnapshot) {
      set({
        variables: new Map(snapshot.variables),
        causalEdges: snapshot.causalEdges,
        estimands: snapshot.estimands,
        nodePositions: snapshot.nodePositions,
        highlightedEstimandId: null,
        highlightedPaths: null,
      });
    }

    const store: EstiplanStore = {
      ...createVariableSlice(set, get, api),
      ...createEdgeSlice(set, get, api),
      ...createEstimandSlice(set, get, api),
      ...createThemeSlice(set, get, api),

      // Canvas state
      nodePositions: (saved?.nodePositions || {}) as NodePositions,

      setNodePosition: (id, x, y) => {
        set((state) => ({
          nodePositions: { ...state.nodePositions, [id]: { x, y } },
        }));
      },

      getRfNodes: () => {
        const state = get();
        const nodes: Node[] = [];

        state.variables.forEach((variable: Variable) => {
          const pos = state.nodePositions[variable.id] || { x: 200, y: 200 };
          nodes.push({
            id: variable.id,
            type: 'variable',
            position: pos,
            data: { ...variable },
          });
        });

        state.estimands.forEach((estimand) => {
          const sourcePos = state.nodePositions[estimand.sourceId] || {
            x: 200,
            y: 200,
          };
          const targetPos = state.nodePositions[estimand.targetId] || {
            x: 300,
            y: 300,
          };
          const cardPos = state.nodePositions[estimand.id] || {
            x: (sourcePos.x + targetPos.x) / 2 + 150,
            y: (sourcePos.y + targetPos.y) / 2,
          };

          nodes.push({
            id: estimand.id,
            type: 'estimandCard',
            position: cardPos,
            data: { ...estimand },
          });
        });

        return nodes;
      },

      getRfEdges: () => {
        const state = get();
        const highlightedEdgePairs = new Set<string>();

        if (state.highlightedPaths) {
          for (const path of state.highlightedPaths) {
            for (let i = 0; i < path.length - 1; i++) {
              highlightedEdgePairs.add(`${path[i]}->${path[i + 1]}`);
            }
          }
        }

        const hasHighlighting = state.highlightedPaths !== null;

        return state.causalEdges.map((edge) => {
          const pairKey = `${edge.source}->${edge.target}`;
          const isHighlighted = highlightedEdgePairs.has(pairKey);
          const isDimmed = hasHighlighting && !isHighlighted;

          return {
            id: edge.id,
            source: edge.source,
            target: edge.target,
            type: 'causalArrow',
            data: {
              ...edge.data,
              isHighlighted,
              isDimmed,
            } as CausalEdgeData & {
              isHighlighted: boolean;
              isDimmed: boolean;
            },
            animated: isHighlighted,
          };
        });
      },

      autoLayout: () => {
        const state = get();
        const rfNodes = state
          .getRfNodes()
          .filter((n) => n.type === 'variable');
        const rfEdges = state.getRfEdges();
        const layouted = applyDagreLayout(
          rfNodes,
          rfEdges,
          state.flowDirection,
        );

        const newPositions: NodePositions = { ...state.nodePositions };
        for (const node of layouted) {
          newPositions[node.id] = node.position;
        }
        set({ nodePositions: newPositions });
      },

      deleteVariable: (id) => {
        const state = get();
        state.removeVariable(id);
        state.removeEdgesForVariable(id);
        state.removeEstimandsForVariable(id);
        set((s) => {
          const newPositions = { ...s.nodePositions };
          delete newPositions[id];
          return { nodePositions: newPositions };
        });
      },

      // App-level actions
      clearAll: () => {
        get().pushSnapshot();
        clearLocalStorage();
        set({
          variables: new Map(),
          causalEdges: [],
          estimands: [],
          nodePositions: {},
          highlightedEstimandId: null,
          highlightedPaths: null,
        });
      },

      loadState: (savedState: SavedState) => {
        get().pushSnapshot();
        set({
          variables: new Map(savedState.variables),
          causalEdges: savedState.causalEdges,
          estimands: savedState.estimands,
          nodePositions: savedState.nodePositions,
          theme: savedState.theme,
          flowDirection: savedState.flowDirection,
          highlightedEstimandId: null,
          highlightedPaths: null,
        });
      },

      getSerializableState: () => {
        const s = get();
        return {
          version: 1 as const,
          variables: Array.from(s.variables.entries()),
          causalEdges: s.causalEdges,
          estimands: s.estimands,
          nodePositions: s.nodePositions,
          theme: s.theme,
          flowDirection: s.flowDirection,
        };
      },

      pushSnapshot: () => {
        historyManager.push(getCurrentSnapshot());
      },

      undo: () => {
        const current = getCurrentSnapshot();
        const snapshot = historyManager.undo(current);
        if (snapshot) {
          historyManager.pause();
          applySnapshot(snapshot);
          historyManager.resume();
        }
      },

      redo: () => {
        const current = getCurrentSnapshot();
        const snapshot = historyManager.redo(current);
        if (snapshot) {
          historyManager.pause();
          applySnapshot(snapshot);
          historyManager.resume();
        }
      },

      canUndo: () => historyManager.canUndo,
      canRedo: () => historyManager.canRedo,
    };

    // Apply saved state overrides
    if (saved) {
      store.variables = new Map(saved.variables);
      store.causalEdges = saved.causalEdges;
      store.estimands = saved.estimands;
      store.theme = saved.theme;
      store.flowDirection = saved.flowDirection;
    }

    return store;
  }),
);

// Auto-save: debounce writes to localStorage
let saveTimeout: ReturnType<typeof setTimeout> | null = null;

useEstiplanStore.subscribe(
  (state) => ({
    variables: state.variables,
    causalEdges: state.causalEdges,
    estimands: state.estimands,
    nodePositions: state.nodePositions,
    theme: state.theme,
    flowDirection: state.flowDirection,
  }),
  (slice) => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      saveToLocalStorage(slice);
    }, 500);
  },
  { equalityFn: () => false }, // always trigger (we debounce anyway)
);

// History snapshot: push snapshots when state changes (debounced to avoid
// capturing every pixel of node dragging)
let historyTimeout: ReturnType<typeof setTimeout> | null = null;

useEstiplanStore.subscribe(
  (state) => ({
    variables: state.variables,
    causalEdges: state.causalEdges,
    estimands: state.estimands,
    nodePositions: state.nodePositions,
  }),
  () => {
    if (historyManager.isPaused) return;
    if (historyTimeout) clearTimeout(historyTimeout);
    historyTimeout = setTimeout(() => {
      const s = useEstiplanStore.getState();
      historyManager.push({
        variables: Array.from(s.variables.entries()),
        causalEdges: s.causalEdges,
        estimands: s.estimands,
        nodePositions: s.nodePositions,
      });
    }, 800);
  },
  { equalityFn: () => false },
);
