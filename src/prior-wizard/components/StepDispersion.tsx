import { FAMILIES, type OutcomeFamily } from '../lib/types';
import { fmt } from '../lib/distributions';
import { DistCurve } from './DistCurve';
import { WhyBox } from './WhyBox';

interface Props {
  family: OutcomeFamily;
  rate: number;
  onRateChange: (v: number) => void;
}

/** Step 4: Set the dispersion prior (sigma / phi) */
export function StepDispersion({ family, rate, onRateChange }: Props) {
  const info = FAMILIES[family];

  if (!info.hasDispersion) return null;

  const expMean = 1 / rate;
  const exp95 = 3 / rate; // ~95th percentile of Exponential

  return (
    <div className="wizard-step">
      <div className="step-header">
        <span className="step-number">5</span>
        <span className="step-title">Set the dispersion prior</span>
      </div>
      <p className="step-description">
        {info.dispersionParam === 'sigma' ? (
          <>
            Your predictor likely doesn&rsquo;t account for <em>all</em> of
            the variation in the outcome. <strong>&sigma;</strong> (sigma)
            captures how much noise is left over, or how far individual
            observations scatter around the model&rsquo;s prediction.
            Can usually be left at 1, unless you expect very little or very
            much noise.
          </>
        ) : (
          <>
            <strong>&phi;</strong> (precision) controls how tightly
            proportions cluster around the predicted value. Higher &phi; = less
            spread. It&rsquo;s the inverse of dispersion.
          </>
        )}
      </p>

      <div className="field-group">
        <label className="field-label">
          Exponential rate parameter
        </label>
        <div className="slider-row">
          <input
            className="slider-input"
            type="range"
            min={0.1}
            max={5}
            step={0.1}
            value={rate}
            onChange={(e) => onRateChange(parseFloat(e.target.value))}
          />
          <input
            type="number"
            className="text-input"
            step="any"
            value={rate || ''}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v) && v > 0) onRateChange(v);
            }}
            style={{ width: 72, marginLeft: 8 }}
          />
        </div>
      </div>

      <DistCurve
        type="exponential"
        param={rate}
        label={`Exponential(${fmt(rate)}): mean = ${fmt(expMean)}, 95% below ${fmt(exp95)}`}
        showInterval={false}
      />

      <div
        style={{
          fontSize: 12,
          color: 'var(--pw-text-muted)',
          padding: '8px 12px',
          background: 'var(--pw-surface-raised)',
          borderRadius: 6,
          lineHeight: 1.6,
        }}
      >
        <strong style={{ color: 'var(--pw-text)' }}>
          Exponential({fmt(rate)})
        </strong>{' '}
        means:
        <br />
        The expected {info.dispersionParam === 'sigma' ? 'residual SD' : 'precision'}{' '}
        is <span className="mono">{fmt(expMean)}</span>, with 95%
        of prior mass below <span className="mono">{fmt(exp95)}</span>{info.family === 'gaussian' ? ' SDs' : info.family === 'beta' ? '' : ' (on the log scale)'}.
        {info.dispersionParam === 'sigma' && (
          <>
            <br />
            &sigma; must be positive; Exponential({fmt(rate)}) means you
            don&rsquo;t expect enormous unexplained variation.
          </>
        )}
      </div>

      <WhyBox>
        <p>
          {info.dispersionParam === 'sigma' ? '\u03c3' : '\u03c6'}{' '}
          must be positive, so we use an Exponential prior instead of a Normal.
          The rate parameter controls the center and spread in one number.
        </p>
        <p style={{ marginTop: 8 }}>
          You can almost always leave this at rate = 1. The model will figure
          out the actual {info.dispersionParam === 'sigma' ? '\u03c3' : '\u03c6'}{' '}
          from your data &mdash; the prior just keeps it in a reasonable range.
          Only change it if you have strong reason to expect very little or very
          much unexplained variation.
        </p>
      </WhyBox>
    </div>
  );
}
