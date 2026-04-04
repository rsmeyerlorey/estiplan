import { type OutcomeFamily, type VariableDescription, FAMILIES } from '../lib/types';
import { NumberInput } from './NumberInput';
import { WhyBox } from './WhyBox';

interface Props {
  family: OutcomeFamily | null;
  outcome: VariableDescription;
  treatment: VariableDescription;
  effectChangeInTreatment: number;
  effectChangeInOutcome: number;
  effectOutcomeAfter: number;
  onOutcomeChange: (v: VariableDescription) => void;
  onTreatmentChange: (v: VariableDescription) => void;
  onEffectTxChange: (v: number) => void;
  onEffectOutChange: (v: number) => void;
  onEffectAfterChange: (v: number) => void;
  onConfirm: () => void;
}

/** Outcome form configuration per link type */
interface OutcomeFormConfig {
  sublabel: string;
  namePlaceholder: string;
  meanLabel: string;
  meanPlaceholder: string;
  minLabel: string;
  minPlaceholder: string;
  maxLabel: string;
  maxPlaceholder: string;
  guidance: string;
}

function getOutcomeConfig(family: OutcomeFamily | null): OutcomeFormConfig {
  const link = family ? FAMILIES[family].link : 'identity';

  if (family === 'cumulative' || family === 'categorical') {
    // Ordinal/Categorical: simplified form, no numeric outcome fields
    return {
      sublabel: family === 'cumulative'
        ? 'The ordered categories you\'re trying to predict'
        : 'The unordered categories you\'re trying to predict',
      namePlaceholder: family === 'cumulative'
        ? 'e.g., severity rating'
        : 'e.g., land use type',
      meanLabel: '',
      meanPlaceholder: '',
      minLabel: '',
      minPlaceholder: '',
      maxLabel: '',
      maxPlaceholder: '',
      guidance: family === 'cumulative'
        ? 'For ordinal outcomes, the model estimates threshold cut-points between adjacent categories. '
          + 'These thresholds get standard weakly informative priors \u2014 Normal(0, 1.5) \u2014 '
          + 'which assign roughly equal probability to all categories before seeing data. '
          + 'The model will learn the actual category distribution from your data.'
        : 'For categorical outcomes, the model estimates separate intercepts and slopes for each '
          + 'non-reference category. These get standard weakly informative priors \u2014 Normal(0, 1.5). '
          + 'The model will learn category probabilities from your data.',
    };
  }

  if (link === 'logit' && family === 'bernoulli') {
    return {
      sublabel: 'The event you\'re trying to predict (0 or 1)',
      namePlaceholder: 'e.g., survival',
      meanLabel: 'Baseline probability',
      meanPlaceholder: '0.30',
      minLabel: 'Lowest plausible',
      minPlaceholder: '0.10',
      maxLabel: 'Highest plausible',
      maxPlaceholder: '0.60',
      guidance:
        'Your best guess at the overall probability of this event. ' +
        'The range captures your uncertainty about the baseline rate \u2014 ' +
        'not the variation in individual outcomes (which are always 0 or 1). ' +
        'Enter as a decimal: 0.30 means 30%.',
    };
  }

  if (link === 'logit') {
    // Beta (proportion)
    return {
      sublabel: 'The proportion you\'re trying to predict (0 to 1)',
      namePlaceholder: 'e.g., percent cover',
      meanLabel: 'Typical proportion',
      meanPlaceholder: '0.45',
      minLabel: 'Lowest plausible',
      minPlaceholder: '0.10',
      maxLabel: 'Highest plausible',
      maxPlaceholder: '0.80',
      guidance:
        'Values between 0 and 1. The range captures your uncertainty about ' +
        'the baseline proportion. Enter as a decimal: 0.45 means 45%.',
    };
  }

  if (link === 'log' && family === 'poisson') {
    return {
      sublabel: 'The count you\'re trying to predict',
      namePlaceholder: 'e.g., artifacts per unit',
      meanLabel: 'Expected count',
      meanPlaceholder: '5',
      minLabel: 'Lowest plausible',
      minPlaceholder: '1',
      maxLabel: 'Highest plausible',
      maxPlaceholder: '20',
      guidance:
        'The typical count you\u2019d expect. For the range, think: ' +
        '"I would be shocked to see fewer than [min] or more than [max]." ' +
        'All values must be positive (use 0.5 or 1 as a floor if needed).',
    };
  }

  if (link === 'log') {
    // Lognormal
    return {
      sublabel: 'What you\'re trying to predict (positive values only)',
      namePlaceholder: 'e.g., income',
      meanLabel: 'Typical value',
      meanPlaceholder: '45000',
      minLabel: 'Lowest plausible',
      minPlaceholder: '15000',
      maxLabel: 'Highest plausible',
      maxPlaceholder: '200000',
      guidance:
        'Must be positive. An approximate typical value is fine. ' +
        'For the range, think: "I would be shocked to see a value below [min] or above [max]." ' +
        'It\u2019s okay if these extend slightly beyond what you\u2019ve observed.',
    };
  }

  // Identity (gaussian) — default
  return {
    sublabel: 'What you\'re trying to predict or explain',
    namePlaceholder: 'e.g., lake elevation',
    meanLabel: 'Mean',
    meanPlaceholder: '63',
    minLabel: 'Min',
    minPlaceholder: '55',
    maxLabel: 'Max',
    maxPlaceholder: '70',
    guidance:
      'An approximate mean is fine. For min and max, think: "I would be ' +
      'shocked to see this value, but it is within the range of physical ' +
      'possibility." It is okay if these extend slightly beyond what you ' +
      'have observed or even slightly beyond physical limits \u2014 ' +
      'this allows the model to learn from your data rather than ' +
      'being constrained by your prior.',
  };
}

