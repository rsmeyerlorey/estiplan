import { useState, useEffect, useMemo } from 'react';
import {
  type WizardState,
  type DataScale,
  computeScaledPriors,
  estimateSD,
} from '../lib/types';
import { fmt, normalInterval95, logistic, logit } from '../lib/distributions';
import { DistCurve } from './DistCurve';
import { NumberInput } from './NumberInput';

interface Props {
  state: WizardState;
  onChooseScale: (scale: DataScale, interceptSD?: number) => void;
  onEffectTxChange: (v: number) => void;
  onEffectOutChange: (v: number) => void;
  onEffectOutLoChange: (v: number) => void;
  onEffectOutHiChange: (v: number) => void;
  onEffectAfterChange: (v: number) => void;
  onEffectAfterLoChange: (v: number) => void;
  onEffectAfterHiChange: (v: number) => void;
}

const SCALES: DataScale[] = ['natural', 'centered', 'standardized'];

const SCALE_COLORS: Record<DataScale, string> = {
  natural: 'var(--pw-orange)',
  centered: 'var(--pw-accent)',
  standardized: 'var(--pw-green)',
};

function getWhenToUse(scale: DataScale, link: string): string {
  if (scale === 'natural') {
    return 'Only use when you want predictions in original units, AND zero is a meaningful value for your predictors, AND your treatment and outcome variables are at a similar scale. Models may not fit well if variable scales differ widely. Your intercept may be an extrapolation if treatment = 0 doesn\u2019t make sense.';
  }
  if (scale === 'centered') {
    return 'Use when you want slopes in natural units but a meaningful intercept. The intercept becomes the expected outcome at the average predictor value \u2014 almost always more interpretable.';
  }
  // standardized
  if (link === 'identity') {
    return 'You should almost always standardize your data. Models typically fit more easily, you do not have to worry about unit scaling, and you can convert back to natural units whenever you want. With everything measured in SD (Standard Deviation) units, it is easier to directly compare effects across predictors and explore data. You can also typically just use widely accepted "standard priors." For example, a standard prior like Normal(0, 0.5) means: "with the treatment variable at its mean, I expect the outcome variable to be within 1 SD of its mean."';
  }
  return 'You should almost always standardize your predictors. Models typically fit more easily and effects become comparable across predictors with different units. Only predictors are standardized \u2014 the outcome stays on the link scale (logit or log). The slope becomes "change in log-odds (or log-value) per 1-SD change in the predictor." You can convert back to natural units whenever you want.';
}

function getDataPrep(scale: DataScale, link: string): string {
  if (scale === 'natural') {
    return '# No transformation needed\nd <- your_data';
  }
  if (scale === 'centered') {
    return '# Subtract the mean from each predictor\nd <- your_data\nd$treatment_c <- d$treatment - mean(d$treatment)';
  }
  // standardized
  if (link === 'identity') {
    return '# Center and scale predictors (and optionally outcome)\nd <- your_data\nd$treatment_s <- scale(d$treatment)\nd$outcome_s <- scale(d$outcome)  # optional for gaussian';
  }
  return '# Standardize predictors only (outcome stays as-is)\nd <- your_data\nd$treatment_s <- scale(d$treatment)';
}

