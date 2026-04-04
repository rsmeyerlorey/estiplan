import { FAMILIES, type OutcomeFamily } from '../lib/types';
import { DistCurve } from './DistCurve';

interface Props {
  family: OutcomeFamily;
  outcomeName: string;
  treatmentName: string;
  onContinue: () => void;
}

interface StandardPrior {
  symbol: string;
  label: string;
  prior: string;
  explanation: string;
  /** Parameters for the distribution curve: [mean, sd] for normal, [rate] for exponential */
  curveType: 'normal' | 'exponential';
  curveParams: [number, number] | [number];
}

function getStandardPriors(
  family: OutcomeFamily,
  outcomeName: string,
  treatmentName: string,
): StandardPrior[] {
  const info = FAMILIES[family];
  const link = info.link;
  const out = outcomeName || 'outcome';
  const tx = treatmentName || 'predictor';

  const priors: StandardPrior[] = [];

  // Intercept
  if (link === 'logit') {
    priors.push({
      symbol: '\u03b1',
      label: 'Intercept (logit scale)',
      prior: 'Normal(0, 1.5)',
      explanation:
        `When all predictors are at their mean values, the baseline probability ` +
        `of ${out} could fall anywhere between about 0.05 and 0.95. ` +
        `The model will learn the actual baseline from the data.`,
      curveType: 'normal',
      curveParams: [0, 1.5],
    });
  } else if (link === 'log') {
    priors.push({
      symbol: '\u03b1',
      label: 'Intercept (log scale)',
      prior: 'Normal(0, 1)',
      explanation:
        `When all predictors are at their mean values, the baseline ${out} ` +
        `could range from about 0.14\u00d7 to 7.4\u00d7 the average \u2014 for example, ` +
        `if the typical value is 10, the baseline could fall between about 1 and 74. ` +
        `The model will learn the actual baseline from the data.`,
      curveType: 'normal',
      curveParams: [0, 1],
    });
  } else {
    priors.push({
      symbol: '\u03b1',
      label: 'Intercept',
      prior: 'Normal(0, 0.5)',
      explanation:
        `When all predictors are at their mean values, ${out} is expected ` +
        `to fall within \u00b11 SD of its own mean.`,
      curveType: 'normal',
      curveParams: [0, 0.5],
    });
  }

  // Slope
  if (link === 'logit') {
    let slopeExplanation: string;
    if (family === 'cumulative') {
      slopeExplanation =
        `A 1-SD change in ${tx} shifts all category thresholds simultaneously ` +
        `(proportional odds assumption), moving responses toward higher or lower categories.`;
    } else if (family === 'categorical') {
      slopeExplanation =
        `A 1-SD change in ${tx} changes the log-odds of each non-reference ` +
        `category independently. The effect may differ across categories.`;
    } else {
      slopeExplanation =
        `A 1-SD change in ${tx} can shift the probability substantially, ` +
        `but not to near-certainty. A shift of 2 on the logit scale moves ` +
        `a 50% probability to about 88%.`;
    }
    priors.push({
      symbol: '\u03b2',
      label: `Slope (${tx})`,
      prior: 'Normal(0, 1)',
      explanation: slopeExplanation,
      curveType: 'normal',
      curveParams: [0, 1],
    });
  } else if (link === 'log') {
    priors.push({
      symbol: '\u03b2',
      label: `Slope (${tx})`,
      prior: 'Normal(0, 0.5)',
      explanation:
        `A 1-SD change in ${tx} can multiply or divide ${out} ` +
        `by up to about 2.7\u00d7.`,
      curveType: 'normal',
      curveParams: [0, 0.5],
    });
  } else {
    priors.push({
      symbol: '\u03b2',
      label: `Slope (${tx})`,
      prior: 'Normal(0, 0.5)',
      explanation:
        `A 1-SD change in ${tx} is expected to change ${out} ` +
        `by less than 1 SD. No single predictor dominates.`,
      curveType: 'normal',
      curveParams: [0, 0.5],
    });
  }

  // Dispersion
  if (info.hasDispersion) {
    if (info.dispersionParam === 'sigma') {
      priors.push({
        symbol: '\u03c3',
        label: info.dispersionLabel || '\u03c3',
        prior: 'Exponential(1)',
        explanation:
          `Variation not explained by the predictors is expected to fall ` +
          `within 1 SD; the model will refine this estimate from the data.`,
        curveType: 'exponential',
        curveParams: [1],
      });
    } else if (info.dispersionParam === 'phi') {
      priors.push({
        symbol: '\u03c6',
        label: info.dispersionLabel || '\u03c6',
        prior: 'Exponential(1)',
        explanation:
          `How tightly proportions cluster around the predicted value. ` +
          `The model will learn the actual precision from the data.`,
        curveType: 'exponential',
        curveParams: [1],
      });
    }
  }

  return priors;
}

