/**
 * Core types for the Prior Wizard.
 * Mirrors Estiplan's VariableType for easy integration later.
 */

import { logit, logistic } from './distributions';

export type OutcomeFamily =
  | 'gaussian'
  | 'bernoulli'
  | 'poisson'
  | 'lognormal'
  | 'beta'
  | 'cumulative'
  | 'categorical';

export type LinkScale = 'identity' | 'logit' | 'log';

export interface FamilyInfo {
  family: OutcomeFamily;
  label: string;
  description: string;
  link: LinkScale;
  /** brms family call */
  brmsFamily: string;
  /** What the intercept means on this scale */
  interceptMeaning: string;
  /** What a slope means on this scale */
  slopeMeaning: string;
  /** Whether this family has a dispersion parameter */
  hasDispersion: boolean;
  /** Name of dispersion parameter */
  dispersionParam?: string;
  /** Label for dispersion parameter */
  dispersionLabel?: string;
}

export const FAMILIES: Record<OutcomeFamily, FamilyInfo> = {
  gaussian: {
    family: 'gaussian',
    label: 'Gaussian',
    description: 'Changes by addition/subtraction. Effects are absolute: "+5 units." Temperature, elevation, test scores.',
    link: 'identity',
    brmsFamily: 'gaussian()',
    interceptMeaning: 'The expected value of the outcome when all predictors are at their reference/mean.',
    slopeMeaning: 'A one-unit increase in the predictor changes the outcome by this many units.',
    hasDispersion: true,
    dispersionParam: 'sigma',
    dispersionLabel: '\u03c3 (residual SD)',
  },
  lognormal: {
    family: 'lognormal',
    label: 'Log-Normal',
    description: 'Changes by percentage/ratio. Effects are multiplicative: "+20%." Income, area, distance, duration, body mass.',
    link: 'log',
    brmsFamily: 'lognormal()',
    interceptMeaning: 'The log of the expected value when all predictors are at their reference/mean.',
    slopeMeaning: 'A one-unit increase in the predictor changes the log-value by this much. A log-change of 1 means multiplying by e \u2248 2.72.',
    hasDispersion: true,
    dispersionParam: 'sigma',
    dispersionLabel: '\u03c3 (log-scale SD)',
  },
  beta: {
    family: 'beta',
    label: 'Beta',
    description: 'Bounded between 0 and 1. Percentages, proportions, rates, probabilities.',
    link: 'logit',
    brmsFamily: 'Beta()',
    interceptMeaning: 'The log-odds of the baseline proportion. Log-odds of 0 = 50%.',
    slopeMeaning: 'A one-unit increase in the predictor changes the log-odds of the proportion by this much.',
    hasDispersion: true,
    dispersionParam: 'phi',
    dispersionLabel: '\u03c6 (precision)',
  },
  bernoulli: {
    family: 'bernoulli',
    label: 'Binary (Bernoulli)',
    description: 'Two outcomes. Survival/death, presence/absence, yes/no, success/failure.',
    link: 'logit',
    brmsFamily: 'bernoulli()',
    interceptMeaning: 'The log-odds of the outcome being 1 when all predictors are at their reference/mean. Log-odds of 0 = 50% probability.',
    slopeMeaning: 'A one-unit increase in the predictor changes the log-odds by this much. This is NOT a probability change \u2014 the same log-odds shift has different probability effects depending on where you start.',
    hasDispersion: false,
  },
  poisson: {
    family: 'poisson',
    label: 'Poisson',
    description: 'Non-negative integers. Number of events, artifacts found, species observed, offspring.',
    link: 'log',
    brmsFamily: 'poisson()',
    interceptMeaning: 'The log of the expected count when all predictors are at their reference/mean. log(count) = 0 means count = 1.',
    slopeMeaning: 'A one-unit increase in the predictor changes the log-count by this much. A log-change of 1 means multiplying the count by e \u2248 2.72.',
    hasDispersion: false,
  },
  cumulative: {
    family: 'cumulative',
    label: 'Ordinal (Cumulative)',
    description: 'Ordered categories. Likert scales, severity levels, rankings, letter grades.',
    link: 'logit',
    brmsFamily: 'cumulative("logit")',
    interceptMeaning: 'The log-odds of the cumulative probability at each threshold. These are the cut-points between ordinal categories.',
    slopeMeaning: 'A one-unit increase in the predictor shifts all cumulative log-odds by this much, pushing the response toward higher or lower categories.',
    hasDispersion: false,
  },
  categorical: {
    family: 'categorical',
    label: 'Categorical',
    description: 'Unordered categories. Species identity, land use type, ceramic tradition, cause of death.',
    link: 'logit',
    brmsFamily: 'categorical()',
    interceptMeaning: 'The log-odds of each category relative to the reference category, when all predictors are at their reference/mean.',
    slopeMeaning: 'A one-unit increase in the predictor changes the log-odds of each category (relative to the reference) by this much.',
    hasDispersion: false,
  },
};