/** Step 3: Your priors, three ways */
export function StepThreeWays({ state, onChooseScale, onEffectTxChange, onEffectOutChange, onEffectOutLoChange, onEffectOutHiChange, onEffectAfterChange, onEffectAfterLoChange, onEffectAfterHiChange }: Props) {
  const allPriors = computeScaledPriors(state);
  const link = state.family
    ? { gaussian: 'identity', lognormal: 'log', beta: 'logit', bernoulli: 'logit', poisson: 'log', cumulative: 'logit', categorical: 'logit' }[state.family] as string
    : 'identity';

  // Interactive ±range for intercept (identity link only)
  const [ranges, setRanges] = useState<Record<DataScale, number>>({
    natural: 2 * allPriors.natural.interceptSD,
    centered: 2 * allPriors.centered.interceptSD,
    standardized: 2 * allPriors.standardized.interceptSD,
  });
  useEffect(() => {
    setRanges({
      natural: 2 * allPriors.natural.interceptSD,
      centered: 2 * allPriors.centered.interceptSD,
      standardized: 2 * allPriors.standardized.interceptSD,
    });
  }, [allPriors.natural.interceptSD, allPriors.centered.interceptSD, allPriors.standardized.interceptSD]);

  // ── Standardized card: independent local state with standard-prior defaults ──
  // We can't reliably convert natural-unit inputs to SDs without real data,
  // so the standardized card starts with known standard-prior defaults and
  // lets the user adjust independently.

  const isThreshold = state.family === 'cumulative' || state.family === 'categorical';

  const [stdEffects, setStdEffects] = useState(() => {
    if (link === 'logit') {
      // Normal(0, 1) slope: base 0.5, range ±2 logit units
      const base = isThreshold ? 0.5 : Math.max(0.01, Math.min(0.99, state.outcome.mean || 0.5));
      return {
        tx: 1, out: 0, outLo: -1, outHi: 1,
        after: base,
        afterLo: logistic(logit(base) - 2),
        afterHi: logistic(logit(base) + 2),
      };
    }
    if (link === 'log') {
      // Normal(0, 0.5) slope: base value, range ±1 log unit
      const base = Math.max(0.01, state.outcome.mean || 1);
      return {
        tx: 1, out: 0, outLo: -1, outHi: 1,
        after: base,
        afterLo: base * Math.exp(-1),
        afterHi: base * Math.exp(1),
      };
    }
    // Identity: Normal(0, 0.5) slope: 1 SD tx → 0 SD out, plausible ±1 SD
    return { tx: 1, out: 0, outLo: -1, outHi: 1, after: 0, afterLo: 0, afterHi: 0 };
  });

  // Compute slope prior from standardized local state
  const stdSlope = useMemo(() => {
    const tx = stdEffects.tx || 1;
    if (link === 'identity') {
      const mean = stdEffects.out / tx;
      const slopeAtLo = stdEffects.outLo / tx;
      const slopeAtHi = stdEffects.outHi / tx;
      const sd = slopeAtHi > slopeAtLo ? (slopeAtHi - slopeAtLo) / 4 : 0.5;
      return { mean, sd };
    }
    if (link === 'logit') {
      const clamp = (p: number) => Math.max(0.001, Math.min(0.999, p));
      const base = isThreshold ? 0.5 : clamp(state.outcome.mean || 0.5);
      const logitBase = logit(base);
      const mean = (logit(clamp(stdEffects.after)) - logitBase) / tx;
      const slopeAtLo = (logit(clamp(stdEffects.afterLo)) - logitBase) / tx;
      const slopeAtHi = (logit(clamp(stdEffects.afterHi)) - logitBase) / tx;
      const sd = slopeAtHi > slopeAtLo ? (slopeAtHi - slopeAtLo) / 4 : 1;
      return { mean, sd };
    }
    // log
    const base = Math.max(0.01, state.outcome.mean || 1);
    const logBase = Math.log(base);
    const mean = (Math.log(Math.max(0.01, stdEffects.after)) - logBase) / tx;
    const slopeAtLo = (Math.log(Math.max(0.01, stdEffects.afterLo)) - logBase) / tx;
    const slopeAtHi = (Math.log(Math.max(0.01, stdEffects.afterHi)) - logBase) / tx;
    const sd = slopeAtHi > slopeAtLo ? (slopeAtHi - slopeAtLo) / 4 : 0.5;
    return { mean, sd };
  }, [stdEffects, link, isThreshold, state.outcome.mean]);

  const txName = state.treatment.name || 'treatment';
  const outName = state.outcome.name || 'outcome';
  const txMean = state.treatment.mean;

  return (
    <div className="wizard-step">
      <div className="step-header">
        <span className="step-number">4</span>
        <span className="step-title">Your priors, three ways</span>
      </div>
      <p className="step-description">
        How you treat your data changes how you express your priors.
        Below are three representations of the same
        knowledge about {state.outcome.name || 'the outcome'} and{' '}
        {state.treatment.name || 'the treatment'}. Pick the one that fits
        your workflow.
      </p>

      <div
        className="form-guidance"
        style={{
          marginBottom: 16,
          padding: '10px 14px',
          background: 'var(--pw-surface-raised)',
          borderRadius: 6,
          borderLeft: '3px solid var(--pw-accent)',
        }}
      >
        <strong>Reading a prior:</strong> Normal(mean, SD) means &ldquo;I expect
        the true value to be near <em>mean</em>, and 95% of my belief falls
        within &plusmn;2 &times; SD (Standard Deviation).&rdquo; So Normal(0, 5) says
        the value is most likely near 0, but could plausibly be anywhere from
        &minus;10 to +10. The SD controls how confident you are &mdash; smaller
        SD = tighter belief. In Bayesian modeling, it is generally good to set
        wider SDs &mdash; this lets your real data tighten the estimates as it
        informs the model.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {SCALES.map((scale) => {
          const priors = allPriors[scale];
          const color = SCALE_COLORS[scale];
          // For identity link, use the user's interactive ±range for interceptSD
          const effectiveIntSD = link === 'identity'
            ? ranges[scale] / 2
            : priors.interceptSD;
          const [intLo, intHi] = normalInterval95(priors.interceptMean, effectiveIntSD);

          // For standardized card: use independent local slope values
          const effectiveSlopeMean = scale === 'standardized' ? stdSlope.mean : priors.slopeMean;
          const effectiveSlopeSD = scale === 'standardized' ? stdSlope.sd : priors.slopeSD;
          const [slopeLo, slopeHi] = normalInterval95(effectiveSlopeMean, effectiveSlopeSD);

          return (
            <div
              key={scale}
              style={{
                background: 'var(--pw-surface-raised)',
                border: `1px solid var(--pw-border)`,
                borderLeft: `4px solid ${color}`,
                borderRadius: 'var(--pw-radius)',
                padding: '20px 24px',
              }}
            >
              {/* Header */}
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: 'var(--pw-text)',
                  marginBottom: 4,
                }}
              >
                {priors.label}
              </div>

              {/* Scale-specific subtitle for logit/log links */}
              {scale === 'standardized' && link !== 'identity' && (
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: color,
                    marginBottom: 8,
                    letterSpacing: 0.2,
                    textTransform: 'uppercase',
                  }}
                >
                  Outcome stays on {link} scale &middot; predictors in SD units
                </div>
              )}

              {/* When to use — right under header */}
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--pw-text-muted)',
                  lineHeight: 1.5,
                  padding: '8px 12px',
                  background: 'var(--pw-surface)',
                  borderRadius: 6,
                  marginBottom: 16,
                }}
              >
                <strong style={{ color }}>When to use: </strong>
                {getWhenToUse(scale, link)}
              </div>

              {/* Intercept */}
              <PriorDisplay
                paramLabel={
                  state.family === 'cumulative'
                    ? '\u03c4 (thresholds)'
                    : state.family === 'categorical'
                      ? '\u03b1 (category intercepts)'
                      : '\u03b1 (intercept)'
                }
                priorStr={`Normal(${fmt(priors.interceptMean)}, ${fmt(effectiveIntSD)})`}
                explanation={priors.interceptExplanation}
                lo={intLo}
                hi={intHi}
                mean={priors.interceptMean}
                sd={effectiveIntSD}
                link={link}
                isSlope={false}
                scale={scale}
              />

              {/* Interactive intercept input */}
              {link === 'identity' ? (
                <div style={{
                  fontSize: 13,
                  color: 'var(--pw-text)',
                  lineHeight: 2,
                  padding: '8px 12px',
                  background: 'var(--pw-surface)',
                  borderRadius: 6,
                  marginBottom: 12,
                  borderLeft: `3px solid ${color}`,
                }}>
                  {'When '}
                  <strong>{txName}</strong>
                  {' is '}
                  {scale === 'natural' ? (
                    <strong>0</strong>
                  ) : (
                    <>{'at its average ('}<strong>{fmt(txMean)}</strong>{')'}</>
                  )}
                  {', I expect '}
                  <strong>{outName}</strong>
                  {' to be within \u00b1'}
                  <input
                    type="number"
                    className="text-input"
                    step="any"
                    value={ranges[scale] || ''}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (!isNaN(v) && v > 0) {
                        setRanges(prev => ({ ...prev, [scale]: v }));
                      } else if (e.target.value === '') {
                        setRanges(prev => ({ ...prev, [scale]: 0 }));
                      }
                    }}
                    style={{ width: 72, textAlign: 'center', margin: '0 4px', display: 'inline-block' }}
                  />
                  {scale === 'standardized' ? (
                    ' standard deviation(s) of its mean.'
                  ) : (
                    <>{' of '}<strong>{fmt(priors.interceptMean)}</strong>{'.'}</>
                  )}
                  <div style={{ fontSize: 11, color: 'var(--pw-text-muted)', marginTop: 2 }}>
                    {'This sets the intercept prior to Normal('}
                    {fmt(priors.interceptMean)}{', '}{fmt(effectiveIntSD)}
                    {') \u2014 SD = \u00b1range / 2 = '}{fmt(effectiveIntSD)}{'.'}
                  </div>
                  {scale === 'standardized' && (
                    <div style={{ fontSize: 11, color: 'var(--pw-text-muted)', marginTop: 8,
                      padding: '6px 10px', background: 'var(--pw-surface-raised)', borderRadius: 4 }}>
                      <strong style={{ color }}>Common default:</strong> Normal(0, 0.5) — when
                      predictors are at their average, the outcome is within 1 SD of its mean.
                      This works because after standardizing, 0 is the mean by construction.
                    </div>
                  )}
                </div>
              ) : (
                <InterceptEditorLinkScale
                  link={link}
                  scale={scale}
                  color={color}
                  txName={txName}
                  outName={outName}
                  txMean={txMean}
                  state={state}
                  priors={priors}
                  effectiveIntSD={effectiveIntSD}
                  ranges={ranges}
                  setRanges={setRanges}
                />
              )}

              {/* Slope */}
              <PriorDisplay
                paramLabel={`\u03b2 (${state.treatment.name || 'slope'})`}
                priorStr={`Normal(${fmt(effectiveSlopeMean)}, ${fmt(effectiveSlopeSD)})`}
                explanation={scale === 'standardized'
                  ? priors.slopeExplanation
                  : priors.slopeExplanation}
                lo={slopeLo}
                hi={slopeHi}
                mean={effectiveSlopeMean}
                sd={effectiveSlopeSD}
                link={link}
                isSlope={true}
                scale={scale}
              />

              {/* Editable expected effect — below slope */}
              {scale === 'standardized' ? (
                <StandardizedEffectEditor
                  link={link}
                  color={color}
                  txName={txName}
                  outName={outName}
                  family={state.family}
                  stdEffects={stdEffects}
                  onStdEffectsChange={setStdEffects}
                  baseProbOrValue={
                    link === 'logit'
                      ? (isThreshold ? 0.5 : Math.max(0.01, Math.min(0.99, state.outcome.mean || 0.5)))
                      : link === 'log'
                        ? Math.max(0.01, state.outcome.mean || 1)
                        : 0
                  }
                />
              ) : (
                <EffectEditor
                  link={link}
                  scale={scale}
                  color={color}
                  txName={txName}
                  outName={outName}
                  state={state}
                  txSD={estimateSD(state.treatment)}
                  outSD={estimateSD(state.outcome)}
                  onEffectTxChange={onEffectTxChange}
                  onEffectOutChange={onEffectOutChange}
                  onEffectOutLoChange={onEffectOutLoChange}
                  onEffectOutHiChange={onEffectOutHiChange}
                  onEffectAfterChange={onEffectAfterChange}
                  onEffectAfterLoChange={onEffectAfterLoChange}
                  onEffectAfterHiChange={onEffectAfterHiChange}
                />
              )}

              {/* Common defaults for standardized logit/log */}
              {scale === 'standardized' && link === 'logit' && (
                <div style={{ fontSize: 11, color: 'var(--pw-text-muted)', marginTop: 8,
                  padding: '6px 10px', background: 'var(--pw-surface-raised)', borderRadius: 4 }}>
                  <strong style={{ color }}>Common defaults:</strong>{' '}
                  α ~ Normal(0, 1.5) assigns roughly equal probability across outcomes.{' '}
                  β ~ Normal(0, 0.5) assumes small effects on the log-odds scale.
                  These are widely used starting points when you have little prior knowledge.
                </div>
              )}
              {scale === 'standardized' && link === 'log' && (
                <div style={{ fontSize: 11, color: 'var(--pw-text-muted)', marginTop: 8,
                  padding: '6px 10px', background: 'var(--pw-surface-raised)', borderRadius: 4 }}>
                  <strong style={{ color }}>Common defaults:</strong>{' '}
                  β ~ Normal(0, 0.5) on the log scale means a 1-SD change in the
                  predictor multiplies the outcome by at most e^1 ≈ 2.7×.
                  Use wider SD if you expect large multiplicative effects.
                </div>
              )}

              {/* Data prep code */}
              <pre
                className="code-output"
                style={{ marginTop: 8, fontSize: 11 }}
              >
                {getDataPrep(scale, link)}
              </pre>

              {/* Choose button */}
              <button
                className="btn btn-primary"
                style={{
                  marginTop: 12,
                  background: color,
                  borderColor: color,
                  width: '100%',
                }}
                onClick={() => onChooseScale(
                  scale,
                  link === 'identity' ? effectiveIntSD : undefined,
                )}
              >
                Use {priors.label.toLowerCase()}
              </button>
            </div>
          );
        })}
      </div>

      {/* Conversion explorer removed — approximating SD from plausible range
         isn't accurate enough to convert between scales honestly. The three
         side-by-side cards already let users compare. */}
    </div>
  );
}


