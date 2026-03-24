import type { Variable, VariableType, EstimandKind } from '../types/dag';

/**
 * Determines the brms family based on the outcome variable type.
 */
function brmsFamily(outcomeType: VariableType): string {
  switch (outcomeType) {
    case 'binary':
      return 'bernoulli()';
    case 'count':
      return 'poisson()';
    case 'categorical':
      return 'categorical()';
    default:
      return 'gaussian()';
  }
}

/**
 * Cleans a variable name for use in R code.
 * Converts to lowercase, replaces spaces/special chars with underscores.
 */
function rName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/gi, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Result of model generation.
 */
export interface GeneratedModel {
  /** Math notation lines (each line is a separate equation) */
  mathLines: string[];
  /** brms R code string */
  brmsCode: string;
  /** The brms family used */
  family: string;
  /** Variables that are conditioned on (predictors in the model) */
  predictors: Variable[];
}

/**
 * Generate a statistical model (math notation + brms code) from
 * an estimand specification.
 *
 * @param outcome - The target/outcome variable
 * @param treatment - The source/treatment variable
 * @param kind - 'total' or 'direct'
 * @param conditionOn - Variables to condition on (mediators for direct effects)
 * @param interaction - Whether to allow slopes to vary by treatment
 */
export function generateModel(
  outcome: Variable,
  treatment: Variable,
  kind: EstimandKind,
  conditionOn: Variable[],
  interaction: boolean,
): GeneratedModel {
  const family = brmsFamily(outcome.variableType);
  const outcomeR = rName(outcome.name);
  const treatmentR = rName(treatment.name);

  // Build predictor list
  const predictors = [treatment, ...conditionOn];

  // Determine if treatment is categorical-like
  const treatmentIsCategorical =
    treatment.variableType === 'categorical' ||
    treatment.variableType === 'binary';

  // ── Math notation ──

  const mathLines: string[] = [];
  const outcomeShort = outcome.shorthand;
  const treatmentShort = treatment.shorthand;

  // Line 1: likelihood
  const likelihoodDist = mathDistribution(outcome.variableType);
  mathLines.push(`${outcomeShort}\u1d62 ~ ${likelihoodDist}`);

  // Line 2: linear model
  const muParts: string[] = [];

  if (treatmentIsCategorical) {
    muParts.push(`\u03b1[${treatmentShort}\u1d62]`);
  } else {
    muParts.push('\u03b1');
    muParts.push(`\u03b2\u2081 \u00b7 ${treatmentShort}\u1d62`);
  }

  // Add conditioned variables
  conditionOn.forEach((v, idx) => {
    const vShort = v.shorthand;
    const betaIdx = idx + (treatmentIsCategorical ? 1 : 2);
    const betaSubscript = subscriptNumber(betaIdx);

    if (v.variableType === 'categorical' || v.variableType === 'binary') {
      muParts.push(`\u03b3[${vShort}\u1d62]`);
    } else if (interaction) {
      if (treatmentIsCategorical) {
        // Categorical treatment: slope subscripted by treatment
        muParts.push(
          `\u03b2${betaSubscript}[${treatmentShort}\u1d62] \u00b7 ${vShort}\u1d62`,
        );
      } else {
        // Continuous treatment: interaction term
        muParts.push(
          `\u03b2${betaSubscript} \u00b7 ${treatmentShort}\u1d62 \u00b7 ${vShort}\u1d62`,
        );
      }
    } else {
      muParts.push(`\u03b2${betaSubscript} \u00b7 ${vShort}\u1d62`);
    }
  });

  mathLines.push(`\u03bc\u1d62 = ${muParts.join(' + ')}`);

  // ── brms code ──

  const formulaParts: string[] = [];

  // Treatment term
  formulaParts.push(treatmentR);

  // Conditioned variables
  for (const v of conditionOn) {
    const vR = rName(v.name);
    if (interaction) {
      // Interaction: treatment:variable (works for both categorical and continuous)
      formulaParts.push(`${treatmentR}:${vR}`);
    } else {
      formulaParts.push(vR);
    }
  }

  const formula = `${outcomeR} ~ ${formulaParts.join(' + ')}`;

  const brmsCode = [
    `brm(${formula},`,
    `    data = d,`,
    `    family = ${family})`,
  ].join('\n');

  return {
    mathLines,
    brmsCode,
    family,
    predictors,
  };
}

/**
 * Returns a math distribution string based on variable type.
 */
function mathDistribution(type: VariableType): string {
  switch (type) {
    case 'binary':
      return 'Bernoulli(\u03c0\u1d62)';
    case 'count':
      return 'Poisson(\u03bb\u1d62)';
    case 'categorical':
      return 'Categorical(\u03c0\u1d62)';
    default:
      return 'Normal(\u03bc\u1d62, \u03c3)';
  }
}

/**
 * Converts a number to Unicode subscript characters.
 */
function subscriptNumber(n: number): string {
  const subscripts =
    '\u2080\u2081\u2082\u2083\u2084\u2085\u2086\u2087\u2088\u2089';
  return String(n)
    .split('')
    .map((d) => subscripts[parseInt(d)] || d)
    .join('');
}
