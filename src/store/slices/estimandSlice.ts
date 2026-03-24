import type { StateCreator } from 'zustand';
import type { Estimand, EstimandKind, Variable } from '../../types/dag';
import { generateId } from '../../utils/id';
import { findAllPaths, buildAdjacency } from '../../dag/pathfinding';
import { generateDoNotation } from '../../dag/doCalculus';
import type { CausalEdge } from './edgeSlice';

export interface EstimandSlice {
  estimands: Estimand[];
  highlightedEstimandId: string | null;
  highlightedPaths: string[][] | null;
  declareEstimand: (
    sourceId: string,
    targetId: string,
    kind: EstimandKind,
    excludedMediatorIds: string[],
    variables: Map<string, Variable>,
    edges: CausalEdge[],
  ) => void;
  removeEstimand: (id: string) => void;
  setHighlightedEstimand: (id: string | null) => void;
  removeEstimandsForVariable: (variableId: string) => void;
}

export const createEstimandSlice: StateCreator<
  EstimandSlice,
  [],
  [],
  EstimandSlice
> = (set) => ({
  estimands: [],
  highlightedEstimandId: null,
  highlightedPaths: null,

  declareEstimand: (
    sourceId,
    targetId,
    kind,
    excludedMediatorIds,
    variables,
    edges,
  ) => {
    const source = variables.get(sourceId);
    const target = variables.get(targetId);
    if (!source || !target) return;

    const adjacency = buildAdjacency(edges);
    const paths = findAllPaths(adjacency, sourceId, targetId);

    const excludedMediators = excludedMediatorIds
      .map((id) => variables.get(id))
      .filter((v): v is Variable => v !== undefined);

    const { doNotation, plainEnglish } = generateDoNotation(
      source,
      target,
      kind,
      excludedMediators,
    );

    const estimand: Estimand = {
      id: generateId('est'),
      sourceId,
      targetId,
      kind,
      excludedMediators: excludedMediatorIds,
      paths,
      doNotation,
      plainEnglish,
    };

    set((state) => ({
      estimands: [...state.estimands, estimand],
      highlightedEstimandId: estimand.id,
      highlightedPaths: kind === 'total'
        ? paths
        : paths.filter(
            (path) =>
              !path.some((nodeId) => excludedMediatorIds.includes(nodeId)),
          ),
    }));
  },

  removeEstimand: (id) => {
    set((state) => ({
      estimands: state.estimands.filter((e) => e.id !== id),
      highlightedEstimandId:
        state.highlightedEstimandId === id
          ? null
          : state.highlightedEstimandId,
      highlightedPaths:
        state.highlightedEstimandId === id ? null : state.highlightedPaths,
    }));
  },

  setHighlightedEstimand: (id) => {
    set((state) => {
      if (id === null) {
        return { highlightedEstimandId: null, highlightedPaths: null };
      }
      const estimand = state.estimands.find((e) => e.id === id);
      if (!estimand) {
        return { highlightedEstimandId: null, highlightedPaths: null };
      }

      const activePaths =
        estimand.kind === 'total'
          ? estimand.paths
          : estimand.paths.filter(
              (path) =>
                !path.some((nodeId) =>
                  estimand.excludedMediators.includes(nodeId),
                ),
            );

      return {
        highlightedEstimandId: id,
        highlightedPaths: activePaths,
      };
    });
  },

  removeEstimandsForVariable: (variableId) => {
    set((state) => ({
      estimands: state.estimands.filter(
        (e) =>
          e.sourceId !== variableId &&
          e.targetId !== variableId,
      ),
    }));
  },
});
