export type VariableType =
  | 'categorical'
  | 'continuous'
  | 'count'
  | 'binary'
  | 'unobserved'
  | 'time-series'
  | 'time-cycle';

export const VARIABLE_TYPE_LABELS: Record<VariableType, string> = {
  categorical: 'Categorical',
  continuous: 'Continuous',
  count: 'Count',
  binary: 'Binary',
  unobserved: 'Unobserved / Latent',
  'time-series': 'Time (Series)',
  'time-cycle': 'Time (Cycle)',
};

export interface Variable {
  id: string;
  name: string;
  shorthand: string;
  variableType: VariableType;
}

export interface CausalEdgeData {
  annotation?: string;
}

export type EstimandKind = 'total' | 'direct';

export interface Estimand {
  id: string;
  sourceId: string;
  targetId: string;
  kind: EstimandKind;
  excludedMediators: string[];
  paths: string[][];
  doNotation: string;
  plainEnglish: string;
}
