/**
 * Tests for computeScaledPriors — covers all 7 outcome families × 3 scales.
 *
 * What we verify:
 * 1. All three scales (natural, centered, standardized) return well-formed
 *    ScaledPriors (finite numbers, positive SDs).
 * 2. Natural-scale intercept matches the user's stated baseline on the link scale.
 * 3. Slope is derived correctly from user effect statements.
 * 4. Standardized rescaling follows the documented conversion:
 *      identity: β_std = β × (SD_x / SD_y), intercept centered to 0, SD = 0.5
 *      logit/log: β_std = β × SD_x, intercept stays on link scale
 * 5. Centered slope equals natural slope on all links.
 */
import { describe, it, expect } from 'vitest';
import {
  computeScaledPriors,
  estimateSD,
  INITIAL_STATE,
  type WizardState,
  type OutcomeFamily,
  type DataScale,
} from '../types';
import { logit } from '../distributions';

// ── Builders ──

/** Build a minimal WizardState for a continuous/identity scenario. */
function gaussianState(): WizardState {
  return {
    ...INITIAL_STATE,
    family: 'gaussian',
    outcome: { name: 'elevation', mean: 63, plausibleMin: 55, plausibleMax: 71 },
    treatment: { name: 'rainfall', mean: 450, plausibleMin: 200, plausibleMax: 800 },
    effectChangeInTreatment: 100,
    effectChangeInOutcome: 3,
    effectOutcomeLo: 1,
    effectOutcomeHi: 5,
  };
}

function lognormalState(): WizardState {
  return {
    ...INITIAL_STATE,
    family: 'lognormal',
    outcome: { name: 'income', mean: 45000, plausibleMin: 15000, plausibleMax: 200000 },
    treatment: { name: 'years_edu', mean: 12, plausibleMin: 8, plausibleMax: 20 },
    effectChangeInTreatment: 1,
    effectOutcomeAfter: 49500, // +10% per year
    effectAfterLo: 47250,
    effectAfterHi: 51750,
  };
}

function bernoulliState(): WizardState {
  return {
    ...INITIAL_STATE,
    family: 'bernoulli',
    outcome: { name: 'survival', mean: 0.3, plausibleMin: 0.1, plausibleMax: 0.6 },
    treatment: { name: 'age', mean: 50, plausibleMin: 20, plausibleMax: 80 },
    effectChangeInTreatment: 10,
    effectOutcomeAfter: 0.45,
    effectAfterLo: 0.35,
    effectAfterHi: 0.55,
  };
}

function betaState(): WizardState {
  return {
    ...INITIAL_STATE,
    family: 'beta',
    outcome: { name: 'cover', mean: 0.45, plausibleMin: 0.10, plausibleMax: 0.80 },
    treatment: { name: 'moisture', mean: 30, plausibleMin: 10, plausibleMax: 60 },
    effectChangeInTreatment: 10,
    effectOutcomeAfter: 0.55,
    effectAfterLo: 0.48,
    effectAfterHi: 0.62,
  };
}

function poissonState(): WizardState {
  return {
    ...INITIAL_STATE,
    family: 'poisson',
    outcome: { name: 'artifacts', mean: 5, plausibleMin: 1, plausibleMax: 20 },
    treatment: { name: 'area', mean: 100, plausibleMin: 50, plausibleMax: 200 },
    effectChangeInTreatment: 50,
    effectOutcomeAfter: 7.5,
    effectAfterLo: 6,
    effectAfterHi: 9,
  };
}

function cumulativeState(): WizardState {
  return {
    ...INITIAL_STATE,
    family: 'cumulative',
    outcome: { name: 'severity', mean: 0, plausibleMin: 0, plausibleMax: 0 },
    treatment: { name: 'dosage', mean: 20, plausibleMin: 5, plausibleMax: 50 },
    effectChangeInTreatment: 10,
    effectOutcomeAfter: 0.65,
    effectAfterLo: 0.55,
    effectAfterHi: 0.75,
  };
}

function categoricalState(): WizardState {
  return {
    ...INITIAL_STATE,
    family: 'categorical',
    outcome: { name: 'land_use', mean: 0, plausibleMin: 0, plausibleMax: 0 },
    treatment: { name: 'elevation', mean: 500, plausibleMin: 100, plausibleMax: 1500 },
    effectChangeInTreatment: 200,
    effectOutcomeAfter: 0.65,
    effectAfterLo: 0.55,
    effectAfterHi: 0.75,
  };
}

const BUILDERS: Record<OutcomeFamily, () => WizardState> = {
  gaussian: gaussianState,
  lognormal: lognormalState,
  bernoulli: bernoulliState,
  beta: betaState,
  poisson: poissonState,
  cumulative: cumulativeState,
  categorical: categoricalState,
};