/** Step 3: Understand & adjust priors — describe variables in natural units */
export function StepDescribe({
  family,
  outcome,
  treatment,
  effectChangeInTreatment,
  effectChangeInOutcome,
  effectOutcomeAfter,
  onOutcomeChange,
  onTreatmentChange,
  onEffectTxChange,
  onEffectOutChange,
  onEffectAfterChange,
  onConfirm,
}: Props) {
  const link = family ? FAMILIES[family].link : 'identity';
  const outConfig = getOutcomeConfig(family);
  const isThresholdModel = family === 'cumulative' || family === 'categorical';

  const outValid = isThresholdModel
    ? outcome.name.trim() !== ''
    : outcome.name.trim() !== '' && outcome.plausibleMax > outcome.plausibleMin
      // For logit families, mean must be a valid probability (not 0 or 1)
      && (link !== 'logit' || (outcome.mean > 0 && outcome.mean < 1))
      // For log families, all values must be positive
      && (link !== 'log' || (outcome.mean > 0 && outcome.plausibleMin > 0));
  const txValid =
    treatment.name.trim() !== '' &&
    treatment.plausibleMax > treatment.plausibleMin;
  // Treatment change must be nonzero (need a reference amount),
  // but outcome change CAN be 0 (meaning "I expect no effect")
  const effectValid = effectChangeInTreatment !== 0;
  const allValid = outValid && txValid && effectValid;

  return (
    <div className="wizard-step">
      <div className="step-header">
        <span className="step-number">3</span>
        <span className="step-title">Understand &amp; adjust priors</span>
      </div>
      <p className="step-description">
        Describe your variables in their natural units. The wizard will show
        you what the standard priors mean for your specific data, and let you
        see how they translate across scales.
      </p>

      {/* Outcome variable */}
      {isThresholdModel ? (
        <div className="var-form-section">
          <div className="field-label" style={{ marginBottom: 2 }}>Outcome variable</div>
          <div className="form-sublabel">{outConfig.sublabel}</div>
          <div className="var-form-grid">
            <div className="field-group">
              <label className="field-label" style={{ fontSize: 10 }}>Name</label>
              <input
                className="text-input"
                type="text"
                value={outcome.name}
                onChange={(e) => onOutcomeChange({ ...outcome, name: e.target.value })}
                placeholder={outConfig.namePlaceholder}
              />
            </div>
            <div className="form-guidance">{outConfig.guidance}</div>
          </div>
        </div>
      ) : (
        <VariableForm
          label="Outcome variable"
          sublabel={outConfig.sublabel}
          desc={outcome}
          onChange={onOutcomeChange}
          namePlaceholder={outConfig.namePlaceholder}
          meanLabel={outConfig.meanLabel}
          meanPlaceholder={outConfig.meanPlaceholder}
          minLabel={outConfig.minLabel}
          minPlaceholder={outConfig.minPlaceholder}
          maxLabel={outConfig.maxLabel}
          maxPlaceholder={outConfig.maxPlaceholder}
          guidance={outConfig.guidance}
          step={link === 'logit' ? '0.01' : 'any'}
          positiveOnly={link === 'log'}
        />
      )}

      {/* Inline validation hints for outcome */}
      {!isThresholdModel && outcome.name.trim() !== '' && (
        <>
          {link === 'logit' && outcome.mean !== undefined && outcome.mean <= 0 && (
            <ValidationHint message="Baseline probability must be greater than 0." />
          )}
          {link === 'logit' && outcome.mean >= 1 && (
            <ValidationHint message="Baseline probability must be less than 1." />
          )}
          {link === 'log' && outcome.mean !== undefined && outcome.mean <= 0 && (
            <ValidationHint message="Typical value must be greater than 0." />
          )}
          {link === 'log' && outcome.plausibleMin <= 0 && outcome.plausibleMax > 0 && (
            <ValidationHint message="Lowest plausible value must be greater than 0." />
          )}
          {!isThresholdModel && outcome.plausibleMax <= outcome.plausibleMin
            && outcome.plausibleMax > 0 && outcome.plausibleMin > 0 && (
            <ValidationHint message="Max must be greater than min." />
          )}
        </>
      )}

      {/* Treatment variable — always the same */}
      <VariableForm
        label="Treatment variable"
        sublabel="The cause you're investigating (continuous)"
        desc={treatment}
        onChange={onTreatmentChange}
        namePlaceholder="e.g., annual rainfall"
        meanLabel="Mean"
        meanPlaceholder="450"
        minLabel="Min"
        minPlaceholder="200"
        maxLabel="Max"
        maxPlaceholder="800"
        guidance={
          'An approximate mean is fine. For min and max, think: "I would be ' +
          'shocked to see this value, but it is within the range of physical ' +
          'possibility." Note: this wizard currently assumes a continuous predictor.'
        }
      />

      {/* Inline validation hints for treatment */}
      {treatment.name.trim() !== '' && treatment.plausibleMax <= treatment.plausibleMin
        && treatment.plausibleMax > 0 && treatment.plausibleMin > 0 && (
        <ValidationHint message="Max must be greater than min." />
      )}

      {/* Expected effect — adapts to link type */}
      <div className="var-form-section">
        <div className="field-label" style={{ marginBottom: 2 }}>
          Expected effect
        </div>
        <div className="form-guidance">
          Your rough belief about how the treatment affects the outcome.
          This can be very broad &mdash; you can just think about whether
          you expect the effect to be positive or negative. Setting your
          prior expectation to 0 effect is a widely accepted standard
          approach that allows the model to learn entirely from your data.
        </div>

        {link === 'identity' ? (
          <EffectIdentity
            txName={treatment.name}
            outName={outcome.name}
            effectTx={effectChangeInTreatment}
            effectOut={effectChangeInOutcome}
            onEffectTxChange={onEffectTxChange}
            onEffectOutChange={onEffectOutChange}
          />
        ) : link === 'logit' ? (
          <EffectLogit
            txName={treatment.name}
            outName={outcome.name}
            baseValue={isThresholdModel ? 0.5 : outcome.mean}
            family={family}
            effectTx={effectChangeInTreatment}
            effectAfter={effectOutcomeAfter}
            onEffectTxChange={onEffectTxChange}
            onEffectAfterChange={onEffectAfterChange}
          />
        ) : (
          <EffectLog
            txName={treatment.name}
            outName={outcome.name}
            baseValue={outcome.mean}
            effectTx={effectChangeInTreatment}
            effectAfter={effectOutcomeAfter}
            onEffectTxChange={onEffectTxChange}
            onEffectAfterChange={onEffectAfterChange}
          />
        )}
      </div>

      {/* Validation hint for effect */}
      {!effectValid && effectChangeInTreatment === 0 && treatment.name.trim() !== '' && (
        <ValidationHint message="Enter a nonzero treatment change to define the effect." />
      )}

      {/* Confirm button */}
      {allValid && (
        <div style={{ marginTop: 20 }}>
          <button className="btn btn-primary" onClick={onConfirm}>
            Generate priors
          </button>
        </div>
      )}

      <WhyBox>
        <p>
          You're encoding what you know about the world <em>before</em>{' '}
          seeing the data. This is the foundation of Bayesian analysis:
          start with an honest belief, then let the data update it.
          If you set your range slightly wider than what you think is
          realistic, and the model's estimates stay inside that range,
          you know the data is doing the work &mdash; not the prior
          pulling the answer.
        </p>
      </WhyBox>
    </div>
  );
}

