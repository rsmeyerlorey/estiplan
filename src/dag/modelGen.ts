import type { Variable, VariableType, EstimandKind, PriorSpec } from '../types/dag';

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
    case 'ordinal':
      return 'cumulative("logit")';
    case 'proportion':
      return 'Beta()';
    case 'positive-continuous':
      return 'lognormal()';
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
  /** Default prior specifications */
  priors: PriorSpec[];
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
  _kind: EstimandKind,
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

  // ── Priors ──

  const priors = generateDefaultPriors(outcome.variableType, treatment, conditionOn, interaction);

  const priorLines = priors.map((p) => {
    const coefArg = p.coef ? `, coef = "${p.coef}"` : '';
    return `  set_prior("${p.prior}", class = "${p.class}"${coefArg})`;
  });

  const brmsCodeLines = [
    `brm(${formula},`,
    `    data = d,`,
    `    family = ${family},`,
  ];
  if (priorLines.length > 0) {
    brmsCodeLines.push(`    prior = c(`);
    priorLines.forEach((line, i) => {
      brmsCodeLines.push(line + (i < priorLines.length - 1 ? ',' : ''));
    });
    brmsCodeLines.push(`    ))`);
  } else {
    // Replace trailing comma on family line
    brmsCodeLines[brmsCodeLines.length - 1] = `    family = ${family})`;
  }

  const brmsCode = brmsCodeLines.join('\n');

  return {
    mathLines,
    brmsCode,
    family,
    predictors,
    priors,
  };
}

/**
 * Generate sensible default priors based on the outcome family.
 * Assumes centered and standardized predictors (McElreath's recommendation).
 */
function generateDefaultPriors(
  outcomeType: VariableType,
  treatment: Variable,
  conditionOn: Variable[],
  interaction: boolean,
): PriorSpec[] {
  const priors: PriorSpec[] = [];

  // Determine link scale for slope priors
  const usesLogitLink =
    outcomeType === 'binary' || outcomeType === 'ordinal';
  const usesLogLink =
    outcomeType === 'count' || outcomeType === 'positive-continuous';

  // Intercept prior
  if (usesLogitLink) {
    priors.push({
      class: 'Intercept',
      coef: '',
      prior: 'normal(0, 1.5)',
      label: '\u03b1 (intercept, logit scale)',
    });
  } else if (usesLogLink) {
    priors.push({
      class: 'Intercept',
      coef: '',
      prior: 'normal(0, 1)',
      label: '\u03b1 (intercept, log scale)',
    });
  } else {
    priors.push({
      class: 'Intercept',
      coef: '',
      prior: 'normal(0, 0.5)',
      label: '\u03b1 (intercept)',
    });
  }

  // Slope priors — one per predictor
  const slopePrior = usesLogitLink
    ? 'normal(0, 1)'
    : usesLogLink
      ? 'normal(0, 0.5)'
      : 'normal(0, 0.5)';

  const treatmentIsCategorical =
    treatment.variableType === 'categorical' || treatment.variableType === 'binary';

  if (!treatmentIsCategorical) {
    priors.push({
      class: 'b',
      coef: rName(treatment.name),
      prior: slopePrior,
      label: `\u03b2 ${treatment.shorthand} (treatment)`,
    });
  }

  for (const v of conditionOn) {
    const isCat = v.variableType === 'categorical' || v.variableType === 'binary';
    if (!isCat) {
      const coef = interaction
        ? `${rName(treatment.name)}:${rName(v.name)}`
        : rName(v.name);
      priors.push({
        class: 'b',
        coef,
        prior: slopePrior,
        label: `\u03b2 ${v.shorthand} (${interaction ? 'interaction' : 'adjustment'})`,
      });
    }
  }

  // Scale / dispersion parameter
  if (outcomeType === 'continuous' || outcomeType === 'time-series' || outcomeType === 'time-cycle') {
    priors.push({
      class: 'sigma',
      coef: '',
      prior: 'exponential(1)',
      label: '\u03c3 (residual SD)',
    });
  } else if (outcomeType === 'positive-continuous') {
    priors.push({
      class: 'sigma',
      coef: '',
      prior: 'exponential(1)',
      label: '\u03c3 (log-scale SD)',
    });
  } else if (outcomeType === 'proportion') {
    priors.push({
      class: 'phi',
      coef: '',
      prior: 'exponential(1)',
      label: '\u03c6 (precision)',
    });
  }

  return priors;
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
    case 'ordinal':
      return 'OrderedLogit(\u03c6\u1d62, \u03ba)';
    case 'proportion':
      return 'Beta(\u03bc\u1d62, \u03c6)';
    case 'positive-continuous':
      return 'LogNormal(\u03bc\u1d62, \u03c3)';
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
