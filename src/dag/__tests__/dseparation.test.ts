/**
 * Automated tests for the d-separation engine and backdoor criterion.
 *
 * Each test loads a DAG from test-dags/ and verifies:
 * - Adjustment set (which variables, which reasons)
 * - Bad controls (which variables, which types)
 * - Identifiability
 *
 * These mirror the manual TEST-CHECKLIST.md.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { findBackdoorAdjustmentSet, type BackdoorResult } from '../dseparation';
import { generateModel } from '../modelGen';
import type { Variable, VariableType } from '../../types/dag';

// ── Helpers ──

interface DagFile {
  variables: [string, Variable][];
  causalEdges: { id: string; source: string; target: string; data: unknown }[];
}

function loadDag(filename: string): DagFile {
  const path = resolve(__dirname, '../../../test-dags', filename);
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function getEdges(dag: DagFile) {
  return dag.causalEdges.map((e) => ({ source: e.source, target: e.target }));
}

function getVariable(dag: DagFile, id: string): Variable {
  const entry = dag.variables.find(([vid]) => vid === id);
  if (!entry) throw new Error(`Variable ${id} not found`);
  return entry[1];
}

function getUnobservedIds(dag: DagFile): Set<string> {
  return new Set(
    dag.variables
      .filter(([, v]) => v.variableType === 'unobserved')
      .map(([id]) => id),
  );
}

/** Extract just the variable IDs from the adjustment set */
function adjustmentIds(result: BackdoorResult): string[] {
  return result.adjustmentSet.map((a) => a.variableId).sort();
}

/** Extract just the variable IDs from bad controls */
function badControlIds(result: BackdoorResult): string[] {
  return result.badControls.map((b) => b.variableId).sort();
}

/** Extract adjustment reasons as a map of id → reason */
function adjustmentReasons(
  result: BackdoorResult,
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const a of result.adjustmentSet) map[a.variableId] = a.reason;
  return map;
}

/** Extract bad control types as a map of id → type */
function badControlTypes(
  result: BackdoorResult,
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const b of result.badControls) map[b.variableId] = b.type;
  return map;
}

// ── Test 01: Waffle Divorce ──

describe('01 — Waffle Divorce', () => {
  const dag = loadDag('01-waffle-divorce.estiplan.json');
  const edges = getEdges(dag);

  it('1a: total effect of Marriage Rate → Divorce Rate', () => {
    const result = findBackdoorAdjustmentSet(edges, 'v_marriage', 'v_divorce');

    expect(result.identifiable).toBe(true);
    // Minimal set: just Age at Marriage blocks both backdoor paths:
    //   M <- S -> A -> D (A is a pipe — conditioning blocks it)
    //   M <- A -> D (A is a fork — conditioning blocks it)
    // South is valid but redundant — all its confounding goes through A.
    expect(adjustmentIds(result)).toEqual(['v_age']);
    expect(adjustmentReasons(result)['v_age']).toBe('fork');
    // No bad controls
    expect(result.badControls).toHaveLength(0);
  });

  it('1b: direct effect of Age at Marriage → Divorce Rate (exclude Marriage Rate)', () => {
    const result = findBackdoorAdjustmentSet(
      edges,
      'v_age',
      'v_divorce',
      ['v_marriage'], // excluded mediators
    );

    expect(result.identifiable).toBe(true);
    // Must condition on South (fork) — Marriage Rate should also be in the
    // adjustment because it's an excluded mediator for direct effect,
    // but the adjustment set from backdoor only includes South
    expect(adjustmentIds(result)).toContain('v_south');
  });

  it('1c: total effect of South → Divorce Rate', () => {
    const result = findBackdoorAdjustmentSet(edges, 'v_south', 'v_divorce');

    expect(result.identifiable).toBe(true);
    // Nothing causes South, so no backdoor paths — empty adjustment set
    expect(result.adjustmentSet).toHaveLength(0);
  });
});

// ── Test 02: Simple Fork ──

describe('02 — Simple Fork', () => {
  const dag = loadDag('02-simple-fork.estiplan.json');
  const edges = getEdges(dag);

  it('total effect of Treatment → Outcome', () => {
    const result = findBackdoorAdjustmentSet(edges, 'v_x', 'v_y');

    expect(result.identifiable).toBe(true);
    expect(adjustmentIds(result)).toEqual(['v_z']);
    expect(adjustmentReasons(result)['v_z']).toBe('fork');
    expect(result.badControls).toHaveLength(0);
  });
});

// ── Test 03: Simple Pipe ──

