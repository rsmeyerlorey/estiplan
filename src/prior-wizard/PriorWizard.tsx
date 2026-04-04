/**
 * PriorWizard — embeddable component for setting Bayesian priors step by step.
 *
 * Standalone: <PriorWizard persist />
 * Embedded in Estiplan: <PriorWizard embedded outcomeFamily="gaussian" outcomeName="elev" treatmentName="rain" onPriorsReady={...} />
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import {
  FAMILIES,
  INITIAL_STATE,
  type WizardState,
  type OutcomeFamily,
  type VariableDescription,
  type DataScale,
  computeScaledPriors,
} from './lib/types';
import { StepZero } from './components/StepZero';
import { StepFamily } from './components/StepFamily';
import { StepStandardPriors } from './components/StepStandardPriors';
import { StepDescribe } from './components/StepDescribe';
import { StepThreeWays } from './components/StepThreeWays';
import { StepDispersion } from './components/StepDispersion';

// ── Public types ──

export interface PriorResult {
  interceptMean: number;
  interceptSD: number;
  slopeMean: number;
  slopeSD: number;
  dispersionRate?: number;
  scale: DataScale;
  family: OutcomeFamily;
  brmsCode: string;
}

export interface PriorWizardProps {
  /** Pre-fill outcome variable name (from Estiplan estimand) */
  outcomeName?: string;
  /** Pre-fill treatment variable name (from Estiplan estimand) */
  treatmentName?: string;
  /** Pre-fill outcome family (from Estiplan variable type) */
  outcomeFamily?: OutcomeFamily;

  /** Called when user clicks "Use these priors" with the final prior values */
  onPriorsReady?: (priors: PriorResult) => void;

  /** Suppress header, use fluid width (for side panel embedding) */
  embedded?: boolean;
  /** Enable localStorage persistence (default: true for standalone, false for embedded) */
  persist?: boolean;
}

// ── Storage ──

const STORAGE_KEY = 'prior-wizard-state';

function loadSavedState(): WizardState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_STATE;
    const parsed = JSON.parse(raw);
    if (parsed.outcome && parsed.treatment) {
      return { ...INITIAL_STATE, ...parsed };
    }
    return INITIAL_STATE;
  } catch {
    return INITIAL_STATE;
  }
}

function buildInitialState(props: PriorWizardProps): WizardState {
  // Start from persisted state if persistence is enabled, otherwise fresh
  const shouldPersist = props.persist ?? !props.embedded;
  const base = shouldPersist ? loadSavedState() : INITIAL_STATE;

  // Apply pre-fill props (override saved state)
  return {
    ...base,
    ...(props.outcomeFamily != null && { family: props.outcomeFamily }),
    outcome: {
      ...base.outcome,
      ...(props.outcomeName != null && { name: props.outcomeName }),
    },
    treatment: {
      ...base.treatment,
      ...(props.treatmentName != null && { name: props.treatmentName }),
    },
  };
}

// ── Helper functions ──

function fmt(n: number, decimals: number = 2): string {
  return Number(n.toFixed(decimals)).toString();
}

/** Standard default priors per link type */
function getStandardDefaults(link: string): {
  interceptMean: number;
  interceptSD: number;
  slopeMean: number;
  slopeSD: number;
  interceptClass: string;
} {
  const interceptClass = 'Intercept';
  if (link === 'logit') {
    return { interceptMean: 0, interceptSD: 1.5, slopeMean: 0, slopeSD: 1, interceptClass };
  }
  if (link === 'log') {
    return { interceptMean: 0, interceptSD: 1, slopeMean: 0, slopeSD: 0.5, interceptClass };
  }
  return { interceptMean: 0, interceptSD: 0.5, slopeMean: 0, slopeSD: 0.5, interceptClass };
}

