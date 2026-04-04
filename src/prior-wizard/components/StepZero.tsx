interface Props {
  outcomeName: string;
  treatmentName: string;
  onOutcomeNameChange: (name: string) => void;
  onTreatmentNameChange: (name: string) => void;
  /** When true, fields are read-only (pre-filled from Estiplan) */
  locked?: boolean;
}

/**
 * Step 0: Name your variables.
 * Quick setup — get the names so the rest of the wizard can use them.
 */
export function StepZero({
  outcomeName,
  treatmentName,
  onOutcomeNameChange,
  onTreatmentNameChange,
  locked = false,
}: Props) {
  return (
    <div className="wizard-step">
      <div className="step-header">
        <span className="step-number" style={{ background: 'var(--pw-orange)' }}>
          0
        </span>
        <span className="step-title">Name your variables</span>
      </div>
      <p className="step-description">
        Before choosing a model, have your data open. Run{' '}
        <code
          style={{
            fontFamily: 'var(--pw-font-mono)',
            fontSize: 11,
            background: 'var(--pw-surface-raised)',
            padding: '1px 4px',
            borderRadius: 3,
          }}
        >
          summary(d)
        </code>{' '}
        and{' '}
        <code
          style={{
            fontFamily: 'var(--pw-font-mono)',
            fontSize: 11,
            background: 'var(--pw-surface-raised)',
            padding: '1px 4px',
            borderRadius: 3,
          }}
        >
          hist(d$outcome)
        </code>{' '}
        in R. Know the shape, center, and spread of your variables.
      </p>

      <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
        <div className="field-group" style={{ flex: 1 }}>
          <label className="field-label">Outcome variable</label>
          <div
            style={{
              fontSize: 11,
              color: 'var(--pw-text-muted)',
              marginBottom: 4,
            }}
          >
            What you're trying to predict or explain
          </div>
          <input
            type="text"
            className="text-input"
            placeholder="e.g., elevation, survival, artifact count"
            value={outcomeName}
            onChange={(e) => onOutcomeNameChange(e.target.value)}
            disabled={locked}
            style={locked ? { opacity: 0.7 } : undefined}
          />
        </div>

        <div className="field-group" style={{ flex: 1 }}>
          <label className="field-label">Predictor variable</label>
          <div
            style={{
              fontSize: 11,
              color: 'var(--pw-text-muted)',
              marginBottom: 4,
            }}
          >
            The cause or treatment you're investigating
          </div>
          <input
            type="text"
            className="text-input"
            placeholder="e.g., rainfall, treatment group, depth"
            value={treatmentName}
            onChange={(e) => onTreatmentNameChange(e.target.value)}
            disabled={locked}
            style={locked ? { opacity: 0.7 } : undefined}
          />
        </div>
      </div>
    </div>
  );
}