describe('03 — Simple Pipe', () => {
  const dag = loadDag('03-simple-pipe.estiplan.json');
  const edges = getEdges(dag);

  it('3a: total effect — no adjustment needed', () => {
    const result = findBackdoorAdjustmentSet(edges, 'v_x', 'v_y');

    expect(result.identifiable).toBe(true);
    expect(result.adjustmentSet).toHaveLength(0);
    // Mediator should be flagged as bad control for total effect
    expect(badControlIds(result)).toContain('v_z');
    expect(badControlTypes(result)['v_z']).toBe('mediator-total');
  });

  it('3b: direct effect (exclude Mediator)', () => {
    const result = findBackdoorAdjustmentSet(
      edges,
      'v_x',
      'v_y',
      ['v_z'], // excluded mediators
    );

    expect(result.identifiable).toBe(true);
    // Mediator should NOT be a bad control when explicitly excluded for direct effect
    expect(badControlIds(result)).not.toContain('v_z');
  });
});

// ── Test 04: Classic Collider ──

describe('04 — Classic Collider', () => {
  const dag = loadDag('04-classic-collider.estiplan.json');
  const edges = getEdges(dag);

  it('total effect of Talent → Attractiveness', () => {
    const result = findBackdoorAdjustmentSet(edges, 'v_x', 'v_y');

    expect(result.identifiable).toBe(true);
    // No adjustment set — X and Y are independent (collider blocks by default)
    expect(result.adjustmentSet).toHaveLength(0);
    // Hollywood Success is both a collider AND a descendant of treatment (X -> Z).
    // The engine flags descendants of treatment as post-treatment first.
    expect(badControlIds(result)).toContain('v_z');
    expect(badControlTypes(result)['v_z']).toBe('post-treatment');
  });
});

// ── Test 05: Collider + Descendant ──

describe('05 — Collider + Descendant', () => {
  const dag = loadDag('05-collider-descendant.estiplan.json');
  const edges = getEdges(dag);

  it('total effect of Education → Earnings', () => {
    const result = findBackdoorAdjustmentSet(edges, 'v_x', 'v_y');

    expect(result.identifiable).toBe(true);
    expect(result.adjustmentSet).toHaveLength(0);
    // Occupation (Z) is both collider and descendant of treatment (X -> Z),
    // so it's flagged as post-treatment. Job Title (D) is descendant of Z.
    expect(badControlIds(result)).toContain('v_z');
    expect(badControlIds(result)).toContain('v_d');
    expect(badControlTypes(result)['v_z']).toBe('post-treatment');
    expect(badControlTypes(result)['v_d']).toBe('post-treatment');
  });
});

// ── Test 06: Unidentifiable ──

describe('06 — Unidentifiable (unmeasured confound)', () => {
  const dag = loadDag('06-unidentifiable.estiplan.json');
  const edges = getEdges(dag);
  const unobserved = getUnobservedIds(dag);

  it('total effect of Treatment → Outcome is NOT identifiable', () => {
    const result = findBackdoorAdjustmentSet(
      edges,
      'v_x',
      'v_y',
      [],
      unobserved,
    );

    expect(result.identifiable).toBe(false);
    // U is unobserved, so it cannot be in the adjustment set
    expect(adjustmentIds(result)).not.toContain('v_u');
  });
});

// ── Test 07: Multiple Backdoor Paths ──

describe('07 — Multiple Backdoor Paths', () => {
  const dag = loadDag('07-multiple-backdoors.estiplan.json');
  const edges = getEdges(dag);

  it('total effect of Treatment → Outcome', () => {
    const result = findBackdoorAdjustmentSet(edges, 'v_x', 'v_y');

    expect(result.identifiable).toBe(true);
    // Must condition on BOTH confounds
    expect(adjustmentIds(result)).toEqual(['v_z1', 'v_z2'].sort());
    expect(adjustmentReasons(result)['v_z1']).toBe('fork');
    expect(adjustmentReasons(result)['v_z2']).toBe('fork');
  });
});

// ── Test 08: Post-Treatment Bias ──

describe('08 — Post-Treatment Bias', () => {
  const dag = loadDag('08-post-treatment-bias.estiplan.json');
  const edges = getEdges(dag);

  it('8a: total effect of Fertilizer → Fruit Yield', () => {
    const result = findBackdoorAdjustmentSet(edges, 'v_x', 'v_y');

    expect(result.identifiable).toBe(true);
    // No adjustment set — nothing causes Fertilizer
    expect(result.adjustmentSet).toHaveLength(0);
    // Plant Height is mediator — bad control for total effect
    expect(badControlIds(result)).toContain('v_m');
    const types = badControlTypes(result);
    expect(types['v_m']).toBe('mediator-total');
  });

  it('8b: direct effect of Fertilizer → Fruit Yield (exclude Plant Height)', () => {
    const result = findBackdoorAdjustmentSet(
      edges,
      'v_x',
      'v_y',
      ['v_m'], // excluded mediators
    );

    expect(result.identifiable).toBe(true);
    // Plant Height should NOT be a bad control when used for direct effect
    expect(badControlIds(result)).not.toContain('v_m');
  });
});