/** Build brms code from prior values */
function buildBrmsCode(
  interceptMean: number,
  interceptSD: number,
  slopeMean: number,
  slopeSD: number,
  dispersionRate: number,
  info: { brmsFamily: string; hasDispersion: boolean; dispersionParam?: string },
  outcomeName: string,
  treatmentName: string,
  scaleNote: string,
  interceptClass: string,
): string {
  const interceptPrior = `normal(${fmt(interceptMean)}, ${fmt(interceptSD)})`;
  const slopePrior = `normal(${fmt(slopeMean)}, ${fmt(slopeSD)})`;
  const dispersionPrior = info.hasDispersion
    ? `exponential(${fmt(dispersionRate)})`
    : null;

  const priorLines = [
    `  set_prior("${interceptPrior}", class = "${interceptClass}")`,
    `  set_prior("${slopePrior}", class = "b")`,
  ];
  if (dispersionPrior && info.dispersionParam) {
    priorLines.push(
      `  set_prior("${dispersionPrior}", class = "${info.dispersionParam}")`,
    );
  }

  return [
    `${scaleNote}prior <- c(`,
    priorLines.join(',\n'),
    `)`,
    ``,
    `model <- brm(`,
    `  ${outcomeName} ~ ${treatmentName},`,
    `  data = d,`,
    `  family = ${info.brmsFamily},`,
    `  prior = prior`,
    `)`,
  ].join('\n');
}

// ── Main component ──