/** Interactive intercept editor for logit/log links */
function InterceptEditorLinkScale({
  link,
  scale,
  color,
  txName,
  outName,
  txMean,
  state,
  priors,
  effectiveIntSD,
  ranges,
  setRanges,
}: {
  link: string;
  scale: DataScale;
  color: string;
  txName: string;
  outName: string;
  txMean: number;
  state: WizardState;
  priors: { interceptMean: number; interceptSD: number };
  effectiveIntSD: number;
  ranges: Record<DataScale, number>;
  setRanges: React.Dispatch<React.SetStateAction<Record<DataScale, number>>>;
}) {
  const family = state.family;
  const isThreshold = family === 'cumulative' || family === 'categorical';

  // For thresholds, intercepts are fixed defaults — explain why
  if (isThreshold) {
    return (
      <div style={{
        fontSize: 12,
        color: 'var(--pw-text-muted)',
        lineHeight: 1.6,
        padding: '8px 12px',
        background: 'var(--pw-surface)',
        borderRadius: 6,
        marginBottom: 12,
        borderLeft: `3px solid ${color}`,
      }}>
        <span style={{ marginRight: 6 }} aria-hidden="true">&#x1F512;</span>
        <strong>Why can't I edit the intercept?</strong>{' '}
        {family === 'cumulative'
          ? 'Ordinal models use threshold (cut-point) intercepts between adjacent categories. '
            + 'Normal(0, 1.5) assigns roughly equal probability to each category before seeing data. '
            + 'The model learns the actual thresholds from your data.'
          : 'Categorical models have one intercept per non-reference category. '
            + 'Normal(0, 1.5) says no category is strongly favored a priori. '
            + 'The model learns category probabilities from your data.'}
      </div>
    );
  }

  // For logit (bernoulli/beta) and log (lognormal/poisson):
  // Show natural-unit values that map to the link scale
  const [intLo, intHi] = [priors.interceptMean - 2 * effectiveIntSD, priors.interceptMean + 2 * effectiveIntSD];

  if (link === 'logit') {
    const loProb = logistic(intLo);
    const hiProb = logistic(intHi);
    return (
      <div style={{
        fontSize: 13,
        color: 'var(--pw-text)',
        lineHeight: 2,
        padding: '8px 12px',
        background: 'var(--pw-surface)',
        borderRadius: 6,
        marginBottom: 12,
        borderLeft: `3px solid ${color}`,
      }}>
        {'When '}
        <strong>{txName}</strong>
        {' is '}
        {scale === 'natural' ? (
          <strong>0</strong>
        ) : (
          <>{'at its average ('}<strong>{fmt(txMean)}</strong>{')'}</>
        )}
        {', I expect the '}
        {family === 'bernoulli' ? 'probability' : 'proportion'}
        {' of '}<strong>{outName}</strong>{' to be roughly '}
        <strong>{fmt(loProb, 2)}</strong>{' to '}
        <strong>{fmt(hiProb, 2)}</strong>{'.'}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', fontSize: 12, color: 'var(--pw-text-muted)', marginTop: 4 }}>
          <span>{'\u00b1'}</span>
          <input
            type="number"
            className="text-input"
            step="any"
            value={ranges[scale] || ''}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v) && v > 0) {
                setRanges(prev => ({ ...prev, [scale]: v }));
              } else if (e.target.value === '') {
                setRanges(prev => ({ ...prev, [scale]: 0 }));
              }
            }}
            style={{ width: 64, textAlign: 'center', margin: '0 2px', display: 'inline-block', fontSize: 12 }}
          />
          <span>logit units around {fmt(priors.interceptMean)} {'\u2192'} SD = {fmt(effectiveIntSD)} (logit 0 = 0.50 probability)</span>
        </div>
        {scale === 'standardized' && (
          <div style={{ fontSize: 11, color: 'var(--pw-text-muted)', marginTop: 8,
            padding: '6px 10px', background: 'var(--pw-surface-raised)', borderRadius: 4 }}>
            <strong style={{ color }}>Common default:</strong> Normal(0, 1.5) assigns roughly
            equal probability across outcomes. The intercept stays on the logit scale even
            after standardizing predictors.
          </div>
        )}
      </div>
    );
  }

  // log link
  const loVal = Math.exp(intLo);
  const hiVal = Math.exp(intHi);
  return (
    <div style={{
      fontSize: 13,
      color: 'var(--pw-text)',
      lineHeight: 2,
      padding: '8px 12px',
      background: 'var(--pw-surface)',
      borderRadius: 6,
      marginBottom: 12,
      borderLeft: `3px solid ${color}`,
    }}>
      {'When '}
      <strong>{txName}</strong>
      {' is '}
      {scale === 'natural' ? (
        <strong>0</strong>
      ) : (
        <>{'at its average ('}<strong>{fmt(txMean)}</strong>{')'}</>
      )}
      {', I expect '}<strong>{outName}</strong>{' to be roughly '}
      <strong>{fmt(loVal)}</strong>{' to '}
      <strong>{fmt(hiVal)}</strong>{'.'}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', fontSize: 12, color: 'var(--pw-text-muted)', marginTop: 4 }}>
        <span>{'\u00b1'}</span>
        <input
          type="number"
          className="text-input"
          step="any"
          value={ranges[scale] || ''}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (!isNaN(v) && v > 0) {
              setRanges(prev => ({ ...prev, [scale]: v }));
            } else if (e.target.value === '') {
              setRanges(prev => ({ ...prev, [scale]: 0 }));
            }
          }}
          style={{ width: 64, textAlign: 'center', margin: '0 2px', display: 'inline-block', fontSize: 12 }}
        />
        <span>log units around {fmt(priors.interceptMean)} {'\u2192'} SD = {fmt(effectiveIntSD)} (each log unit ≈ 2.7× change)</span>
      </div>
      {scale === 'standardized' && (
        <div style={{ fontSize: 11, color: 'var(--pw-text-muted)', marginTop: 8,
          padding: '6px 10px', background: 'var(--pw-surface-raised)', borderRadius: 4 }}>
          <strong style={{ color }}>Common default:</strong> The intercept stays on the log
          scale even after standardizing predictors. It represents your baseline value.
        </div>
      )}
    </div>
  );
}