/**
 * Step 2: Standard Priors.
 * Shows the widely accepted default priors with plain-English explanations
 * and distribution curves. This is the "here's what the field recommends" moment.
 */
export function StepStandardPriors({
  family,
  outcomeName,
  treatmentName,
  onContinue,
}: Props) {
  const info = FAMILIES[family];
  const priors = getStandardPriors(family, outcomeName, treatmentName);

  return (
    <div className="wizard-step">
      <div className="step-header">
        <span className="step-number">2</span>
        <span className="step-title">Standard priors for your model</span>
      </div>
      <p className="step-description">
        These are widely accepted default priors for{' '}
        <strong>{info.label}</strong> models with standardized data.
        They are standard across the Bayesian modeling community and work
        well for most analyses.
      </p>

      {/* Prior cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
        {priors.map((p) => (
          <div
            key={p.symbol + p.label}
            style={{
              background: 'var(--pw-surface-raised)',
              borderRadius: 8,
              padding: '14px 16px',
              borderLeft: '3px solid var(--pw-accent)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
              <span
                style={{
                  fontFamily: 'var(--pw-font-math)',
                  fontSize: 18,
                  color: 'var(--pw-accent)',
                  fontWeight: 600,
                }}
              >
                {p.symbol}
              </span>
              <span style={{ fontSize: 13, color: 'var(--pw-text)', fontWeight: 500 }}>
                {p.label}
              </span>
              <span
                className="mono"
                style={{
                  fontSize: 13,
                  color: 'var(--pw-accent)',
                  fontWeight: 600,
                }}
              >
                ~ {p.prior}
              </span>
            </div>

            {/* Mini distribution curve */}
            <div style={{ margin: '8px 0' }}>
              {p.curveType === 'normal' ? (
                <DistCurve
                  type="normal"
                  mean={p.curveParams[0]}
                  sd={p.curveParams[1]}
                  label=""
                  showInterval
                  compact
                />
              ) : (
                <DistCurve
                  type="exponential"
                  param={p.curveParams[0]}
                  label=""
                  showInterval={false}
                  compact
                />
              )}
            </div>

            <div style={{ fontSize: 12, color: 'var(--pw-text-muted)', lineHeight: 1.6 }}>
              {p.explanation}
            </div>
          </div>
        ))}
      </div>

      {/* Note about priors being intentionally broad */}
      <div
        style={{
          marginTop: 16,
          padding: '12px 14px',
          background: 'var(--pw-surface-raised)',
          borderRadius: 6,
          fontSize: 12,
          color: 'var(--pw-text-muted)',
          lineHeight: 1.6,
        }}
      >
        These priors are intentionally broad. They express the expectation
        that no single predictor should have an enormous effect, without
        committing to a specific effect size. They are set with the knowledge
        that the model will refine them using your data. For most analyses,
        these defaults are preferable to hand-tuned priors.
      </div>

      {/* Continue button */}
      <div style={{ marginTop: 20 }}>
        <button className="btn btn-primary" onClick={onContinue}>
          Understand &amp; adjust priors
        </button>
        <div
          style={{
            fontSize: 11,
            color: 'var(--pw-text-dim)',
            marginTop: 6,
          }}
        >
          Explore what these priors mean for your specific variables and units.
        </div>
      </div>
    </div>
  );
}