export function PriorWizard(props: PriorWizardProps) {
  const {
    onPriorsReady,
    embedded = false,
    persist = !embedded,
  } = props;

  // Pre-fill flags: which fields came from props?
  const hasPrefilledFamily = props.outcomeFamily != null;
  const hasPrefilledNames = props.outcomeName != null || props.treatmentName != null;

  const [state, setState] = useState<WizardState>(() => buildInitialState(props));

  // Auto-save to localStorage (500ms debounce) — only when persist is enabled
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    if (!persist) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }, 500);
    return () => clearTimeout(saveTimer.current);
  }, [state, persist]);

  // ── Update helpers ──

  const setOutcomeName = useCallback((name: string) => {
    setState((s) => ({
      ...s,
      outcome: { ...s.outcome, name },
      standardPriorsViewed: false,
      variablesDescribed: false,
      chosenScale: null,
      chosenInterceptSD: null,
    }));
  }, []);

  const setTreatmentName = useCallback((name: string) => {
    setState((s) => ({
      ...s,
      treatment: { ...s.treatment, name },
      standardPriorsViewed: false,
      variablesDescribed: false,
      chosenScale: null,
      chosenInterceptSD: null,
    }));
  }, []);

  const setFamily = useCallback((family: OutcomeFamily) => {
    setState((s) => ({
      ...s,
      family,
      standardPriorsViewed: false,
      variablesDescribed: false,
      chosenScale: null,
      chosenInterceptSD: null,
    }));
  }, []);

  const viewStandardPriors = useCallback(() => {
    setState((s) => ({ ...s, standardPriorsViewed: true }));
  }, []);

  const setOutcome = useCallback((outcome: VariableDescription) => {
    setState((s) => ({ ...s, outcome, variablesDescribed: false, chosenScale: null, chosenInterceptSD: null }));
  }, []);

  const setTreatment = useCallback((treatment: VariableDescription) => {
    setState((s) => ({ ...s, treatment, variablesDescribed: false, chosenScale: null, chosenInterceptSD: null }));
  }, []);

  const setEffectTx = useCallback((v: number) => {
    setState((s) => ({ ...s, effectChangeInTreatment: v, variablesDescribed: false, chosenScale: null, chosenInterceptSD: null }));
  }, []);

  const setEffectOut = useCallback((v: number) => {
    setState((s) => ({ ...s, effectChangeInOutcome: v, variablesDescribed: false, chosenScale: null, chosenInterceptSD: null }));
  }, []);

  const setEffectAfter = useCallback((v: number) => {
    setState((s) => ({ ...s, effectOutcomeAfter: v, variablesDescribed: false, chosenScale: null, chosenInterceptSD: null }));
  }, []);

  // Effect updates from Step 4 — don't reset variablesDescribed (would hide the step)
  const updateEffectTx = useCallback((v: number) => {
    setState((s) => ({ ...s, effectChangeInTreatment: v }));
  }, []);

  const updateEffectOut = useCallback((v: number) => {
    setState((s) => ({ ...s, effectChangeInOutcome: v }));
  }, []);

  const updateEffectOutLo = useCallback((v: number) => {
    setState((s) => ({ ...s, effectOutcomeLo: v }));
  }, []);

  const updateEffectOutHi = useCallback((v: number) => {
    setState((s) => ({ ...s, effectOutcomeHi: v }));
  }, []);

  const updateEffectAfter = useCallback((v: number) => {
    setState((s) => ({ ...s, effectOutcomeAfter: v }));
  }, []);

  const updateEffectAfterLo = useCallback((v: number) => {
    setState((s) => ({ ...s, effectAfterLo: v }));
  }, []);

  const updateEffectAfterHi = useCallback((v: number) => {
    setState((s) => ({ ...s, effectAfterHi: v }));
  }, []);

  const confirmVariables = useCallback(() => {
    setState((s) => ({ ...s, variablesDescribed: true }));
  }, []);

  const chooseScale = useCallback((scale: DataScale, interceptSD?: number) => {
    setState((s) => ({ ...s, chosenScale: scale, chosenInterceptSD: interceptSD ?? null }));
  }, []);

  const setDispersionRate = useCallback((v: number) => {
    setState((s) => ({ ...s, dispersionRate: v }));
  }, []);

  const handleReset = useCallback(() => {
    // When embedded with pre-fill, reset back to pre-filled values
    setState(buildInitialState(props));
    if (persist) {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [persist, props]);

  // ── Determine which steps to show ──

  const showStandardPriors = state.family !== null;
  const showDescribe = showStandardPriors && state.standardPriorsViewed;
  const showThreeWays = showDescribe && state.variablesDescribed;
  const showDispersion =
    showThreeWays &&
    state.chosenScale !== null &&
    state.family !== null &&
    FAMILIES[state.family].hasDispersion;
  const showSummary = showThreeWays && state.chosenScale !== null;

  return (
    <div className={embedded ? 'prior-wizard-embedded' : 'app'}>
      {/* Header — standalone only */}
      {!embedded && (
        <header className="app-header">
          <h1 className="app-title">Prior Wizard</h1>
          <p className="app-subtitle">
            Set Bayesian priors step by step. Understand what every number
            means. Build intuition for your model.
          </p>
        </header>
      )}

      {/* Step 0: Name your variables */}
      <StepZero
        outcomeName={state.outcome.name}
        treatmentName={state.treatment.name}
        onOutcomeNameChange={setOutcomeName}
        onTreatmentNameChange={setTreatmentName}
        locked={hasPrefilledNames && embedded}
      />

      {/* Step 1: Family */}
      <StepFamily
        value={state.family}
        onChange={setFamily}
        locked={hasPrefilledFamily && embedded}
      />

      {/* Step 2: Standard priors */}
      {showStandardPriors && (
        <StepStandardPriors
          family={state.family!}
          outcomeName={state.outcome.name}
          treatmentName={state.treatment.name}
          onContinue={viewStandardPriors}
        />
      )}

      {/* Step 3: Describe variables (Understand & Adjust) */}
      {showDescribe && (
        <StepDescribe
          family={state.family}
          outcome={state.outcome}
          treatment={state.treatment}
          effectChangeInTreatment={state.effectChangeInTreatment}
          effectChangeInOutcome={state.effectChangeInOutcome}
          effectOutcomeAfter={state.effectOutcomeAfter}
          onOutcomeChange={setOutcome}
          onTreatmentChange={setTreatment}
          onEffectTxChange={setEffectTx}
          onEffectOutChange={setEffectOut}
          onEffectAfterChange={setEffectAfter}
          onConfirm={confirmVariables}
        />
      )}

      {/* Step 4: Three-way comparison */}
      {showThreeWays && (
        <StepThreeWays
          state={state}
          onChooseScale={chooseScale}
          onEffectTxChange={updateEffectTx}
          onEffectOutChange={updateEffectOut}
          onEffectOutLoChange={updateEffectOutLo}
          onEffectOutHiChange={updateEffectOutHi}
          onEffectAfterChange={updateEffectAfter}
          onEffectAfterLoChange={updateEffectAfterLo}
          onEffectAfterHiChange={updateEffectAfterHi}
        />
      )}

      {/* Step 5: Dispersion */}
      {showDispersion && (
        <StepDispersion
          family={state.family!}
          rate={state.dispersionRate}
          onRateChange={setDispersionRate}
        />
      )}

      {/* Step 6: Summary — choose standard vs adjusted */}
      {showSummary && (
        <SummaryStep state={state} onPriorsReady={onPriorsReady} />
      )}

      {/* Reset */}
      {state.family && (
        <div className="nav-row">
          <button className="btn btn-secondary" onClick={handleReset}>
            Start Over
          </button>
        </div>
      )}
    </div>
  );
}

// ── Summary step (Step 6) ──

function SummaryStep({
  state,
  onPriorsReady,
}: {
  state: WizardState;
  onPriorsReady?: (priors: PriorResult) => void;
}) {
  if (!state.family || !state.chosenScale) return null;

  const allPriors = computeScaledPriors(state);
  const basePriors = allPriors[state.chosenScale];
  const priors = state.chosenInterceptSD != null
    ? { ...basePriors, interceptSD: state.chosenInterceptSD }
    : basePriors;
  const info = FAMILIES[state.family];
  const link = info.link;

  const outcomeName = state.outcome.name || 'outcome';
  const treatmentName = state.treatment.name || 'treatment';

  // Standard defaults always assume standardized data
  const defaults = getStandardDefaults(link);
  const defaultDispersionRate = 1;
  const standardScaleNote = '# Standard priors assume standardized predictors\n';

  const standardBrmsCode = buildBrmsCode(
    defaults.interceptMean, defaults.interceptSD,
    defaults.slopeMean, defaults.slopeSD,
    defaultDispersionRate,
    info, outcomeName, treatmentName, standardScaleNote, defaults.interceptClass,
  );

  // Adjusted priors — use the scale the user actually chose
  const adjustedScaleNote = state.chosenScale === 'standardized'
    ? '# Using standardized predictors\n'
    : state.chosenScale === 'centered'
      ? '# Using centered predictors\n'
      : '';

  const adjustedBrmsCode = buildBrmsCode(
    priors.interceptMean, priors.interceptSD,
    priors.slopeMean, priors.slopeSD,
    state.dispersionRate,
    info, outcomeName, treatmentName, adjustedScaleNote, defaults.interceptClass,
  );

  const interceptPrior = `normal(${fmt(priors.interceptMean)}, ${fmt(priors.interceptSD)})`;
  const slopePrior = `normal(${fmt(priors.slopeMean)}, ${fmt(priors.slopeSD)})`;
  const dispersionPrior = info.hasDispersion
    ? `exponential(${fmt(state.dispersionRate)})`
    : null;

  // Check if adjusted differs from standard defaults
  const priorsMatch =
    priors.interceptMean === defaults.interceptMean &&
    Math.abs(priors.interceptSD - defaults.interceptSD) < 0.001 &&
    priors.slopeMean === defaults.slopeMean &&
    Math.abs(priors.slopeSD - defaults.slopeSD) < 0.001 &&
    (!info.hasDispersion || Math.abs(state.dispersionRate - defaultDispersionRate) < 0.001);

  const handleUseStandard = () => {
    onPriorsReady?.({
      interceptMean: defaults.interceptMean,
      interceptSD: defaults.interceptSD,
      slopeMean: defaults.slopeMean,
      slopeSD: defaults.slopeSD,
      dispersionRate: info.hasDispersion ? defaultDispersionRate : undefined,
      scale: 'standardized',
      family: state.family!,
      brmsCode: standardBrmsCode,
    });
  };

  const handleUseAdjusted = () => {
    onPriorsReady?.({
      interceptMean: priors.interceptMean,
      interceptSD: priors.interceptSD,
      slopeMean: priors.slopeMean,
      slopeSD: priors.slopeSD,
      dispersionRate: info.hasDispersion ? state.dispersionRate : undefined,
      scale: state.chosenScale!,
      family: state.family!,
      brmsCode: adjustedBrmsCode,
    });
  };

  const cardStyle = {
    padding: '16px 20px',
    background: 'var(--pw-surface-raised)',
    border: '1px solid var(--pw-border)',
    borderRadius: 'var(--pw-radius)',
    marginBottom: 12,
  };

  return (
    <div className="wizard-step">
      <div className="step-header">
        <span className="step-number">6</span>
        <span className="step-title">Choose your priors</span>
      </div>

      <p className="step-description">
        You have explored what the standard priors mean for your data.
        Now choose whether to use the widely accepted defaults or your adjusted values.
      </p>

      {/* Standard defaults */}
      <div style={{ ...cardStyle, borderLeft: '4px solid var(--pw-green)' }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--pw-text)', marginBottom: 4 }}>
          Use standard defaults <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--pw-text-muted)' }}>(recommended for most analyses)</span>
        </div>
        <div className="form-guidance" style={{ marginBottom: 12 }}>
          For most analyses, these defaults are preferable to hand-tuned priors.
          They are intentionally broad and let the data do the work.
          These are the same priors used across the Bayesian modeling community.
        </div>
        <pre className="code-output">{standardBrmsCode}</pre>
        {onPriorsReady && (
          <button
            className="btn btn-primary"
            style={{ marginTop: 12, background: 'var(--pw-green)', borderColor: 'var(--pw-green)', width: '100%' }}
            onClick={handleUseStandard}
          >
            Use standard priors
          </button>
        )}
      </div>

      {/* Adjusted priors */}
      <div style={{ ...cardStyle, borderLeft: '4px solid var(--pw-accent)' }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--pw-text)', marginBottom: 4 }}>
          Use your adjusted priors
          {priorsMatch && (
            <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--pw-text-muted)', marginLeft: 8 }}>
              (same as defaults)
            </span>
          )}
        </div>
        <div className="form-guidance" style={{ marginBottom: 12 }}>
          Based on your domain knowledge about {outcomeName} and {treatmentName}.
          {priorsMatch
            ? ' Your adjustments match the standard defaults.'
            : ' These reflect the beliefs you encoded in the previous steps.'}
        </div>
        <pre className="code-output">{adjustedBrmsCode}</pre>
        {onPriorsReady && (
          <button
            className="btn btn-primary"
            style={{ marginTop: 12, width: '100%' }}
            onClick={handleUseAdjusted}
          >
            Use adjusted priors
          </button>
        )}
      </div>

      {/* Detailed prior breakdown */}
      <div className="summary-card" style={{ marginTop: 8 }}>
        <div className="summary-title">
          Your adjusted priors ({priors.label})
        </div>

        <div className="prior-row">
          <span className="prior-param">
            {state.family === 'cumulative'
              ? '\u03c4 (thresholds)'
              : state.family === 'categorical'
                ? '\u03b1 (category intercepts)'
                : '\u03b1 (intercept)'}
          </span>
          <span className="prior-dist">{interceptPrior}</span>
        </div>

        <div className="prior-row">
          <span className="prior-param">
            &beta; ({treatmentName})
          </span>
          <span className="prior-dist">{slopePrior}</span>
        </div>

        {dispersionPrior && info.dispersionParam && (
          <div className="prior-row">
            <span className="prior-param">
              {info.dispersionParam === 'sigma' ? '\u03c3' : '\u03c6'}{' '}
              ({info.dispersionParam})
            </span>
            <span className="prior-dist">{dispersionPrior}</span>
          </div>
        )}
      </div>
    </div>
  );
}