/** Grouped family categories for the picker UI */
export interface FamilyGroup {
  label: string;
  description: string;
  /** Guidance text shown when the group is expanded */
  guidance?: string;
  families: { family: OutcomeFamily; label: string; description: string }[];
}

export const FAMILY_GROUPS: FamilyGroup[] = [
  {
    label: 'Continuous',
    description: 'Outcome is a number measured on a continuous scale',
    /** Guidance shown when this group is expanded */
    guidance: 'Gaussian vs. Log-Normal: ask yourself how effects work. If "adding X causes Y to go up by 5 units" makes sense regardless of where Y starts, that\'s additive (Gaussian). If "adding X causes Y to increase by 20%" makes more sense \u2014 where bigger values of Y change by more \u2014 that\'s multiplicative (Log-Normal). A useful secondary check: if the measurement can\'t in principle go below zero, it\'s likely multiplicative.',
    families: [
      {
        family: 'gaussian',
        label: 'Gaussian (additive effects)',
        description: 'Effects are absolute amounts: "adding 100mm of rain adds 1.5m to elevation." The same change means the same thing regardless of starting point. Temperature, elevation, profit/loss, test scores.',
      },
      {
        family: 'lognormal',
        label: 'Log-Normal (multiplicative effects)',
        description: 'Effects are proportional: "adding one occupant increases floor area by 20%." Bigger things vary more, and the distribution is right-skewed. Income, area, body mass, duration, distance.',
      },
      {
        family: 'beta',
        label: 'Proportion (bounded 0 to 1)',
        description: 'Inherently bounded between 0 and 1 by definition. Percent cover, survival rate, fraction recovered, relative humidity.',
      },
    ],
  },
  {
    label: 'Discrete',
    description: 'Outcome is a category or a count of events',
    families: [
      {
        family: 'bernoulli',
        label: 'Binary (exactly two outcomes)',
        description: 'The thing either happened or it didn\u2019t. Survived/died, present/absent, adopted/not, infected/healthy.',
      },
      {
        family: 'categorical',
        label: 'Categorical (unordered groups)',
        description: 'Multiple categories with no natural ranking. Species identity, land use type, ceramic tradition, cause of death.',
      },
      {
        family: 'cumulative',
        label: 'Ordinal (ordered categories)',
        description: 'Ranked but not measured on a true scale. Likert scales, severity (mild/moderate/severe), condition ratings, letter grades.',
      },
      {
        family: 'poisson',
        label: 'Count (number of events)',
        description: 'Non-negative whole numbers. Artifacts per site, offspring count, floods per century, species observed in a plot.',
      },
    ],
  },
];

/** Description of a variable in natural units */
export interface VariableDescription {
  name: string;
  mean: number;
  plausibleMin: number;
  plausibleMax: number;
}

/** Data treatment approach */
export type DataScale = 'natural' | 'centered' | 'standardized';

