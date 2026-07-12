/**
 * Educational explanations for causal inference concepts.
 * Used in tooltips on tags, labels, and badges throughout the UI.
 *
 * Written to be accessible to someone learning causal inference
 * (e.g., a student watching McElreath's Statistical Rethinking).
 */

// ── Good control (adjustment set) reason tooltips ──

export const REASON_TOOLTIPS: Record<string, string> = {
  fork:
    'Fork (common cause): This variable causes both the treatment and the outcome. Without adjusting for it, you\'d see a spurious association. Think: "ice cream sales and drowning are correlated, but both are caused by hot weather."',

  'pipe-backdoor':
    'Pipe (on backdoor path): This variable sits on a non-causal path between treatment and outcome. Conditioning on it blocks that path so you can isolate the causal effect.',

  'opened-collider':
    'Collider fix: Conditioning on another variable accidentally opened a non-causal path (through a collider). This variable is needed to block that opened path.',
};

// ── Bad control warning tooltips ──

export const BAD_CONTROL_TOOLTIPS: Record<string, string> = {
  collider:
    'Collider (bad control): This variable is caused by two or more other variables. Conditioning on it creates a spurious association between its causes — among NBA players (conditioning on making the NBA), shorter players tend to be more skilled, because they had to be to make it. Height and skill look negatively related even though they\'re unrelated in the general population.',

  'mediator-total':
    'Mediator (bad control for total effect): This variable is on the causal path from treatment to outcome. Conditioning on it would block part of the effect you\'re trying to measure. Only condition on mediators when estimating a direct effect.',

  'post-treatment':
    'Post-treatment variable (bad control): This variable is caused by the treatment. Conditioning on it can introduce bias because it may block or distort the causal path you\'re trying to estimate.',

  'descendant-collider':
    'Descendant of a collider (bad control): This variable is caused by a collider. Conditioning on it partially opens the same non-causal path that conditioning on the collider itself would — a weaker but still biasing effect.',
};

// ── Identifiability tooltips ──

export const IDENTIFIABILITY_TOOLTIPS = {
  identifiable:
    'Identifiable means we can estimate the causal effect from observational data by conditioning on the right set of variables (the adjustment set). The backdoor criterion confirms there is a valid strategy.',

  notIdentifiable:
    'Not identifiable means there is no set of observed variables you can condition on to isolate the causal effect. This usually happens because of an unobserved confound — a common cause of both treatment and outcome that you can\'t measure or adjust for.',
};

// ── Precision covariate tooltip ──

export const PRECISION_TOOLTIP =
  'Precision covariate: a direct cause of the outcome with no causal connection to the treatment. It is NOT needed to identify the causal effect (it sits on no backdoor path), but conditioning on it soaks up outcome variance, so the same data give a tighter estimate. McElreath\'s example: wine judges — judge preferences are not a confound of wine origin, but adjusting for them sharpens the estimate of wine quality.';

// ── Direct-effect assumption tooltip ──

export const DIRECT_EFFECT_TOOLTIP =
  'Estimating a direct effect requires conditioning on the mediator — and that is only unbiased if the mediator and outcome share NO unmeasured common cause (ability, motivation, quality…). If one exists, the mediator is a collider on a hidden path: conditioning on it opens that path, which can mask a real direct effect or fabricate one. This assumption is about variables NOT drawn in your DAG, so it cannot be checked automatically — it has to be argued scientifically.';

// ── Sample selection tooltips ──

export const SELECTION_WARNING_TOOLTIPS: Record<string, string> = {
  'selection-collider':
    'Selection collider: the sample is conditioned on this variable by design, and it is a common effect of variables on a non-causal path. Selection opens that path — like studying only NBA players or only police stops. Because no observed variable blocks the opened path, the effect is not identifiable from this sample without stronger assumptions.',

  'selection-mediator':
    'Selection on a mediator: the sample is conditioned on a variable that transmits part of the causal effect. Selection blocks that part of the effect — survivorship bias. The total effect is not identifiable from this sample without stronger assumptions.',
};

// ── Table Two Fallacy tooltip ──

export const TABLE_TWO_TOOLTIP =
  'Table Two Fallacy: In a regression with multiple predictors, only the treatment coefficient estimates a causal effect (given correct adjustment). The coefficients on control variables do NOT have causal interpretations — they\'re there to block confounding, not to estimate their own effects. Reporting them as causal effects (as is common in "Table 2" of many papers) is a mistake.';

// ── Section label tooltips ──

export const SECTION_TOOLTIPS = {
  conditioningOn:
    'These are "good controls" — variables you should include in your model to block non-causal paths (backdoor paths) between treatment and outcome.',

  doNotConditionOn:
    'These are "bad controls" — variables you should NOT include in your model because conditioning on them would either open a non-causal path (collider) or block part of the causal effect (mediator).',

  backdoorAnalysis:
    'Backdoor analysis checks whether you can identify the causal effect by finding variables to condition on. It looks at all paths between treatment and outcome, classifies each as causal or non-causal, and finds which variables block the non-causal ones.',

  precision:
    'Optional precision covariates — direct causes of the outcome unrelated to the treatment. Including them does not change identification, but it soaks up outcome variance and tightens the causal estimate from the same data.',

  sampleSelection:
    'The sample was selected on these variables — only units with certain values made it into the data. Selection acts exactly like conditioning: on a collider it opens a non-causal path, on a mediator it blocks part of the causal effect. You cannot undo it by changing the model; it is a property of how the data were collected.',
};

// ── Shared label helpers ──

/** Short label for adjustment set reason tags */
export function reasonLabel(reason: string): string {
  switch (reason) {
    case 'fork': return 'fork';
    case 'pipe-backdoor': return 'pipe';
    case 'opened-collider': return 'collider fix';
    default: return reason;
  }
}

/** Short label for bad control type tags */
export function badControlLabel(type: string): string {
  switch (type) {
    case 'collider': return 'collider';
    case 'mediator-total': return 'mediator';
    case 'post-treatment': return 'post-tx';
    default: return type;
  }
}

// ── Estimand kind tooltips ──

export const ESTIMAND_KIND_TOOLTIPS = {
  total:
    'Total causal effect: The full effect of treatment on outcome, including all pathways — both direct effects and indirect effects through mediators.',

  direct:
    'Direct causal effect: The effect of treatment on outcome NOT transmitted through the specified mediator(s). Requires conditioning on the excluded mediators.',
};
