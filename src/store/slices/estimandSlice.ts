import type { StateCreator } from 'zustand';
import type {
  Estimand,
  StatisticalModel,
  EstimandKind,
  Variable,
} from '../../types/dag';
import { generateId } from '../../utils/id';
import { findAllPaths, buildAdjacency } from '../../dag/pathfinding';
import { generateDoNotation } from '../../dag/doCalculus';
import { generateModel } from '../../dag/modelGen';
import { findBackdoorAdjustmentSet } from '../../dag/dseparation';
import type { CausalEdge } from './edgeSlice';

export interface EstimandSlice {
  estimands: Estimand[];
  models: StatisticalModel[];
  highlightedEstimandId: string | null;
  highlightedModelId: string | null;
  highlightedPaths: string[][] | null;
  declareEstimand: (
    sourceId: string,
    targetId: string,
    kind: EstimandKind,
    excludedMediatorIds: string[],
    variables: Map<string, Variable>,
    edges: CausalEdge[],
  ) => void;
  generateModelForEstimand: (
    estimandId: string,
    variables: Map<string, Variable>,
    edges: CausalEdge[],
  ) => void;
  removeEstimand: (id: string) => void;
  removeModel: (modelId: string) => void;
  setHighlightedEstimand: (id: string | null) => void;
  setHighlightedModel: (id: string | null) => void;
  removeEstimandsForVariable: (variableId: string) => void;
  toggleModelInteraction: (
    modelId: string,
    variables: Map<string, Variable>,
  ) => void;
}

/**
 * Helper to compute model fields.
 */
function computeModelFields(
  source: Variable,
  target: Variable,
  kind: EstimandKind,
  conditionOnIds: string[],
  excludedMediatorIds: string[],
  interaction: boolean,
  variables: Map<string, Variable>,
) {
  const mediatorVars =
    kind === 'direct'
      ? excludedMediatorIds
          .map((id) => variables.get(id))
          .filter((v): v is Variable => v !== undefined)
      : [];

  const confoundVars = conditionOnIds
    .map((id) => variables.get(id))
    .filter((v): v is Variable => v !== undefined);

  const seen = new Set<string>();
  const conditionOn: Variable[] = [];
  for (const v of [...mediatorVars, ...confoundVars]) {
    if (!seen.has(v.id)) {
      seen.add(v.id);
      conditionOn.push(v);
    }
  }

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
> = (set, get) => ({
  estimands: [],
  models: [],
  highlightedEstimandId: null,
  highlightedModelId: null,
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

    const estimandId = generateId('est');

    const estimand: Estimand = {
      id: estimandId,
      sourceId,
      targetId,
      kind,
      excludedMediators: excludedMediatorIds,
      paths,
      doNotation,
      plainEnglish,
      modelId: null, // no model yet — user creates it explicitly
    };

    let activePaths: string[][];
    if (kind === 'total') {
      activePaths = paths;
    } else {
      activePaths = paths.filter(
        (path) =>
          !path.some((nodeId) => excludedMediatorIds.includes(nodeId)),
      );
      if (activePaths.length === 0) {
        activePaths = [[sourceId, targetId]];
      }
    }

    set((state) => ({
      estimands: [...state.estimands, estimand],
      highlightedEstimandId: estimandId,
      highlightedPaths: activePaths,
    }));
  },

  generateModelForEstimand: (estimandId, variables, edges) => {
    const state = get();
    const estimand = state.estimands.find((e) => e.id === estimandId);
    if (!estimand) return;

    const source = variables.get(estimand.sourceId);
    const target = variables.get(estimand.targetId);
    if (!source || !target) return;

    // Run backdoor criterion
    const unobservedIds = new Set<string>();
    variables.forEach((v) => {
      if (v.variableType === 'unobserved') unobservedIds.add(v.id);
    });
    const backdoorResult = findBackdoorAdjustmentSet(
      edges,
      estimand.sourceId,
      estimand.targetId,
      estimand.excludedMediators,
      unobservedIds,
    );

    const conditionedOn = backdoorResult.adjustmentSet.map(
      (a) => a.variableId,
    );

    const interaction = false;
    const modelFields = computeModelFields(
      source,
      target,
      estimand.kind,
      conditionedOn,
      estimand.excludedMediators,
      interaction,
      variables,
    );

    const modelId = generateId('mod');

    const model: StatisticalModel = {
      id: modelId,
      estimandId,
      sourceId: estimand.sourceId,
      targetId: estimand.targetId,
      kind: estimand.kind,
      adjustmentSet: backdoorResult.adjustmentSet.map((a) => ({
        variableId: a.variableId,
        reason: a.reason,
        explanation: a.explanation,
      })),
      badControls: backdoorResult.badControls.map((b) => ({
        variableId: b.variableId,
        type: b.type,
        explanation: b.explanation,
      })),
      identifiable: backdoorResult.identifiable,
      conditionedOn,
      excludedMediators: estimand.excludedMediators,
      interaction,
      ...modelFields,
    };

    // Link estimand to model
    set((state) => ({
      models: [...state.models, model],
      estimands: state.estimands.map((e) =>
        e.id === estimandId ? { ...e, modelId } : e,
      ),
    }));
  },

  removeEstimand: (id) => {
    set((state) => {
      const estimand = state.estimands.find((e) => e.id === id);
      const modelId = estimand?.modelId;
      return {
        estimands: state.estimands.filter((e) => e.id !== id),
        models: modelId
          ? state.models.filter((m) => m.id !== modelId)
          : state.models,
        highlightedEstimandId:
          state.highlightedEstimandId === id
            ? null
            : state.highlightedEstimandId,
        highlightedPaths:
          state.highlightedEstimandId === id ? null : state.highlightedPaths,
      };
    });
  },

  removeModel: (modelId) => {
    set((state) => ({
      models: state.models.filter((m) => m.id !== modelId),
      estimands: state.estimands.map((e) =>
        e.modelId === modelId ? { ...e, modelId: null } : e,
      ),
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
        activePaths = estimand.paths.filter(
          (path) =>
            !path.some((nodeId) =>
              estimand.excludedMediators.includes(nodeId),
            ),
        );
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

  setHighlightedModel: (id) => {
    set(() => ({
      highlightedModelId: id,
    }));
  },

  removeEstimandsForVariable: (variableId) => {
    set((state) => {
      const removedEstimandIds = new Set(
        state.estimands
          .filter(
            (e) => e.sourceId === variableId || e.targetId === variableId,
          )
          .map((e) => e.id),
      );
      const removedModelIds = new Set(
        state.estimands
          .filter((e) => removedEstimandIds.has(e.id) && e.modelId)
          .map((e) => e.modelId!),
      );
      return {
        estimands: state.estimands.filter(
          (e) => !removedEstimandIds.has(e.id),
        ),
        models: state.models.filter((m) => !removedModelIds.has(m.id)),
      };
    });
  },

  toggleModelInteraction: (modelId, variables) => {
    set((state) => {
      const models = state.models.map((m) => {
        if (m.id !== modelId) return m;

        const newInteraction = !m.interaction;
        const source = variables.get(m.sourceId);
        const target = variables.get(m.targetId);
        if (!source || !target) return m;

        const modelFields = computeModelFields(
          source,
          target,
          m.kind,
          m.conditionedOn,
          m.excludedMediators,
          newInteraction,
          variables,
        );

        return {
          ...m,
          interaction: newInteraction,
          ...modelFields,
        };
      });

      return { models };
    });
  },
});
