export type VariableType =
  | 'categorical'
  | 'continuous'
  | 'count'
  | 'binary'
  | 'ordinal'
  | 'proportion'
  | 'positive-continuous'
  | 'unobserved'
  | 'time-series'
  | 'time-cycle';

export const VARIABLE_TYPE_LABELS: Record<VariableType, string> = {
  categorical: 'Categorical',
  continuous: 'Continuous',
  count: 'Count',
  binary: 'Binary',
  ordinal: 'Ordinal',
  proportion: 'Proportion',
  'positive-continuous': 'Positive Continuous',
  unobserved: 'Unobserved / Latent',
  'time-series': 'Time (Series)',
  'time-cycle': 'Time (Cycle)',
};

/** Grouped variable types for the UI menu */
export interface VariableTypeGroup {
  label: string;
  types: { type: VariableType; label: string }[];
}

export const VARIABLE_TYPE_GROUPS: VariableTypeGroup[] = [
  {
    label: 'Continuous',
    types: [
      { type: 'continuous', label: 'Continuous' },
      { type: 'positive-continuous', label: 'Positive Continuous' },
      { type: 'proportion', label: 'Proportion (0\u20131)' },
    ],
  },
  {
    label: 'Discrete',
    types: [
      { type: 'categorical', label: 'Categorical' },
      { type: 'binary', label: 'Binary' },
      { type: 'ordinal', label: 'Ordinal' },
      { type: 'count', label: 'Count' },
    ],
  },
  {
    label: 'Time',
    types: [
      { type: 'time-series', label: 'Time (Series)' },
      { type: 'time-cycle', label: 'Time (Cycle)' },
    ],
  },
  {
    label: 'Special',
    types: [{ type: 'unobserved', label: 'Unobserved / Latent' }],
  },
];

export interface Variable {
  id: string;
  name: string;
  shorthand: string;
  variableType: VariableType;
}

export interface CausalEdgeData {
  annotation?: string;
  [key: string]: unknown;
}

export type EstimandKind = 'total' | 'direct';

/** Reason why a variable is in the adjustment set */
export interface AdjustmentEntry {
  variableId: string;
  reason: 'fork' | 'pipe-backdoor' | 'opened-collider';
  explanation: string;
}

/** Warning about a variable that should NOT be conditioned on */
export interface BadControlEntry {
  variableId: string;
  type: 'collider' | 'post-treatment' | 'mediator-total';
  explanation: string;
}

/**
 * Estimand — the causal question.
 * Contains the "what do we want to know?" part.
 */
export interface Estimand {
  id: string;
  sourceId: string;
  targetId: string;
  kind: EstimandKind;
  excludedMediators: string[];
  /** Directed causal paths from source to target */
  paths: string[][];
  /** do-calculus notation: p(Y|do(X)) */
  doNotation: string;
  /** Plain English description */
  plainEnglish: string;
  /** ID of the linked statistical model card, or null if not yet generated */
  modelId: string | null;
}

/**
 * StatisticalModel — the strategy for answering the causal question.
 * Contains the "how do we estimate it?" part.
 */
export interface StatisticalModel {
  id: string;
  /** The estimand this model answers */
  estimandId: string;
  sourceId: string;
  targetId: string;
  kind: EstimandKind;
  /** Variables conditioned on (good controls) with reasons */
  adjustmentSet: AdjustmentEntry[];
  /** Variables NOT to condition on (bad controls) with warnings */
  badControls: BadControlEntry[];
  /** Whether a valid adjustment set exists */
  identifiable: boolean;
  /** Variable IDs being conditioned on (derived from adjustmentSet) */
  conditionedOn: string[];
  /** Excluded mediator IDs (for direct effects) */
  excludedMediators: string[];
  /** Whether interaction terms are enabled */
  interaction: boolean;
  /** Generated math notation lines */
  mathLines: string[];
  /** Generated brms code */
  brmsCode: string;
  /** brms family string */
  brmsFamily: string;
  /** Prior specifications: parameter class → prior distribution string */
  priors: PriorSpec[];
}

export interface PriorSpec {
  /** brms prior class: "Intercept", "b", "sigma", "phi", etc. */
  class: string;
  /** Optional: specific coefficient name (e.g., "age_at_marriage") */
  coef: string;
  /** Prior distribution string (e.g., "normal(0, 1)") */
  prior: string;
  /** Human-readable label for the UI */
  label: string;
  /** Educational tooltip explaining why this prior was chosen */
  tooltip: string;
}