// ── Test 09: Table Two Fallacy ──

describe('09 — Table Two Fallacy', () => {
  const dag = loadDag('09-table-two-fallacy.estiplan.json');
  const edges = getEdges(dag);

  it('total effect of Exercise → Blood Pressure', () => {
    const result = findBackdoorAdjustmentSet(edges, 'v_x', 'v_y');

    expect(result.identifiable).toBe(true);
    // Must condition on all three confounds
    expect(adjustmentIds(result)).toEqual(
      ['v_age', 'v_diet', 'v_sex'].sort(),
    );
    // All should be forks
    const reasons = adjustmentReasons(result);
    expect(reasons['v_age']).toBe('fork');
    expect(reasons['v_sex']).toBe('fork');
    expect(reasons['v_diet']).toBe('fork');
    expect(result.badControls).toHaveLength(0);
  });
});

// ── Test 10: brms Family Sweep ──

describe('10 — brms Family Sweep', () => {
  const dag = loadDag('10-brms-family-sweep.estiplan.json');

  const familyCases: [string, string, VariableType][] = [
    ['v_gauss', 'gaussian()', 'continuous'],
    ['v_bern', 'bernoulli()', 'binary'],
    ['v_pois', 'poisson()', 'count'],
    ['v_cat', 'categorical()', 'categorical'],
    ['v_ord', 'cumulative("logit")', 'ordinal'],
    ['v_beta', 'Beta()', 'proportion'],
    ['v_logn', 'lognormal()', 'positive-continuous'],
  ];

  for (const [outcomeId, expectedFamily, expectedType] of familyCases) {
    it(`${outcomeId} → ${expectedFamily}`, () => {
      const outcome = getVariable(dag, outcomeId);
      const treatment = getVariable(dag, 'v_x');

      expect(outcome.variableType).toBe(expectedType);

      const model = generateModel(outcome, treatment, 'total', [], false);
      expect(model.family).toBe(expectedFamily);
    });
  }
});

// ── Minimal Adjustment Set ──

describe('Minimal adjustment set optimization', () => {
  it('finds size-1 set when one variable blocks all backdoor paths', () => {
    // DAG: A → X, A → B, B → Y, X → Y
    // Backdoor path: X ← A → B → Y
    // Both A (fork) and B (pipe) can block it individually.
    // Greedy would add both; minimal should pick just one (size 1).
    const edges = [
      { source: 'a', target: 'x' },
      { source: 'a', target: 'b' },
      { source: 'b', target: 'y' },
      { source: 'x', target: 'y' },
    ];

    const result = findBackdoorAdjustmentSet(edges, 'x', 'y');

    expect(result.identifiable).toBe(true);
    // Should find a set of size 1 (either {a} or {b}, both valid)
    expect(result.adjustmentSet).toHaveLength(1);
    const id = result.adjustmentSet[0].variableId;
    expect(['a', 'b']).toContain(id);
  });

  it('needs both variables when they block independent paths', () => {
    // DAG: A → X, A → Y, B → X, B → Y, X → Y (two independent forks)
    // Two backdoor paths, each needs its own blocker
    const edges = [
      { source: 'a', target: 'x' },
      { source: 'a', target: 'y' },
      { source: 'b', target: 'x' },
      { source: 'b', target: 'y' },
      { source: 'x', target: 'y' },
    ];

    const result = findBackdoorAdjustmentSet(edges, 'x', 'y');

    expect(result.identifiable).toBe(true);
    expect(result.adjustmentSet).toHaveLength(2);
    expect(adjustmentIds(result)).toEqual(['a', 'b']);
  });
});

// ── Non-Standard Paths ──

describe('Non-standard paths (forward-then-reverse)', () => {
  it('non-standard path with collider is blocked by default', () => {
    // DAG: X → A, B → A, B → Y, X → Y
    // Path X → A ← B → Y starts forward then reverses — collider at A.
    // Should be blocked by default (no adjustment needed).
    const edges = [
      { source: 'x', target: 'a' },
      { source: 'b', target: 'a' },
      { source: 'b', target: 'y' },
      { source: 'x', target: 'y' },
    ];

    const result = findBackdoorAdjustmentSet(edges, 'x', 'y');

    expect(result.identifiable).toBe(true);
    // No backdoor paths, collider path blocked by default — empty adjustment
    expect(result.adjustmentSet).toHaveLength(0);
    // A is a collider (or post-treatment of X), should be warned about
    expect(badControlIds(result)).toContain('a');
  });
});

