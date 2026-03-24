import type { StateCreator } from 'zustand';
import type { Estimand, EstimandKind, Variable } from '../../types/dag';
import { generateId } from '../../utils/id';
import { findAllPaths, buildAdjacency } from '../../dag/pathfinding';
import { generateDoNotation } from '../../dag/doCalculus';
import { generateModel } from '../../dag/modelGen';
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
  toggleEstimandInteraction: (
    estimandId: string,
    variables: Map<string, Variable>,
  ) => void;
}

/**
 * Helper to compute model fields for an estimand.
 */
function computeModel(
  source: Variable,
  target: Variable,
  kind: EstimandKind,
  excludedMediatorIds: string[],
  interaction: boolean,
  variables: Map<string, Variable>,
) {
  // For direct effects, the excluded mediators become conditioning variables
  const conditionOn =
    kind === 'direct'
      ? excludedMediatorIds
          .map((id) => variables.get(id))
          .filter((v): v is Variable => v !== undefined)
      : [];

  const model = generateModel(target, source, kind, conditionOn, interaction);

  return {
    mathLines: model.mathLines,
    brmsCode: model.brmsCode,
    brmsFamily: model.family,
  };
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

    const interaction = false; // default to additive
    const modelFields = computeModel(
      source,
      target,
      kind,
      excludedMediatorIds,
      interaction,
      variables,
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
      interaction,
      ...modelFields,
    };

    let activePaths: string[][];
    if (kind === 'total') {
      activePaths = paths;
    } else {
      activePaths = paths.filter(
        (path) =>
          !path.some((nodeId) => excludedMediatorIds.includes(nodeId)),
      );
      // If no direct paths exist, still highlight source→target
      if (activePaths.length === 0) {
        activePaths = [[sourceId, targetId]];
      }
    }

    set((state) => ({
      estimands: [...state.estimands, estimand],
      highlightedEstimandId: estimand.id,
      highlightedPaths: activePaths,
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

      let activePaths: string[][];

      if (estimand.kind === 'total') {
        activePaths = estimand.paths;
      } else {
        // Direct effect: show paths that DON'T go through excluded mediators
        activePaths = estimand.paths.filter(
          (path) =>
            !path.some((nodeId) =>
              estimand.excludedMediators.includes(nodeId),
            ),
        );

        // If no direct paths exist (all paths go through mediators),
        // still highlight source and target to show the relationship
        if (activePaths.length === 0) {
          activePaths = [[estimand.sourceId, estimand.targetId]];
        }
      }

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
          e.sourceId !== variableId && e.targetId !== variableId,
      ),
    }));
  },

  toggleEstimandInteraction: (estimandId, variables) => {
    set((state) => {
      const estimands = state.estimands.map((e) => {
        if (e.id !== estimandId) return e;

        const newInteraction = !e.interaction;
        const source = variables.get(e.sourceId);
        const target = variables.get(e.targetId);
        if (!source || !target) return e;

        const modelFields = computeModel(
          source,
          target,
          e.kind,
          e.excludedMediators,
          newInteraction,
          variables,
        );

        return {
          ...e,
          interaction: newInteraction,
          ...modelFields,
        };
      });

      return { estimands };
    });
  },
});