/** State for the full wizard */
export interface WizardState {
  /** Step 1: outcome family */
  family: OutcomeFamily | null;
  /** Step 2: describe your variables */
  outcome: VariableDescription;
  treatment: VariableDescription;
  /** Expected effect — identity link: "a [changeInTreatment] change causes [changeInOutcome] change" */
  effectChangeInTreatment: number;
  effectChangeInOutcome: number;
  /** Confidence bounds on outcome change (identity): plausible low and high */
  effectOutcomeLo: number;
  effectOutcomeHi: number;
  /** Expected effect — logit/log link: outcome after the treatment change (probability or count) */
  effectOutcomeAfter: number;
  /** Confidence bounds on outcome-after (logit/log): plausible low and high */
  effectAfterLo: number;
  effectAfterHi: number;
  /** Whether the user has viewed the standard priors step */
  standardPriorsViewed: boolean;
  /** Whether the user has confirmed their variable descriptions */
  variablesDescribed: boolean;
  /** Step 4: which scale the user wants to proceed with */
  chosenScale: DataScale | null;
  /** User-set intercept SD for the chosen scale (from interactive inputs) */
  chosenInterceptSD: number | null;
  /** Step 4: dispersion */
  dispersionRate: number;
}

/** Derived SD from plausible range (range / 4 ≈ 95% coverage) */
export function estimateSD(desc: VariableDescription): number {
  const range = desc.plausibleMax - desc.plausibleMin;
  return range > 0 ? range / 4 : 1;
}

/** Compute priors on all three scales from user's natural-unit knowledge */
export interface ScaledPriors {
  interceptMean: number;
  interceptSD: number;
  slopeMean: number;
  slopeSD: number;
  label: string;
  interceptExplanation: string;
  slopeExplanation: string;
}