// ── Prior Generation ──

describe('Prior generation', () => {
  const dag = loadDag('02-simple-fork.estiplan.json');

  it('generates intercept, slope, and sigma priors for gaussian', () => {
    const outcome = getVariable(dag, 'v_y');
    const treatment = getVariable(dag, 'v_x');
    const conditionOn = [getVariable(dag, 'v_z')];

    const model = generateModel(outcome, treatment, 'total', conditionOn, false);

    expect(model.priors.length).toBeGreaterThanOrEqual(3);
    const classes = model.priors.map((p) => p.class);
    expect(classes).toContain('Intercept');
    expect(classes).toContain('b');
    expect(classes).toContain('sigma');
  });

  it('brms code includes set_prior calls', () => {
    const outcome = getVariable(dag, 'v_y');
    const treatment = getVariable(dag, 'v_x');

    const model = generateModel(outcome, treatment, 'total', [], false);

    expect(model.brmsCode).toContain('prior = c(');
    expect(model.brmsCode).toContain('set_prior(');
  });

  it('uses logit-scale priors for binary outcomes', () => {
    const binaryDag = loadDag('10-brms-family-sweep.estiplan.json');
    const outcome = getVariable(binaryDag, 'v_bern');
    const treatment = getVariable(binaryDag, 'v_x');

    const model = generateModel(outcome, treatment, 'total', [], false);

    const interceptPrior = model.priors.find((p) => p.class === 'Intercept');
    expect(interceptPrior).toBeDefined();
    expect(interceptPrior!.prior).toBe('normal(0, 1.5)');
    expect(interceptPrior!.label).toContain('logit');
  });

  it('uses log-scale priors for count outcomes', () => {
    const countDag = loadDag('10-brms-family-sweep.estiplan.json');
    const outcome = getVariable(countDag, 'v_pois');
    const treatment = getVariable(countDag, 'v_x');

    const model = generateModel(outcome, treatment, 'total', [], false);

    const interceptPrior = model.priors.find((p) => p.class === 'Intercept');
    expect(interceptPrior!.prior).toBe('normal(0, 1)');
    expect(interceptPrior!.label).toContain('log');
  });

  it('includes phi prior for Beta family', () => {
    const betaDag = loadDag('10-brms-family-sweep.estiplan.json');
    const outcome = getVariable(betaDag, 'v_beta');
    const treatment = getVariable(betaDag, 'v_x');

    const model = generateModel(outcome, treatment, 'total', [], false);

    const phiPrior = model.priors.find((p) => p.class === 'phi');
    expect(phiPrior).toBeDefined();
    expect(phiPrior!.prior).toBe('exponential(1)');
  });
});

// ── Additional: brms code structure ──

describe('brms code generation', () => {
  const dag = loadDag('02-simple-fork.estiplan.json');

  it('generates correct formula with adjustment variables', () => {
    const outcome = getVariable(dag, 'v_y');
    const treatment = getVariable(dag, 'v_x');
    const conditionOn = [getVariable(dag, 'v_z')];

    const model = generateModel(outcome, treatment, 'total', conditionOn, false);

    expect(model.brmsCode).toContain('outcome ~ treatment + common_cause');
    expect(model.brmsCode).toContain('family = gaussian()');
  });

  it('generates interaction terms when toggled', () => {
    const outcome = getVariable(dag, 'v_y');
    const treatment = getVariable(dag, 'v_x');
    const conditionOn = [getVariable(dag, 'v_z')];

    const model = generateModel(outcome, treatment, 'total', conditionOn, true);

    expect(model.brmsCode).toContain('treatment:common_cause');
  });
});

// ── Additional: Waffle House brms output ──

describe('brms code — Waffle Divorce', () => {
  const dag = loadDag('01-waffle-divorce.estiplan.json');

  it('Marriage Rate → Divorce Rate formula', () => {
    const outcome = getVariable(dag, 'v_divorce');
    const treatment = getVariable(dag, 'v_marriage');
    const conditionOn = [
      getVariable(dag, 'v_age'),
      getVariable(dag, 'v_south'),
    ];

    const model = generateModel(outcome, treatment, 'total', conditionOn, false);

    expect(model.brmsCode).toContain('divorce_rate ~ marriage_rate + age_at_marriage + south');
    expect(model.family).toBe('gaussian()');
  });

  it('South → Divorce Rate formula (no controls)', () => {
    const outcome = getVariable(dag, 'v_divorce');
    const treatment = getVariable(dag, 'v_south');

    const model = generateModel(outcome, treatment, 'total', [], false);

    expect(model.brmsCode).toContain('divorce_rate ~ south');
    expect(model.family).toBe('gaussian()');
  });
});