/** Effect form for identity link: "changes outcome by Y units" */
function EffectIdentity({
  txName,
  outName,
  effectTx,
  effectOut,
  onEffectTxChange,
  onEffectOutChange,
}: {
  txName: string;
  outName: string;
  effectTx: number;
  effectOut: number;
  onEffectTxChange: (v: number) => void;
  onEffectOutChange: (v: number) => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
        fontSize: 13,
        color: 'var(--pw-text-muted)',
      }}
    >
      <span>A change of</span>
      <NumberInput
        value={effectTx}
        onChange={onEffectTxChange}
        style={{ width: 90 }}
        placeholder="100"
      />
      <span>
        in {txName || 'treatment'} changes{' '}
        {outName || 'outcome'} by roughly
      </span>
      <NumberInput
        value={effectOut}
        onChange={onEffectOutChange}
        style={{ width: 90 }}
        placeholder="3"
      />
      <span>units.</span>
    </div>
  );
}

/** Effect form for logit link: "changes probability from X to Y" */
function EffectLogit({
  txName,
  outName,
  baseValue,
  family,
  effectTx,
  effectAfter,
  onEffectTxChange,
  onEffectAfterChange,
}: {
  txName: string;
  outName: string;
  baseValue: number;
  family: OutcomeFamily | null;
  effectTx: number;
  effectAfter: number;
  onEffectTxChange: (v: number) => void;
  onEffectAfterChange: (v: number) => void;
}) {
  const isThreshold = family === 'cumulative' || family === 'categorical';
  const word = family === 'cumulative'
    ? 'probability of being in a higher category'
    : family === 'categorical'
      ? 'probability of a given category (relative to the reference)'
      : family === 'bernoulli'
        ? 'probability'
        : 'proportion';
  const baseProp = baseValue ? baseValue.toFixed(2) : '...';
  const sentenceMiddle = isThreshold
    ? `in ${txName || 'treatment'}: at a category boundary (0.50), the ${word} changes to`
    : `in ${txName || 'treatment'} changes the ${word} of ${outName || 'outcome'} from ${baseProp} to`;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
        fontSize: 13,
        color: 'var(--pw-text-muted)',
      }}
    >
      <span>A change of</span>
      <NumberInput
        value={effectTx}
        onChange={onEffectTxChange}
        style={{ width: 90 }}
        placeholder="100"
      />
      <span>{sentenceMiddle}</span>
      <NumberInput
        value={effectAfter}
        onChange={(v) => onEffectAfterChange(Math.max(0.001, Math.min(0.999, v)))}
        step="0.01"
        style={{ width: 90 }}
        placeholder={isThreshold ? '0.65' : '0.45'}
      />
      <div className="form-guidance" style={{ width: '100%', marginTop: 4 }}>
        {family === 'cumulative'
          ? `Enter as a proportion (0.65 means 65%). Imagine someone right at the boundary between two categories. `
            + `After this treatment change, what's the chance they'd be in the higher category? `
            + `This tells us the strength of the effect on the logit scale.`
          : family === 'categorical'
          ? `Enter as a proportion (0.65 means 65%). Starting at 50/50 odds between two categories, `
            + `how much does the treatment shift the balance? `
            + `This tells us the strength of the effect on the logit scale.`
          : `Enter as a proportion (0.45 means 45%). This tells us how much the ${word} `
            + `shifts for a realistic change in ${txName || 'treatment'}.`
        }
      </div>
    </div>
  );
}

