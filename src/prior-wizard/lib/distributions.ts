/**
 * Pure math utilities for computing and sampling from distributions.
 * Used for distribution curve visualization and prior predictive checks.
 */

/** Normal PDF */
export function normalPdf(x: number, mean: number, sd: number): number {
  const z = (x - mean) / sd;
  return Math.exp(-0.5 * z * z) / (sd * Math.sqrt(2 * Math.PI));
}

/** Exponential PDF */
export function exponentialPdf(x: number, rate: number): number {
  if (x < 0) return 0;
  return rate * Math.exp(-rate * x);
}

/** Logit → probability */
export function logistic(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/** Probability → logit */
export function logit(p: number): number {
  return Math.log(p / (1 - p));
}

/** Generate points for a normal distribution curve */
export function normalCurvePoints(
  mean: number,
  sd: number,
  numPoints: number = 200,
): { x: number; y: number }[] {
  const lo = mean - 4 * sd;
  const hi = mean + 4 * sd;
  const step = (hi - lo) / (numPoints - 1);
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < numPoints; i++) {
    const x = lo + i * step;
    points.push({ x, y: normalPdf(x, mean, sd) });
  }
  return points;
}

/** Generate points for an exponential distribution curve */
export function exponentialCurvePoints(
  rate: number,
  numPoints: number = 200,
): { x: number; y: number }[] {
  // Show up to where the PDF is nearly zero
  const hi = Math.max(5 / rate, 5);
  const step = hi / (numPoints - 1);
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < numPoints; i++) {
    const x = i * step;
    points.push({ x, y: exponentialPdf(x, rate) });
  }
  return points;
}

/**
 * Generate points showing the implied probability range
 * for a normal prior on the logit scale.
 * Returns: for each sample from Normal(mean, sd),
 * the implied probability via logistic transform.
 */
export function logitImpliedProbabilities(
  mean: number,
  sd: number,
  numPoints: number = 200,
): { logit: number; prob: number; density: number }[] {
  const lo = mean - 4 * sd;
  const hi = mean + 4 * sd;
  const step = (hi - lo) / (numPoints - 1);
  const points: { logit: number; prob: number; density: number }[] = [];
  for (let i = 0; i < numPoints; i++) {
    const x = lo + i * step;
    points.push({
      logit: x,
      prob: logistic(x),
      density: normalPdf(x, mean, sd),
    });
  }
  return points;
}

/**
 * Generate points showing implied values for a normal prior on the log scale.
 */
export function logImpliedValues(
  mean: number,
  sd: number,
  numPoints: number = 200,
): { log: number; value: number; density: number }[] {
  const lo = mean - 4 * sd;
  const hi = mean + 4 * sd;
  const step = (hi - lo) / (numPoints - 1);
  const points: { log: number; value: number; density: number }[] = [];
  for (let i = 0; i < numPoints; i++) {
    const x = lo + i * step;
    points.push({
      log: x,
      value: Math.exp(x),
      density: normalPdf(x, mean, sd),
    });
  }
  return points;
}

/** 95% interval for a normal distribution */
export function normalInterval95(mean: number, sd: number): [number, number] {
  return [mean - 1.96 * sd, mean + 1.96 * sd];
}

/** Format a number for display (avoid floating point noise) */
export function fmt(n: number, decimals: number = 2): string {
  return Number(n.toFixed(decimals)).toString();
}
