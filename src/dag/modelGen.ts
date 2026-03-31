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
 * Whether a predictor variable needs factor() wrapping in brms.
 * Categorical, binary, and ordinal predictors need explicit factor coding
 * so brms generates the correct dummy/contrast coefficients.
 */
function needsFactor(type: VariableType): boolean {
  return type === 'categorical' || type === 'binary' || type === 'ordinal';
}

/**
 * Format a predictor variable for a brms formula.
 * Wraps categorical/binary/ordinal in factor(); leaves continuous as-is.
 */
function formulaName(v: Variable): string {
  const name = rName(v.name);
  return needsFactor(v.variableType) ? `factor(${name})` : name;
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

  // Determine if treatment is factor-like (categorical, binary, or ordinal)
  const treatmentIsCategorical = needsFactor(treatment.variableType);

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

    if (needsFactor(v.variableType)) {
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

  // Treatment term (wrap in factor() if categorical/binary/ordinal)
  const treatmentFormula = formulaName(treatment);
  formulaParts.push(treatmentFormula);

  // Conditioned variables
  for (const v of conditionOn) {
    const vFormula = formulaName(v);
    if (interaction) {
      // Interaction: treatment:variable (works for both factor and continuous)
      formulaParts.push(`${treatmentFormula}:${vFormula}`);
    } else {
      formulaParts.push(vFormula);
    }
  }

  const formula = `${outcomeR} ~ ${formulaParts.join(' + ')}`;

  // ── Priors ──

  const priors = generateDefaultPriors(outcome.variableType, treatment, conditionOn, interaction);

  const priorLines = priors.map((p) => {
    const coefArg = p.coef ? `, coef = "${p.coef}"` : '';
    return `  set_prior("${p.prior}", class = "${p.class}"${coefArg})`;
  });

  // ── Data prep comment ──
  const continuousPreds = predictors.filter((v) => !needsFactor(v.variableType));
  const factorPreds = predictors.filter((v) => needsFactor(v.variableType));

  const prepLines: string[] = [];
  prepLines.push('# Priors assume standardized continuous predictors');
  if (continuousPreds.length > 0) {
    const cNames = continuousPreds.map((v) => rName(v.name));
    prepLines.push(
      `d <- d |> mutate(${cNames.map((n) => `${n} = scale(${n})`).join(', ')})`,
    );
  }
  if (factorPreds.length > 0) {
    const fNote = factorPreds.map((v) => `${rName(v.name)}: ${v.variableType}`).join(', ');
    prepLines.push(`# Factor variables (${fNote}) — brms handles dummy coding`);
  }
  prepLines.push('');

  const brmsCodeLines = [
    ...prepLines,
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
    outcomeType === 'binary' ||
    outcomeType === 'ordinal' ||
    outcomeType === 'proportion' ||
    outcomeType === 'categorical';
  const usesLogLink =
    outcomeType === 'count' || outcomeType === 'positive-continuous';

  // Intercept prior
  if (usesLogitLink) {
    priors.push({
      class: 'Intercept',
      coef: '',
      prior: 'normal(0, 1.5)',
      label: '\u03b1 (intercept, logit scale)',
      tooltip: 'On the logit scale, Normal(0, 1.5) places ~95% of the prior mass on baseline probabilities between about 5% and 95%. This is mildly regularizing \u2014 it rules out near-certainty (close to 0% or 100%) without being very informative about where the baseline falls.',
    });
  } else if (usesLogLink) {
    priors.push({
      class: 'Intercept',
      coef: '',
      prior: 'normal(0, 1)',
      label: '\u03b1 (intercept, log scale)',
      tooltip: 'On the log scale, Normal(0, 1) centers the baseline rate at exp(0) = 1, with ~95% of the mass between exp(\u22122) \u2248 0.14 and exp(2) \u2248 7.4. For standardized data, this is mildly regularizing \u2014 it allows a wide range of baseline rates while keeping estimates grounded.',
    });
  } else {
    priors.push({
      class: 'Intercept',
      coef: '',
      prior: 'normal(0, 0.5)',
      label: '\u03b1 (intercept)',
      tooltip: 'For standardized data, Normal(0, 0.5) means the average outcome (when all predictors are at their mean) is likely within \u00b11 SD of the outcome\u2019s mean. Weakly regularizing \u2014 it gently discourages extreme intercepts without being very informative.',
    });
  }

  // Slope priors — one per predictor
  const slopePrior = usesLogitLink
    ? 'normal(0, 1)'
    : usesLogLink
      ? 'normal(0, 0.5)'
      : 'normal(0, 0.5)';

  const slopeTooltip = usesLogitLink
    ? 'On the logit scale, Normal(0, 1) means a 1-SD change in the predictor shifts the log-odds by at most about \u00b12. This allows substantial effects while preventing unrealistically extreme ones \u2014 a shift of 2 on the logit scale already moves a 50% probability to ~88%.'
    : usesLogLink
      ? 'On the log scale, Normal(0, 0.5) means a 1-SD change in the predictor multiplies the outcome by at most about exp(\u00b11) \u2248 0.37 to 2.7. Mildly regularizing \u2014 it allows moderately strong effects but is skeptical of any single predictor changing the outcome by orders of magnitude.'
      : 'For standardized data, Normal(0, 0.5) means a 1-SD change in the predictor changes the outcome by at most about \u00b11 SD. Weakly regularizing \u2014 it says you don\u2019t expect any single predictor to have a huge effect, but doesn\u2019t rule it out.';

  const treatmentIsFactor = needsFactor(treatment.variableType);

  // Continuous predictors get coef-specific priors
  if (!treatmentIsFactor) {
    priors.push({
      class: 'b',
      coef: rName(treatment.name),
      prior: slopePrior,
      label: `\u03b2 ${treatment.shorthand} (treatment)`,
      tooltip: `Treatment effect slope. ${slopeTooltip}`,
    });
  }

  for (const v of conditionOn) {
    if (!needsFactor(v.variableType)) {
      const coef = interaction
        ? `${rName(treatment.name)}:${rName(v.name)}`
        : rName(v.name);
      const role = interaction ? 'interaction' : 'adjustment';
      const roleTooltip = interaction
        ? `Interaction term \u2014 how the treatment\u2019s effect changes depending on ${v.name}. ${slopeTooltip}`
        : `Adjustment variable \u2014 included to block a non-causal path, not to estimate its own causal effect. ${slopeTooltip}`;
      priors.push({
        class: 'b',
        coef,
        prior: slopePrior,
        label: `\u03b2 ${v.shorthand} (${role})`,
        tooltip: roleTooltip,
      });
    }
  }

  // Factor (categorical/binary/ordinal) predictors: class-level prior
  // brms generates multiple dummy coefficients per factor variable with
  // unpredictable names (e.g., "factor(group)levelB"). A class-level prior
  // applies to all b-class coefficients not covered by coef-specific priors.
  const factorPredictors = [treatment, ...conditionOn].filter((v) =>
    needsFactor(v.variableType),
  );
  if (factorPredictors.length > 0) {
    const factorNames = factorPredictors.map((v) => v.name).join(', ');
    const factorShorts = factorPredictors.map((v) => v.shorthand).join(', ');
    priors.push({
      class: 'b',
      coef: '',
      prior: slopePrior,
      label: `\u03b2 [${factorShorts}] (factor levels)`,
      tooltip:
        `Class-level prior for factor variable coefficients (${factorNames}). ` +
        `Each level gets its own coefficient representing the difference from the reference level. ` +
        slopeTooltip,
    });
  }

  // Scale / dispersion parameter
  if (outcomeType === 'continuous' || outcomeType === 'time-series' || outcomeType === 'time-cycle') {
    priors.push({
      class: 'sigma',
      coef: '',
      prior: 'exponential(1)',
      label: '\u03c3 (residual SD)',
      tooltip: 'Exponential(1) constrains the residual standard deviation to be positive, with a mean of 1 and ~95% below 3. For standardized data, this is mildly regularizing \u2014 it\u2019s skeptical of models that explain nothing (huge \u03c3) while allowing substantial unexplained variation.',
    });
  } else if (outcomeType === 'positive-continuous') {
    priors.push({
      class: 'sigma',
      coef: '',
      prior: 'exponential(1)',
      label: '\u03c3 (log-scale SD)',
      tooltip: 'Exponential(1) on the log-scale standard deviation is weakly regularizing. Most mass falls below ~3, preventing unrealistically wide distributions on the log scale while allowing moderate variability in the original positive-valued outcome.',
    });
  } else if (outcomeType === 'proportion') {
    priors.push({
      class: 'phi',
      coef: '',
      prior: 'exponential(1)',
      label: '\u03c6 (precision)',
      tooltip: 'For Beta regression, the precision parameter \u03c6 controls how tightly clustered the proportions are. Higher \u03c6 = less spread. Exponential(1) is weakly regularizing with a mean of 1, allowing anything from very dispersed to moderately concentrated proportions.',
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