/** Effect form for log link: "changes outcome by X%" */
function EffectLog({
  txName,
  outName,
  baseValue,
  effectTx,
  effectAfter,
  onEffectTxChange,
  onEffectAfterChange,
}: {
  txName: string;
  outName: string;
  baseValue: number;
  effectTx: number;
  effectAfter: number;
  onEffectTxChange: (v: number) => void;
  onEffectAfterChange: (v: number) => void;
}) {
  // Display percentage; derive absolute "after" value for the parent
  const pctDisplay = baseValue > 0 && effectAfter > 0
    ? (effectAfter / baseValue - 1) * 100
    : 0;

  const handlePctChange = (pct: number) => {
    if (baseValue > 0) {
      onEffectAfterChange(baseValue * (1 + pct / 100));
    }
  };

  const afterDisplay = baseValue > 0 && effectAfter > 0
    ? Math.round(effectAfter)
    : null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
        fontSize: 13,
        color: 'var(--pw-text-muted)',
      }}
    >
      <span>A change of</span>
      <NumberInput
        value={effectTx}
        onChange={onEffectTxChange}
        style={{ width: 90 }}
        placeholder="100"
      />
      <span>
        in {txName || 'treatment'} changes {outName || 'outcome'} by approximately
      </span>
      <NumberInput
        value={Math.round(pctDisplay)}
        onChange={handlePctChange}
        style={{ width: 80 }}
        placeholder="20"
      />
      <span>%</span>
      {baseValue > 0 && (
        <span style={{ color: 'var(--pw-text-muted)' }}>
          (from a baseline of {baseValue}{afterDisplay != null ? ` to ${afterDisplay}` : ''})
        </span>
      )}
      <div className="form-guidance" style={{ width: '100%', marginTop: 4 }}>
        Because this is a log-normal outcome, effects are multiplicative.
        A positive percentage means {outName || 'outcome'} increases;
        a negative percentage means it decreases.
        Values must be positive (percentage cannot go below &minus;100%).
      </div>
    </div>
  );
}