/** Clamp a value between lo and hi */
function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function computeScaledPriors(
  state: WizardState,
): Record<DataScale, ScaledPriors> {
  const f = (n: number, d = 2) => Number(n.toFixed(d)).toString();
  const link = state.family ? FAMILIES[state.family].link : 'identity';
  const outSD = estimateSD(state.outcome);
  const txSD = estimateSD(state.treatment);
  const outName = state.outcome.name || 'outcome';
  const txName = state.treatment.name || 'treatment';
  const txMean = state.treatment.mean;

  // --- Compute intercept & slope on the link scale ---
  let intMean: number;
  let intSD: number;
  let slopeMean: number;
  let slopeSD: number;

  const isThresholdModel = state.family === 'cumulative' || state.family === 'categorical';

  // Helper: compute slopeSD from user's confidence bounds
  // slopeLo and slopeHi are the slope at the user's lo/hi outcome values
  // SD = (slopeHi - slopeLo) / 4 covers ~95% of belief
  function userSlopeSD(slopeAtLo: number, slopeAtHi: number, fallback: number): number {
    if (slopeAtHi > slopeAtLo) return (slopeAtHi - slopeAtLo) / 4;
    return fallback;
  }

  if (link === 'logit' && isThresholdModel) {
    // Ordinal/Categorical: fixed defaults for threshold intercepts,
    // slope derived from effect at a 50/50 boundary
    intMean = 0;
    intSD = 1.5;

    const afterP = clamp(state.effectOutcomeAfter || 0.5, 0.001, 0.999);
    slopeMean = state.effectChangeInTreatment !== 0
      ? (logit(afterP) - logit(0.5)) / state.effectChangeInTreatment
      : 0;
    // Use user's confidence bounds
    const afterLo = clamp(state.effectAfterLo || afterP, 0.001, 0.999);
    const afterHi = clamp(state.effectAfterHi || afterP, 0.001, 0.999);
    const slopeAtLo = state.effectChangeInTreatment !== 0
      ? (logit(afterLo) - logit(0.5)) / state.effectChangeInTreatment : 0;
    const slopeAtHi = state.effectChangeInTreatment !== 0
      ? (logit(afterHi) - logit(0.5)) / state.effectChangeInTreatment : 0;
    slopeSD = userSlopeSD(slopeAtLo, slopeAtHi, Math.max(Math.abs(slopeMean) * 0.5, 0.25));

  } else if (link === 'logit') {
    // Binary/Beta: user provides probabilities/proportions (0–1)
    const baseP = clamp(state.outcome.mean, 0.001, 0.999);
    const minP = clamp(state.outcome.plausibleMin, 0.001, 0.999);
    const maxP = clamp(state.outcome.plausibleMax, 0.001, 0.999);
    const afterP = clamp(state.effectOutcomeAfter || baseP, 0.001, 0.999);

    intMean = logit(baseP);
    intSD = maxP > minP ? Math.max((logit(maxP) - logit(minP)) / 4, 0.25) : 1.5;

    slopeMean = state.effectChangeInTreatment !== 0
      ? (logit(afterP) - logit(baseP)) / state.effectChangeInTreatment
      : 0;
    // Use user's confidence bounds
    const afterLo = clamp(state.effectAfterLo || afterP, 0.001, 0.999);
    const afterHi = clamp(state.effectAfterHi || afterP, 0.001, 0.999);
    const slopeAtLo = state.effectChangeInTreatment !== 0
      ? (logit(afterLo) - logit(baseP)) / state.effectChangeInTreatment : 0;
    const slopeAtHi = state.effectChangeInTreatment !== 0
      ? (logit(afterHi) - logit(baseP)) / state.effectChangeInTreatment : 0;
    slopeSD = userSlopeSD(slopeAtLo, slopeAtHi, Math.max(Math.abs(slopeMean) * 0.5, 0.1));

  } else if (link === 'log') {
    // User provides positive values (counts or continuous)
    const baseV = Math.max(state.outcome.mean, 0.01);
    const minV = Math.max(state.outcome.plausibleMin, 0.01);
    const maxV = Math.max(state.outcome.plausibleMax, 0.01);
    const afterV = Math.max(state.effectOutcomeAfter || baseV, 0.01);

    intMean = Math.log(baseV);
    intSD = maxV > minV ? Math.max((Math.log(maxV) - Math.log(minV)) / 4, 0.25) : 1;

    slopeMean = state.effectChangeInTreatment !== 0
      ? (Math.log(afterV) - Math.log(baseV)) / state.effectChangeInTreatment
      : 0;
    // Use user's confidence bounds
    const afterLo = Math.max(state.effectAfterLo || afterV, 0.01);
    const afterHi = Math.max(state.effectAfterHi || afterV, 0.01);
    const slopeAtLo = state.effectChangeInTreatment !== 0
      ? (Math.log(afterLo) - Math.log(baseV)) / state.effectChangeInTreatment : 0;
    const slopeAtHi = state.effectChangeInTreatment !== 0
      ? (Math.log(afterHi) - Math.log(baseV)) / state.effectChangeInTreatment : 0;
    slopeSD = userSlopeSD(slopeAtLo, slopeAtHi, Math.max(Math.abs(slopeMean) * 0.5, 0.1));

  } else {
    // Identity link (gaussian)
    intMean = state.outcome.mean;
    intSD = outSD;
    slopeMean = state.effectChangeInTreatment !== 0
      ? state.effectChangeInOutcome / state.effectChangeInTreatment
      : 0;
    // Use user's confidence bounds: slope range = outcome range / treatment change
    const outLo = state.effectOutcomeLo;
    const outHi = state.effectOutcomeHi;
    const slopeAtLo = state.effectChangeInTreatment !== 0 ? outLo / state.effectChangeInTreatment : 0;
    const slopeAtHi = state.effectChangeInTreatment !== 0 ? outHi / state.effectChangeInTreatment : 0;
    slopeSD = userSlopeSD(slopeAtLo, slopeAtHi, Math.max(Math.abs(slopeMean) * 0.5, outSD * 0.1));
  }

  // --- Centered: intercept = linear predictor at mean(treatment) ---
  // For identity: ≈ outcome mean. For logit/log: same baseline (user's value
  // represents "typical conditions", which is what centered gives you).
  // Same SD as natural — user can tighten if they're more confident at center.
  const centIntMean = link === 'identity' ? state.outcome.mean : intMean;
  const centIntSD = intSD;

  // --- Standardized: predictors centered + scaled by SD ---
  // For identity: both x and y standardized → β_std = β × (SD_x / SD_y)
  // For logit/log: only x standardized (outcome stays on link scale) → β_std = β × SD_x
  const stdSlopeMean = link === 'identity'
    ? (txSD > 0 && outSD > 0 ? slopeMean * (txSD / outSD) : 0)
    : slopeMean * txSD;
  const stdSlopeSD = link === 'identity'
    ? (txSD > 0 && outSD > 0 ? slopeSD * (txSD / outSD) : 0.5)
    : Math.max(slopeSD * txSD, 0.1);
  const stdIntMean = link === 'identity' ? 0 : centIntMean;
  const stdIntSD = link === 'identity' ? 0.5 : centIntSD;

  // --- Build explanations per link type ---
  if (link === 'logit' && isThresholdModel) {
    const modelType = state.family === 'cumulative' ? 'ordinal' : 'categorical';
    const thresholdNote = state.family === 'cumulative'
      ? 'These are the cut-points between adjacent categories in the proportional-odds model.'
      : 'These are the log-odds of each category relative to the reference category.';
    const slopeNote = state.family === 'cumulative'
      ? `shifts all threshold log-odds by this amount, pushing responses toward higher or lower categories`
      : `changes the log-odds of each non-reference category by this amount`;

    return {
      natural: {
        interceptMean: intMean, interceptSD: intSD,
        slopeMean, slopeSD,
        label: `Natural units (${modelType}, logit scale)`,
        interceptExplanation:
          `Normal(0, 1.5) is a standard weakly informative prior for ${modelType} thresholds. ` +
          `${thresholdNote} ` +
          `This prior assigns roughly equal probability to all categories before seeing data.`,
        slopeExplanation:
          `Each unit increase in ${txName} ${slopeNote}. ` +
          `Because logit is nonlinear, the same shift produces different probability changes at different starting points.`,
      },
      centered: {
        interceptMean: centIntMean, interceptSD: centIntSD,
        slopeMean, slopeSD,
        label: `Centered (${modelType}, logit scale)`,
        interceptExplanation:
          `Same threshold priors \u2014 centering predictors doesn\u2019t fundamentally change the thresholds. ` +
          `The exact positions will be learned from your data.`,
        slopeExplanation:
          `Same as natural \u2014 centering shifts the thresholds but doesn\u2019t change the slope. ` +
          `Each unit of ${txName} still ${slopeNote}.`,
      },
      standardized: {
        interceptMean: stdIntMean, interceptSD: stdIntSD,
        slopeMean: stdSlopeMean, slopeSD: stdSlopeSD,
        label: `Standardized (${modelType}, logit scale)`,
        interceptExplanation:
          `Same threshold priors. For ${modelType} models, standardizing predictors doesn\u2019t ` +
          `change the threshold structure \u2014 only the slope rescales.`,
        slopeExplanation:
          `A 1-SD change in ${txName} ${slopeNote}. ` +
          `Conversion: \u03b2_std = \u03b2_natural \u00d7 SD_treatment. ` +
          `Comparable across predictors with different units.`,
      },
    };
  }

  if (link === 'logit') {
    const decBase = clamp(state.outcome.mean, 0.001, 0.999).toFixed(2);
    const natPLo = logistic(intMean - 2 * intSD);
    const natPHi = logistic(intMean + 2 * intSD);
    const centPLo = logistic(centIntMean - 2 * centIntSD);
    const centPHi = logistic(centIntMean + 2 * centIntSD);
    const stdPLo = logistic(stdIntMean - 2 * stdIntSD);
    const stdPHi = logistic(stdIntMean + 2 * stdIntSD);
    return {
      natural: {
        interceptMean: intMean, interceptSD: intSD,
        slopeMean, slopeSD,
        label: 'Natural units (logit scale)',
        interceptExplanation:
          `When ${txName} is 0, I expect the probability of ${outName} to be between ${f(natPLo, 2)} and ${f(natPHi, 2)}. ` +
          `Your baseline of ${decBase} translates to logit(${decBase}) \u2248 ${f(intMean)} on this scale. ` +
          `If ${txName} = 0 doesn\u2019t make sense, this intercept is an extrapolation.`,
        slopeExplanation:
          `Each unit increase in ${txName} changes the log-odds of ${outName} by this amount. ` +
          `Because logit is nonlinear, the same log-odds shift produces different probability changes ` +
          `depending on where you start \u2014 shifts near 50% are larger than shifts near 0% or 100%.`,
      },
      centered: {
        interceptMean: centIntMean, interceptSD: centIntSD,
        slopeMean, slopeSD,
        label: 'Centered (logit scale)',
        interceptExplanation:
          `When ${txName} is at its average (${f(txMean)}), I expect the probability of ${outName} to be between ${f(centPLo, 2)} and ${f(centPHi, 2)}. ` +
          `This IS your baseline probability (${decBase}) on the logit scale \u2014 much more interpretable ` +
          `than the natural intercept.`,
        slopeExplanation:
          `Same as natural \u2014 centering shifts the intercept but doesn\u2019t change the slope. ` +
          `Each unit of ${txName} still changes log-odds by the same amount.`,
      },
      standardized: {
        interceptMean: stdIntMean, interceptSD: stdIntSD,
        slopeMean: stdSlopeMean, slopeSD: stdSlopeSD,
        label: 'Standardized predictors (logit scale)',
        interceptExplanation:
          `When ${txName} is at its average, I expect the probability of ${outName} to be between ${f(stdPLo, 2)} and ${f(stdPHi, 2)}. ` +
          `For logit models, standardizing predictors doesn\u2019t zero out the intercept \u2014 ` +
          `the outcome is still on the logit scale.`,
        slopeExplanation:
          `A 1-SD change in ${txName} changes the log-odds of ${outName} by this amount. ` +
          `Conversion: \u03b2_std = \u03b2_natural \u00d7 SD_treatment. ` +
          `This makes effects comparable across predictors, even though the outcome stays on the logit scale.`,
      },
    };
  }

  if (link === 'log') {
    const baseV = Math.max(state.outcome.mean, 0.01);
    const natVLo = Math.exp(intMean - 2 * intSD);
    const natVHi = Math.exp(intMean + 2 * intSD);
    const centVLo = Math.exp(centIntMean - 2 * centIntSD);
    const centVHi = Math.exp(centIntMean + 2 * centIntSD);
    const stdVLo = Math.exp(stdIntMean - 2 * stdIntSD);
    const stdVHi = Math.exp(stdIntMean + 2 * stdIntSD);
    return {
      natural: {
        interceptMean: intMean, interceptSD: intSD,
        slopeMean, slopeSD,
        label: 'Natural units (log scale)',
        interceptExplanation:
          `When ${txName} is 0, I expect ${outName} to be between ${f(natVLo)} and ${f(natVHi)}. ` +
          `Your baseline of ${baseV} translates to log(${baseV}) \u2248 ${f(intMean)}. ` +
          `If ${txName} = 0 doesn\u2019t make sense, this is an extrapolation.`,
        slopeExplanation:
          `Each unit increase in ${txName} changes the log of ${outName} by this amount. ` +
          `On the original scale, this is a multiplicative effect: ` +
          `a log-slope of 0.1 means multiplying ${outName} by e^(0.1) \u2248 1.11 per unit.`,
      },
      centered: {
        interceptMean: centIntMean, interceptSD: centIntSD,
        slopeMean, slopeSD,
        label: 'Centered (log scale)',
        interceptExplanation:
          `When ${txName} is at its average (${f(txMean)}), I expect ${outName} to be between ${f(centVLo)} and ${f(centVHi)}. ` +
          `This is your baseline value on the log scale \u2014 much more interpretable than the natural intercept.`,
        slopeExplanation:
          `Same as natural \u2014 centering shifts the intercept but doesn\u2019t change the slope. ` +
          `Each unit of ${txName} still has the same multiplicative effect on ${outName}.`,
      },
      standardized: {
        interceptMean: stdIntMean, interceptSD: stdIntSD,
        slopeMean: stdSlopeMean, slopeSD: stdSlopeSD,
        label: 'Standardized predictors (log scale)',
        interceptExplanation:
          `When ${txName} is at its average, I expect ${outName} to be between ${f(stdVLo)} and ${f(stdVHi)}. ` +
          `For log-link models, standardizing predictors doesn\u2019t zero out the intercept \u2014 ` +
          `the outcome is still on the log scale.`,
        slopeExplanation:
          `A 1-SD change in ${txName} changes log(${outName}) by this amount. ` +
          `Conversion: \u03b2_std = \u03b2_natural \u00d7 SD_treatment. ` +
          `Comparable across predictors, even though the outcome stays on the log scale.`,
      },
    };
  }

  // Identity link (gaussian)
  const natLo = intMean - 2 * intSD;
  const natHi = intMean + 2 * intSD;
  const centLo = centIntMean - 2 * centIntSD;
  const centHi = centIntMean + 2 * centIntSD;
  return {
    natural: {
      interceptMean: intMean, interceptSD: intSD,
      slopeMean, slopeSD,
      label: 'Natural units',
      interceptExplanation:
        `When ${txName} is 0, I expect ${outName} to be between ${f(natLo)} and ${f(natHi)}. ` +
        `If ${txName} = 0 doesn\u2019t make physical sense (e.g., zero rainfall), ` +
        `this intercept is an extrapolation \u2014 the number is just an anchor for the line, not a real prediction.`,
      slopeExplanation:
        `Each additional unit of ${txName} changes ${outName} by this amount. ` +
        `Your 95% prior interval says you\u2019d be surprised if the true effect were outside this range.`,
    },
    centered: {
      interceptMean: centIntMean, interceptSD: centIntSD,
      slopeMean, slopeSD,
      label: 'Centered (mean subtracted)',
      interceptExplanation:
        `When ${txName} is at its average (${f(txMean)}), I expect ${outName} to be between ${f(centLo)} and ${f(centHi)}. ` +
        `By subtracting the mean, the intercept becomes the predicted value at a typical ${txName} level \u2014 ` +
        `almost always more interpretable than the natural-unit intercept.`,
      slopeExplanation:
        `Same slope as natural units \u2014 centering shifts the intercept but doesn\u2019t change how ` +
        `${txName} relates to ${outName}. A 1-unit increase still means the same thing.`,
    },
    standardized: {
      interceptMean: stdIntMean, interceptSD: stdIntSD,
      slopeMean: stdSlopeMean, slopeSD: stdSlopeSD,
      label: 'Standardized (centered + scaled by SD)',
      interceptExplanation:
        `When ${txName} is at its average, I expect ${outName} to be within 1 standard deviation of its mean. ` +
        `After standardizing, the mean is 0 by construction. Normal(0, 0.5) means 95% of prior mass falls ` +
        `between \u22121 and +1 SD \u2014 this is why generic priors work: ` +
        `they\u2019re always on a comparable scale regardless of your original units.`,
      slopeExplanation:
        `Now in SD-for-SD terms: a 1-SD change in ${txName} changes ${outName} by this many SDs. ` +
        `This makes effects directly comparable across predictors with different units. ` +
        `The conversion from natural units: \u03b2_std = \u03b2_natural \u00d7 (SD_treatment / SD_outcome).`,
    },
  };
}

export const INITIAL_STATE: WizardState = {
  family: null,
  outcome: { name: '', mean: 0, plausibleMin: 0, plausibleMax: 0 },
  treatment: { name: '', mean: 0, plausibleMin: 0, plausibleMax: 0 },
  effectChangeInTreatment: 0,
  effectChangeInOutcome: 0,
  effectOutcomeLo: 0,
  effectOutcomeHi: 0,
  effectOutcomeAfter: 0,
  effectAfterLo: 0,
  effectAfterHi: 0,
  standardPriorsViewed: false,
  variablesDescribed: false,
  chosenScale: null,
  chosenInterceptSD: null,
  dispersionRate: 1,
};