const SCALES: DataScale[] = ['natural', 'centered', 'standardized'];

// ── Well-formedness tests: all 7 families × 3 scales ──

describe('computeScaledPriors — well-formedness (all families × all scales)', () => {
  const families = Object.keys(BUILDERS) as OutcomeFamily[];
  for (const family of families) {
    for (const scale of SCALES) {
      it(`${family} / ${scale}: returns finite numbers, positive SDs, non-empty labels`, () => {
        const state = BUILDERS[family]();
        const priors = computeScaledPriors(state)[scale];

        expect(Number.isFinite(priors.interceptMean)).toBe(true);
        expect(Number.isFinite(priors.interceptSD)).toBe(true);
        expect(Number.isFinite(priors.slopeMean)).toBe(true);
        expect(Number.isFinite(priors.slopeSD)).toBe(true);

        expect(priors.interceptSD).toBeGreaterThan(0);
        expect(priors.slopeSD).toBeGreaterThan(0);

        expect(priors.label.length).toBeGreaterThan(0);
        expect(priors.interceptExplanation.length).toBeGreaterThan(0);
        expect(priors.slopeExplanation.length).toBeGreaterThan(0);
      });
    }
  }
});

// ── Intercept on natural scale matches user's stated baseline ──

describe('computeScaledPriors — natural-scale intercept reflects user baseline', () => {
  it('gaussian: intercept equals outcome mean', () => {
    const s = gaussianState();
    const priors = computeScaledPriors(s).natural;
    expect(priors.interceptMean).toBeCloseTo(s.outcome.mean);
  });

  it('lognormal: intercept equals log(outcome mean)', () => {
    const s = lognormalState();
    const priors = computeScaledPriors(s).natural;
    expect(priors.interceptMean).toBeCloseTo(Math.log(s.outcome.mean));
  });

  it('poisson: intercept equals log(outcome mean)', () => {
    const s = poissonState();
    const priors = computeScaledPriors(s).natural;
    expect(priors.interceptMean).toBeCloseTo(Math.log(s.outcome.mean));
  });

  it('bernoulli: intercept equals logit(outcome mean)', () => {
    const s = bernoulliState();
    const priors = computeScaledPriors(s).natural;
    expect(priors.interceptMean).toBeCloseTo(logit(s.outcome.mean));
  });

  it('beta: intercept equals logit(outcome mean)', () => {
    const s = betaState();
    const priors = computeScaledPriors(s).natural;
    expect(priors.interceptMean).toBeCloseTo(logit(s.outcome.mean));
  });

  it('cumulative: intercept uses fixed default 0 (threshold model)', () => {
    const priors = computeScaledPriors(cumulativeState()).natural;
    expect(priors.interceptMean).toBe(0);
    expect(priors.interceptSD).toBe(1.5);
  });

  it('categorical: intercept uses fixed default 0 (threshold model)', () => {
    const priors = computeScaledPriors(categoricalState()).natural;
    expect(priors.interceptMean).toBe(0);
    expect(priors.interceptSD).toBe(1.5);
  });
});

// ── Slope derivation from user's stated effect ──

describe('computeScaledPriors — slope derived from user effect', () => {
  it('gaussian: slope = ΔY / ΔX', () => {
    const s = gaussianState();
    const priors = computeScaledPriors(s).natural;
    expect(priors.slopeMean).toBeCloseTo(
      s.effectChangeInOutcome / s.effectChangeInTreatment,
    );
  });

  it('lognormal: slope = (log(after) - log(base)) / ΔX', () => {
    const s = lognormalState();
    const priors = computeScaledPriors(s).natural;
    const expected =
      (Math.log(s.effectOutcomeAfter) - Math.log(s.outcome.mean)) /
      s.effectChangeInTreatment;
    expect(priors.slopeMean).toBeCloseTo(expected);
  });

  it('poisson: slope = (log(after) - log(base)) / ΔX', () => {
    const s = poissonState();
    const priors = computeScaledPriors(s).natural;
    const expected =
      (Math.log(s.effectOutcomeAfter) - Math.log(s.outcome.mean)) /
      s.effectChangeInTreatment;
    expect(priors.slopeMean).toBeCloseTo(expected);
  });

  it('bernoulli: slope = (logit(after) - logit(base)) / ΔX', () => {
    const s = bernoulliState();
    const priors = computeScaledPriors(s).natural;
    const expected =
      (logit(s.effectOutcomeAfter) - logit(s.outcome.mean)) /
      s.effectChangeInTreatment;
    expect(priors.slopeMean).toBeCloseTo(expected);
  });

  it('beta: slope = (logit(after) - logit(base)) / ΔX', () => {
    const s = betaState();
    const priors = computeScaledPriors(s).natural;
    const expected =
      (logit(s.effectOutcomeAfter) - logit(s.outcome.mean)) /
      s.effectChangeInTreatment;
    expect(priors.slopeMean).toBeCloseTo(expected);
  });

  it('cumulative: slope = (logit(after) - logit(0.5)) / ΔX', () => {
    const s = cumulativeState();
    const priors = computeScaledPriors(s).natural;
    const expected =
      (logit(s.effectOutcomeAfter) - logit(0.5)) / s.effectChangeInTreatment;
    expect(priors.slopeMean).toBeCloseTo(expected);
  });
});