/** Reusable form for describing one variable */
function VariableForm({
  label,
  sublabel,
  desc,
  onChange,
  namePlaceholder,
  meanLabel,
  meanPlaceholder,
  minLabel,
  minPlaceholder,
  maxLabel,
  maxPlaceholder,
  guidance,
  step = 'any',
  positiveOnly = false,
}: {
  label: string;
  sublabel: string;
  desc: VariableDescription;
  onChange: (v: VariableDescription) => void;
  namePlaceholder: string;
  meanLabel: string;
  meanPlaceholder: string;
  minLabel: string;
  minPlaceholder: string;
  maxLabel: string;
  maxPlaceholder: string;
  guidance: string;
  step?: string;
  /** Enforce positive values (for log-link families) */
  positiveOnly?: boolean;
}) {
  // Clamp to 0-1 for proportion/logit inputs, or enforce positive for log-link
  const clamp = (v: number) => {
    if (step === '0.01') return Math.max(0, Math.min(1, v));
    if (positiveOnly) return Math.max(0.01, v);
    return v;
  };

  return (
    <div className="var-form-section">
      <div className="field-label" style={{ marginBottom: 2 }}>{label}</div>
      <div className="form-sublabel">{sublabel}</div>
      <div className="var-form-grid">
        <div className="field-group">
          <label className="field-label" style={{ fontSize: 10 }}>
            Name
          </label>
          <input
            className="text-input"
            type="text"
            value={desc.name}
            onChange={(e) => onChange({ ...desc, name: e.target.value })}
            placeholder={namePlaceholder}
          />
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div className="field-group" style={{ flex: 1 }}>
            <label className="field-label" style={{ fontSize: 10 }}>
              {meanLabel}
            </label>
            <NumberInput
              value={desc.mean}
              onChange={(v) => onChange({ ...desc, mean: clamp(v) })}
              step={step}
              placeholder={meanPlaceholder}
            />
          </div>
          <div className="field-group" style={{ flex: 1 }}>
            <label className="field-label" style={{ fontSize: 10 }}>
              {minLabel}
            </label>
            <NumberInput
              value={desc.plausibleMin}
              onChange={(v) => onChange({ ...desc, plausibleMin: clamp(v) })}
              step={step}
              placeholder={minPlaceholder}
            />
          </div>
          <div className="field-group" style={{ flex: 1 }}>
            <label className="field-label" style={{ fontSize: 10 }}>
              {maxLabel}
            </label>
            <NumberInput
              value={desc.plausibleMax}
              onChange={(v) => onChange({ ...desc, plausibleMax: clamp(v) })}
              step={step}
              placeholder={maxPlaceholder}
            />
          </div>
        </div>
        <div className="form-guidance">{guidance}</div>
      </div>
    </div>
  );
}

/** Small inline validation hint */
function ValidationHint({ message }: { message: string }) {
  return (
    <div style={{
      fontSize: 12,
      color: 'var(--pw-orange, #e8a838)',
      padding: '4px 12px',
      marginTop: -4,
      marginBottom: 8,
    }}>
      ⚠ {message}
    </div>
  );
}
