import type { EstimandKind, Variable } from '../types/dag';

interface DoNotationResult {
  doNotation: string;
  plainEnglish: string;
}

/**
 * Generate do-calculus notation and plain English description
 * for a given estimand.
 */
export function generateDoNotation(
  source: Variable,
  target: Variable,
  kind: EstimandKind,
  excludedMediators: Variable[] = [],
): DoNotationResult {
  const targetShort = target.shorthand;
  const sourceShort = source.shorthand;

  if (kind === 'total') {
    return {
      doNotation: `p(${targetShort} | do(${sourceShort}))`,
      plainEnglish: `Total causal effect of ${source.name} on ${target.name}`,
    };
  }

  // Direct effect — conditioning on mediators
  if (excludedMediators.length === 0) {
    return {
      doNotation: `p(${targetShort} | do(${sourceShort}))`,
      plainEnglish: `Direct effect of ${source.name} on ${target.name}`,
    };
  }

  const mediatorShorts = excludedMediators.map((m) => m.shorthand);
  const mediatorNames = excludedMediators.map((m) => m.name);

  const conditionParts = mediatorShorts.map((s) => `${s}=\u200B${s.toLowerCase()}`);
  const doNotation = `p(${targetShort} | do(${sourceShort}), ${conditionParts.join(', ')})`;

  const throughClause =
    mediatorNames.length === 1
      ? mediatorNames[0]
      : mediatorNames.slice(0, -1).join(', ') +
        ' and ' +
        mediatorNames[mediatorNames.length - 1];

  const plainEnglish = `Direct effect of ${source.name} on ${target.name}, not through ${throughClause}`;

  return { doNotation, plainEnglish };
}