// ── Centered slope == natural slope (across all links) ──

describe('computeScaledPriors — centered slope equals natural slope', () => {
  const families = Object.keys(BUILDERS) as OutcomeFamily[];
  for (const family of families) {
    it(`${family}: centered.slopeMean === natural.slopeMean`, () => {
      const priors = computeScaledPriors(BUILDERS[family]());
      expect(priors.centered.slopeMean).toBeCloseTo(priors.natural.slopeMean);
      expect(priors.centered.slopeSD).toBeCloseTo(priors.natural.slopeSD);
    });
  }
});

// ── Standardized rescaling: identity link ──

describe('computeScaledPriors — standardized rescaling (identity link)', () => {
  it('gaussian: intercept forced to 0 with SD 0.5', () => {
    const priors = computeScaledPriors(gaussianState()).standardized;
    expect(priors.interceptMean).toBe(0);
    expect(priors.interceptSD).toBe(0.5);
  });

  it('gaussian: β_std = β_natural × (SD_x / SD_y)', () => {
    const s = gaussianState();
    const all = computeScaledPriors(s);
    const txSD = estimateSD(s.treatment);
    const outSD = estimateSD(s.outcome);
    const expected = all.natural.slopeMean * (txSD / outSD);
    expect(all.standardized.slopeMean).toBeCloseTo(expected);
  });
});

// ── Standardized rescaling: logit / log links ──

describe('computeScaledPriors — standardized rescaling (logit/log links)', () => {
  it('bernoulli: β_std = β_natural × SD_x (outcome stays on link scale)', () => {
    const s = bernoulliState();
    const all = computeScaledPriors(s);
    const txSD = estimateSD(s.treatment);
    expect(all.standardized.slopeMean).toBeCloseTo(all.natural.slopeMean * txSD);
  });

  it('beta: β_std = β_natural × SD_x', () => {
    const s = betaState();
    const all = computeScaledPriors(s);
    const txSD = estimateSD(s.treatment);
    expect(all.standardized.slopeMean).toBeCloseTo(all.natural.slopeMean * txSD);
  });

  it('poisson: β_std = β_natural × SD_x', () => {
    const s = poissonState();
    const all = computeScaledPriors(s);
    const txSD = estimateSD(s.treatment);
    expect(all.standardized.slopeMean).toBeCloseTo(all.natural.slopeMean * txSD);
  });

  it('lognormal: β_std = β_natural × SD_x', () => {
    const s = lognormalState();
    const all = computeScaledPriors(s);
    const txSD = estimateSD(s.treatment);
    expect(all.standardized.slopeMean).toBeCloseTo(all.natural.slopeMean * txSD);
  });

  it('logit/log: standardized intercept stays on link scale (not forced to 0)', () => {
    for (const state of [bernoulliState(), betaState(), poissonState(), lognormalState()]) {
      const all = computeScaledPriors(state);
      expect(all.standardized.interceptMean).toBeCloseTo(all.centered.interceptMean);
    }
  });
});

// ── Labels identify the correct scale ──

describe('computeScaledPriors — labels mention the correct scale', () => {
  it('each scale label includes its name', () => {
    const all = computeScaledPriors(gaussianState());
    expect(all.natural.label.toLowerCase()).toContain('natural');
    expect(all.centered.label.toLowerCase()).toContain('centered');
    expect(all.standardized.label.toLowerCase()).toContain('standardized');
  });

  it('logit-link labels mention "logit"', () => {
    const all = computeScaledPriors(bernoulliState());
    expect(all.natural.label.toLowerCase()).toContain('logit');
  });

  it('log-link labels mention "log"', () => {
    const all = computeScaledPriors(poissonState()).natural;
    expect(all.label.toLowerCase()).toContain('log');
  });
});

// ── Zero-effect degenerate case ──

describe('computeScaledPriors — zero effectChangeInTreatment is handled', () => {
  it('slope defaults to 0 with a positive fallback SD', () => {
    const state = { ...gaussianState(), effectChangeInTreatment: 0 };
    const priors = computeScaledPriors(state).natural;
    expect(priors.slopeMean).toBe(0);
    expect(priors.slopeSD).toBeGreaterThan(0);
  });
});
