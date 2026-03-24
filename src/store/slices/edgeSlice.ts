import type { StateCreator } from 'zustand';
import type { CausalEdgeData } from '../../types/dag';
import { generateId } from '../../utils/id';

export interface CausalEdge {
  id: string;
  source: string;
  target: string;
  data: CausalEdgeData;
}

export interface EdgeSlice {
  causalEdges: CausalEdge[];
  addCausalEdge: (source: string, target: string) => void;
  updateEdgeAnnotation: (id: string, annotation: string) => void;
  removeCausalEdge: (id: string) => void;
  removeEdgesForVariable: (variableId: string) => void;
}

export const createEdgeSlice: StateCreator<EdgeSlice, [], [], EdgeSlice> = (
  set,
) => ({
  causalEdges: [],

  addCausalEdge: (source, target) => {
    const edge: CausalEdge = {
      id: generateId('edge'),
      source,
      target,
      data: {},
    };
    set((state) => ({
      causalEdges: [...state.causalEdges, edge],
    }));
  },

  updateEdgeAnnotation: (id, annotation) => {
    set((state) => ({
      causalEdges: state.causalEdges.map((e) =>
        e.id === id ? { ...e, data: { ...e.data, annotation } } : e,
      ),
    }));
  },

  removeCausalEdge: (id) => {
    set((state) => ({
      causalEdges: state.causalEdges.filter((e) => e.id !== id),
    }));
  },

  removeEdgesForVariable: (variableId) => {
    set((state) => ({
      causalEdges: state.causalEdges.filter(
        (e) => e.source !== variableId && e.target !== variableId,
      ),
    }));
  },
});