/** Standardized effect editor — independent local state with standard-prior defaults */
function StandardizedEffectEditor({
  link,
  color,
  txName,
  outName,
  family,
  stdEffects,
  onStdEffectsChange,
  baseProbOrValue,
}: {
  link: string;
  color: string;
  txName: string;
  outName: string;
  family: string | null;
  stdEffects: { tx: number; out: number; outLo: number; outHi: number; after: number; afterLo: number; afterHi: number };
  onStdEffectsChange: React.Dispatch<React.SetStateAction<typeof stdEffects>>;
  baseProbOrValue: number;
}) {
  const isThreshold = family === 'cumulative' || family === 'categorical';
  const inputStyle: React.CSSProperties = { width: 80, textAlign: 'center', display: 'inline-block', margin: '0 4px' };

  if (link === 'identity') {
    const slope = stdEffects.tx !== 0 ? stdEffects.out / stdEffects.tx : 0;
    return (
      <div style={{
        fontSize: 13, color: 'var(--pw-text)', lineHeight: 2,
        padding: '10px 12px', background: 'var(--pw-surface)', borderRadius: 6,
        marginBottom: 16, borderLeft: `3px solid ${color}`,
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--pw-text-muted)', marginBottom: 4 }}>
          Expected effect <span style={{ color }}>(in SD units)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          <span>A change of</span>
          <NumberInput value={stdEffects.tx}
            onChange={(v) => onStdEffectsChange((s) => ({ ...s, tx: v }))}
            style={inputStyle} />
          <span>SDs in {txName} changes {outName} by</span>
          <NumberInput value={stdEffects.out}
            onChange={(v) => onStdEffectsChange((s) => ({ ...s, out: v }))}
            style={inputStyle} />
          <span>SDs.</span>
        </div>

        {stdEffects.tx !== 0 && stdEffects.out !== 0 && (
          <div style={{ fontSize: 11, color: 'var(--pw-text-muted)', marginTop: 4 }}>
            β = {fmt(stdEffects.out)} ÷ {fmt(stdEffects.tx)} = <strong>{fmt(slope)}</strong> SDs of {outName} per SD of {txName}
          </div>
        )}

        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          <span>but could plausibly change it up or down by as much as</span>
          <NumberInput value={stdEffects.outHi}
            onChange={(v) => onStdEffectsChange((s) => ({ ...s, outHi: v, outLo: -v }))}
            style={inputStyle} />
          <span>SDs.</span>
        </div>

        {stdEffects.outHi > 0 && stdEffects.tx !== 0 && (() => {
          const slopeRange = (2 * stdEffects.outHi) / stdEffects.tx;
          const derivedSD = slopeRange / 4;
          return (
            <div style={{ fontSize: 11, color: 'var(--pw-text-muted)', marginTop: 4 }}>
              slope range: ±{fmt(stdEffects.outHi / stdEffects.tx)} around {fmt(slope)}
              {' → SD = ±range / 2 = '}<strong>{fmt(derivedSD)}</strong>
              {' → Normal('}{fmt(slope)}{', '}{fmt(derivedSD)}{')'}
            </div>
          );
        })()}

        <div style={{ fontSize: 11, color: 'var(--pw-text-muted)', marginTop: 8,
          padding: '6px 10px', background: 'var(--pw-surface-raised)', borderRadius: 4 }}>
          <strong style={{ color }}>Standard prior:</strong> Normal(0, 0.5) assumes
          no effect, with room to go either positive or negative. This implies
          that a 1-SD change in {txName} moves {outName} by less than 1 SD,
          allowing the data to define the model's estimate.
        </div>
      </div>
    );
  }

  // Logit / log links
  const baseLabel = isThreshold ? '0.50'
    : link === 'logit' ? baseProbOrValue.toFixed(2)
    : fmt(baseProbOrValue);

  const logPctDisplay = link === 'log' && baseProbOrValue > 0 && stdEffects.after > 0
    ? (stdEffects.after / baseProbOrValue - 1) * 100
    : 0;

  const handleStdLogPctChange = (pct: number) => {
    if (baseProbOrValue > 0) {
      onStdEffectsChange((s) => ({ ...s, after: baseProbOrValue * (1 + pct / 100) }));
    }
  };

  const stdLogAfterDisplay = link === 'log' && baseProbOrValue > 0 && stdEffects.after > 0
    ? Math.round(stdEffects.after)
    : null;

  const isLogLink = link === 'log';

  return (
    <div style={{
      fontSize: 13, color: 'var(--pw-text)', lineHeight: 2,
      padding: '10px 12px', background: 'var(--pw-surface)', borderRadius: 6,
      marginBottom: 16, borderLeft: `3px solid ${color}`,
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--pw-text-muted)', marginBottom: 4 }}>
        Expected effect <span style={{ color }}>(treatment in SD units)</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
        <span>A change of</span>
        <NumberInput value={stdEffects.tx}
          onChange={(v) => onStdEffectsChange((s) => ({ ...s, tx: v }))}
          style={inputStyle} />
        {isLogLink ? (
          <>
            <span>
              SDs of {txName} changes {outName} by approximately
            </span>
            <NumberInput value={Math.round(logPctDisplay)} onChange={handleStdLogPctChange}
              style={inputStyle} />
            <span>%</span>
            {baseProbOrValue > 0 && (
              <span style={{ color: 'var(--pw-text-muted)' }}>
                (from a baseline of {fmt(baseProbOrValue)}{stdLogAfterDisplay != null ? ` to ${stdLogAfterDisplay}` : ''})
              </span>
            )}
          </>
        ) : (
          <>
            <span>
              SDs of {txName} changes the{' '}
              {family === 'cumulative' ? 'probability of a higher category'
                : family === 'categorical' ? 'probability of a given category (vs. reference)'
                : family === 'bernoulli' ? 'probability'
                : 'proportion'}
              {' '}from {baseLabel} to
            </span>
            <NumberInput value={stdEffects.after}
              onChange={(v) => onStdEffectsChange((s) => ({ ...s, after: link === 'logit' ? Math.max(0.001, Math.min(0.999, v)) : v }))}
              step="0.01"
              style={inputStyle} />
          </>
        )}
      </div>
      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
        <span>but could plausibly end up as low as</span>
        <NumberInput value={stdEffects.afterLo}
          onChange={(v) => onStdEffectsChange((s) => ({ ...s, afterLo: link === 'logit' ? Math.max(0.001, Math.min(0.999, v)) : v }))}
          step={link === 'logit' ? '0.01' : 'any'}
          style={inputStyle} />
        <span>or as high as</span>
        <NumberInput value={stdEffects.afterHi}
          onChange={(v) => onStdEffectsChange((s) => ({ ...s, afterHi: link === 'logit' ? Math.max(0.001, Math.min(0.999, v)) : v }))}
          step={link === 'logit' ? '0.01' : 'any'}
          style={inputStyle} />
      </div>

      {/* Show derived slope */}
      {stdEffects.tx !== 0 && stdEffects.after !== 0 && (() => {
        const base = isThreshold ? 0.5 : baseProbOrValue;
        const slopeVal = link === 'logit'
          ? (logit(Math.max(0.001, Math.min(0.999, stdEffects.after))) - logit(Math.max(0.001, Math.min(0.999, base)))) / stdEffects.tx
          : (Math.log(Math.max(0.01, stdEffects.after)) - Math.log(Math.max(0.01, base))) / stdEffects.tx;
        return (
          <div style={{ fontSize: 11, color: 'var(--pw-text-muted)', marginTop: 4 }}>
            β = Δ{link === 'logit' ? 'logit' : 'log'} ÷ Δ{txName} ={' '}
            <strong>{fmt(slopeVal)}</strong> per SD on the {link} scale
          </div>
        );
      })()}

      {/* Show SD from confidence bounds */}
      {stdEffects.afterHi > stdEffects.afterLo && stdEffects.tx !== 0 && (() => {
        const base = isThreshold ? 0.5 : baseProbOrValue;
        const slopeAtLo = link === 'logit'
          ? (logit(Math.max(0.001, Math.min(0.999, stdEffects.afterLo))) - logit(Math.max(0.001, Math.min(0.999, base)))) / stdEffects.tx
          : (Math.log(Math.max(0.01, stdEffects.afterLo)) - Math.log(Math.max(0.01, base))) / stdEffects.tx;
        const slopeAtHi = link === 'logit'
          ? (logit(Math.max(0.001, Math.min(0.999, stdEffects.afterHi))) - logit(Math.max(0.001, Math.min(0.999, base)))) / stdEffects.tx
          : (Math.log(Math.max(0.01, stdEffects.afterHi)) - Math.log(Math.max(0.01, base))) / stdEffects.tx;
        const slopeSD = Math.abs(slopeAtHi - slopeAtLo) / 4;
        return (
          <div style={{ fontSize: 11, color: 'var(--pw-text-muted)', marginTop: 4 }}>
            slope range: ±{fmt(Math.abs(slopeAtHi - slopeAtLo) / 2)} on {link} scale
            {' → SD = '}<strong>{fmt(slopeSD)}</strong>
          </div>
        );
      })()}

      <div style={{ fontSize: 11, color: 'var(--pw-text-muted)', marginTop: 8,
        padding: '6px 10px', background: 'var(--pw-surface-raised)', borderRadius: 4 }}>
        <strong style={{ color }}>Standard prior:</strong>{' '}
        {link === 'logit'
          ? 'β ~ Normal(0, 1) on the logit scale means a 1-SD change in the predictor shifts log-odds by at most about ±2. This allows substantial effects while preventing unrealistically extreme ones.'
          : 'β ~ Normal(0, 0.5) on the log scale means a 1-SD change in the predictor multiplies the outcome by at most about e¹ ≈ 2.7×.'}
      </div>
    </div>
  );
}

/** Inline editable effect within each scale card */
function EffectEditor({
  link,
  scale,
  color,
  txName,
  outName,
  state,
  txSD,
  outSD,
  onEffectTxChange,
  onEffectOutChange,
  onEffectOutLoChange,
  onEffectOutHiChange,
  onEffectAfterChange,
  onEffectAfterLoChange,
  onEffectAfterHiChange,
}: {
  link: string;
  scale: DataScale;
  color: string;
  txName: string;
  outName: string;
  state: WizardState;
  txSD: number;
  outSD: number;
  onEffectTxChange: (v: number) => void;
  onEffectOutChange: (v: number) => void;
  onEffectOutLoChange: (v: number) => void;
  onEffectOutHiChange: (v: number) => void;
  onEffectAfterChange: (v: number) => void;
  onEffectAfterLoChange: (v: number) => void;
  onEffectAfterHiChange: (v: number) => void;
}) {
  const family = state.family;
  const isThreshold = family === 'cumulative' || family === 'categorical';
  const inputStyle: React.CSSProperties = { width: 80, textAlign: 'center', display: 'inline-block', margin: '0 4px' };

  // For standardized identity link, convert displayed values to/from SD units
  const isStdIdentity = scale === 'standardized' && link === 'identity';

  // Displayed values — in SD units for standardized identity, natural otherwise
  const displayTx = isStdIdentity && txSD > 0 ? state.effectChangeInTreatment / txSD : state.effectChangeInTreatment;
  const displayOut = isStdIdentity && outSD > 0 ? state.effectChangeInOutcome / outSD : state.effectChangeInOutcome;
  const displayOutLo = isStdIdentity && outSD > 0 ? state.effectOutcomeLo / outSD : state.effectOutcomeLo;
  const displayOutHi = isStdIdentity && outSD > 0 ? state.effectOutcomeHi / outSD : state.effectOutcomeHi;

  const handleTxChange = (displayed: number) => {
    onEffectTxChange(isStdIdentity && txSD > 0 ? displayed * txSD : displayed);
  };
  const handleOutChange = (displayed: number) => {
    onEffectOutChange(isStdIdentity && outSD > 0 ? displayed * outSD : displayed);
  };
  const handleOutLoChange = (displayed: number) => {
    onEffectOutLoChange(isStdIdentity && outSD > 0 ? displayed * outSD : displayed);
  };
  const handleOutHiChange = (displayed: number) => {
    onEffectOutHiChange(isStdIdentity && outSD > 0 ? displayed * outSD : displayed);
  };

  // Compute slope for display
  const slope = state.effectChangeInTreatment !== 0
    ? state.effectChangeInOutcome / state.effectChangeInTreatment
    : 0;
  const stdSlope = txSD > 0 && outSD > 0 ? slope * (txSD / outSD) : 0;
  const displaySlope = isStdIdentity ? stdSlope : slope;

  const unitLabel = isStdIdentity ? 'SDs' : 'units';

  if (link === 'identity') {
    return (
      <div style={{
        fontSize: 13,
        color: 'var(--pw-text)',
        lineHeight: 2,
        padding: '10px 12px',
        background: 'var(--pw-surface)',
        borderRadius: 6,
        marginBottom: 16,
        borderLeft: `3px solid ${color}`,
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--pw-text-muted)', marginBottom: 4 }}>
          Expected effect {isStdIdentity && <span style={{ color }}>(in SD units)</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          <span>A change of</span>
          <NumberInput value={displayTx} onChange={handleTxChange}
            style={inputStyle} />
          <span>{unitLabel} in {txName} changes {outName} by</span>
          <NumberInput value={displayOut} onChange={handleOutChange}
            style={inputStyle} />
          <span>{unitLabel}.</span>
        </div>

        {/* Show derived slope */}
        {state.effectChangeInTreatment !== 0 && state.effectChangeInOutcome !== 0 && (
          <div style={{ fontSize: 11, color: 'var(--pw-text-muted)', marginTop: 4 }}>
            β = {fmt(displayOut)} ÷ {fmt(displayTx)} = <strong>{fmt(displaySlope)}</strong>
            {' '}({unitLabel} of {outName} per {unitLabel} of {txName})
          </div>
        )}

        {/* Confidence bounds */}
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          <span>but could plausibly change it by as little as</span>
          <NumberInput value={displayOutLo} onChange={handleOutLoChange}
            style={inputStyle} />
          <span>or as much as</span>
          <NumberInput value={displayOutHi} onChange={handleOutHiChange}
            style={inputStyle} />
          <span>{unitLabel}. (negative = opposite direction)</span>
        </div>

        {/* Show derived SD — ± notation matching the alpha editor */}
        {displayOutHi > displayOutLo && displayTx !== 0 && (() => {
          const slopeRange = (displayOutHi - displayOutLo) / displayTx;
          const derivedSD = slopeRange / 4;
          return (
            <div style={{ fontSize: 11, color: 'var(--pw-text-muted)', marginTop: 4 }}>
              {'slope range: ±'}{fmt(slopeRange / 2)}{' around '}{fmt(displaySlope)}
              {' → SD = ±range / 2 = '}<strong>{fmt(derivedSD)}</strong>
              {' → Normal('}{fmt(displaySlope)}{', '}{fmt(derivedSD)}{')'}
            </div>
          );
        })()}

        {/* Standard priors reference for standardized */}
        {isStdIdentity && (
          <div style={{ fontSize: 11, color: 'var(--pw-text-muted)', marginTop: 8,
            padding: '6px 10px', background: 'var(--pw-surface-raised)', borderRadius: 4 }}>
            <strong style={{ color }}>Common default:</strong> Normal(0, 0.5) assumes
            no effect, with room to go either positive or negative. This implies
            that a 1-SD change in {txName} moves {outName} by less than 1 SD,
            allowing the data to define the model's estimate. Use wider SDs if
            you expect large effects.
          </div>
        )}
      </div>
    );
  }

  // Logit / log links
  // For standardized: show treatment in SD units
  const isStdLink = scale === 'standardized';
  const displayTxLink = isStdLink && txSD > 0 ? state.effectChangeInTreatment / txSD : state.effectChangeInTreatment;

  const handleTxLinkChange = (displayed: number) => {
    onEffectTxChange(isStdLink && txSD > 0 ? displayed * txSD : displayed);
  };

  const baseLabel = isThreshold ? '0.50'
    : link === 'logit' ? (state.outcome.mean || 0).toFixed(2)
    : fmt(state.outcome.mean);

  // Percentage display for log link
  const logPctDisplay = link === 'log' && state.outcome.mean > 0 && state.effectOutcomeAfter > 0
    ? (state.effectOutcomeAfter / state.outcome.mean - 1) * 100
    : 0;

  const handleLogPctChange = (pct: number) => {
    if (state.outcome.mean > 0) {
      onEffectAfterChange(state.outcome.mean * (1 + pct / 100));
    }
  };

  const logAfterDisplay = link === 'log' && state.outcome.mean > 0 && state.effectOutcomeAfter > 0
    ? Math.round(state.effectOutcomeAfter)
    : null;

  const txUnitLabel = isStdLink ? `SDs of ${txName}` : `in ${txName}`;

  // For logit links, keep the original "from X to Y" framing
  const isLogLink = link === 'log';

  return (
    <div style={{
      fontSize: 13,
      color: 'var(--pw-text)',
      lineHeight: 2,
      padding: '10px 12px',
      background: 'var(--pw-surface)',
      borderRadius: 6,
      marginBottom: 16,
      borderLeft: `3px solid ${color}`,
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--pw-text-muted)', marginBottom: 4 }}>
        Expected effect {isStdLink && <span style={{ color }}>(treatment in SD units)</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
        <span>A change of</span>
        <NumberInput value={displayTxLink} onChange={handleTxLinkChange}
          style={inputStyle} />
        {isLogLink ? (
          <>
            <span>
              {txUnitLabel} changes {outName} by approximately
            </span>
            <NumberInput value={Math.round(logPctDisplay)} onChange={handleLogPctChange}
              style={inputStyle} />
            <span>%</span>
            {state.outcome.mean > 0 && (
              <span style={{ color: 'var(--pw-text-muted)' }}>
                (from a baseline of {fmt(state.outcome.mean)}{logAfterDisplay != null ? ` to ${logAfterDisplay}` : ''})
              </span>
            )}
          </>
        ) : (
          <>
            <span>
              {txUnitLabel} changes the{' '}
              {family === 'cumulative' ? 'probability of a higher category'
                : family === 'categorical' ? 'probability of a given category (vs. reference)'
                : family === 'bernoulli' ? 'probability'
                : 'proportion'}
              {' '}from {baseLabel} to
            </span>
            <NumberInput value={state.effectOutcomeAfter}
              onChange={(v) => onEffectAfterChange(Math.max(0.001, Math.min(0.999, v)))}
              step="0.01"
              style={inputStyle} />
          </>
        )}
      </div>
      {/* Confidence bounds */}
      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
        <span>but could plausibly end up as low as</span>
        <NumberInput value={state.effectAfterLo}
          onChange={(v) => link === 'logit' ? onEffectAfterLoChange(Math.max(0.001, Math.min(0.999, v))) : onEffectAfterLoChange(v)}
          step={link === 'logit' ? '0.01' : 'any'}
          style={inputStyle} />
        <span>or as high as</span>
        <NumberInput value={state.effectAfterHi}
          onChange={(v) => link === 'logit' ? onEffectAfterHiChange(Math.max(0.001, Math.min(0.999, v))) : onEffectAfterHiChange(v)}
          step={link === 'logit' ? '0.01' : 'any'}
          style={inputStyle} />
      </div>

      {/* Show derived slope on link scale */}
      {state.effectChangeInTreatment !== 0 && state.effectOutcomeAfter !== 0 && (() => {
        const baseP = isThreshold ? 0.5 : (state.outcome.mean || 0);
        const afterP = state.effectOutcomeAfter;
        const tx = state.effectChangeInTreatment;
        const slopeVal = link === 'logit'
          ? (Math.log(afterP / (1 - afterP)) - Math.log(baseP / (1 - baseP))) / tx
          : (Math.log(afterP) - Math.log(baseP)) / tx;
        const stdSlopeVal = slopeVal * txSD;
        return (
          <div style={{ fontSize: 11, color: 'var(--pw-text-muted)', marginTop: 4 }}>
            β = Δ{link === 'logit' ? 'logit' : 'log'} ÷ Δ{txName} ={' '}
            <strong>{fmt(slopeVal)}</strong> per unit on the {link} scale
            {isStdLink && txSD > 0 && (
              <> → <strong>{fmt(stdSlopeVal)}</strong> per SD (× SD_treatment = × {fmt(txSD)})</>
            )}
          </div>
        );
      })()}

      {/* Show SD from confidence bounds */}
      {state.effectAfterHi > state.effectAfterLo && state.effectChangeInTreatment !== 0 && (() => {
        const baseP = isThreshold ? 0.5 : (state.outcome.mean || 0);
        const tx = state.effectChangeInTreatment;
        const slopeAtLo = link === 'logit'
          ? (Math.log(state.effectAfterLo / (1 - state.effectAfterLo)) - Math.log(baseP / (1 - baseP))) / tx
          : (Math.log(state.effectAfterLo) - Math.log(baseP)) / tx;
        const slopeAtHi = link === 'logit'
          ? (Math.log(state.effectAfterHi / (1 - state.effectAfterHi)) - Math.log(baseP / (1 - baseP))) / tx
          : (Math.log(state.effectAfterHi) - Math.log(baseP)) / tx;
        const slopeSD = Math.abs(slopeAtHi - slopeAtLo) / 4;
        const stdSlopeSD = slopeSD * txSD;
        return (
          <div style={{ fontSize: 11, color: 'var(--pw-text-muted)', marginTop: 4 }}>
            slope range: ±{fmt(Math.abs(slopeAtHi - slopeAtLo) / 2)} on {link} scale
            {' → SD = '}<strong>{fmt(slopeSD)}</strong>
            {isStdLink && txSD > 0 && (
              <> → standardized SD = <strong>{fmt(stdSlopeSD)}</strong></>
            )}
          </div>
        );
      })()}
    </div>
  );
}


/** Display a single prior with curve and interpretation */
function PriorDisplay({
  paramLabel,
  priorStr,
  explanation,
  lo,
  hi,
  mean,
  sd,
  link,
  isSlope,
  scale,
}: {
  paramLabel: string;
  priorStr: string;
  explanation: string;
  lo: number;
  hi: number;
  mean: number;
  sd: number;
  link: string;
  isSlope: boolean;
  scale: DataScale;
}) {
  // Build interpretation string showing the 2×SD math
  let interpretation = '';
  const sdNote = `(mean \u00b1 2\u00d7${fmt(sd)} = ${fmt(lo)} to ${fmt(hi)})`;

  if (link === 'identity') {
    if (isSlope) {
      const unit = scale === 'standardized' ? 'SDs' : 'units';
      interpretation = `95% prior interval: ${fmt(lo)} to ${fmt(hi)} ${unit} ${sdNote}`;
    } else {
      interpretation = `95% prior interval: ${fmt(lo)} to ${fmt(hi)} ${sdNote}`;
    }
  } else if (link === 'logit') {
    interpretation =
      `95% on logit scale: ${fmt(lo)} to ${fmt(hi)} ${sdNote}` +
      ` \u2192 probabilities: ${fmt(logistic(lo) * 100, 1)}% to ${fmt(logistic(hi) * 100, 1)}%`;
  } else if (link === 'log') {
    interpretation =
      `95% on log scale: ${fmt(lo)} to ${fmt(hi)} ${sdNote}` +
      ` \u2192 values: ${fmt(Math.exp(lo))} to ${fmt(Math.exp(hi))}`;
  }

  // Small scale badge so users can see at a glance which scale the prior lives on.
  const scaleBadge =
    link === 'logit' ? 'logit scale'
    : link === 'log' ? 'log scale'
    : isSlope && scale === 'standardized' ? 'SD units'
    : 'natural units';

  return (
    <div style={{ marginBottom: 16 }}>
      {/* Parameter name + prior */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 4,
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span
            style={{
              fontFamily: 'var(--pw-font-math)',
              fontSize: 14,
              color: 'var(--pw-text)',
            }}
          >
            {paramLabel}
          </span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: 0.3,
              textTransform: 'uppercase',
              color: 'var(--pw-text-muted)',
              background: 'var(--pw-surface-raised)',
              padding: '2px 6px',
              borderRadius: 4,
            }}
          >
            {scaleBadge}
          </span>
        </span>
        <span
          style={{
            fontFamily: 'var(--pw-font-mono)',
            fontSize: 12,
            color: 'var(--pw-accent)',
          }}
        >
          {priorStr}
        </span>
      </div>

      {/* Curve */}
      {sd > 0 && (
        <DistCurve
          type="normal"
          mean={mean}
          param={sd}
          width={360}
          xAxisLabel={
            link === 'logit'
              ? 'log-odds (logit scale)'
              : link === 'log'
                ? 'log of outcome (log scale)'
                : isSlope && scale === 'standardized'
                  ? 'SD units'
                  : 'outcome units'
          }
        />
      )}
      {(link === 'logit' || link === 'log') && (
        <div style={{ fontSize: 10, color: 'var(--pw-text-dim)', textAlign: 'center', marginTop: -4, marginBottom: 4 }}>
          Still a Normal distribution &mdash; just on the {link} scale.
        </div>
      )}

      {/* Interpretation */}
      <div
        style={{
          fontSize: 11,
          color: 'var(--pw-text-muted)',
          lineHeight: 1.5,
        }}
      >
        <div>{interpretation}</div>
        <div style={{ marginTop: 4, color: 'var(--pw-text-dim)' }}>
          {explanation}
        </div>
      </div>
    </div>
  );
}
