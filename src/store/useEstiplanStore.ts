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
} from './persistence';

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

type EstiplanStore = VariableSlice &
  EdgeSlice &
  EstimandSlice &
  ThemeSlice &
  CanvasSlice;

// Load saved state
const saved = loadFromLocalStorage();

export const useEstiplanStore = create<EstiplanStore>()(
  subscribeWithSelector((set, get, api) => {
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
