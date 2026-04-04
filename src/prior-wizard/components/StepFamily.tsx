import { useState } from 'react';
import { FAMILY_GROUPS, type OutcomeFamily } from '../lib/types';
import { MiniDist } from './MiniDist';
import { WhyBox } from './WhyBox';

interface Props {
  value: OutcomeFamily | null;
  onChange: (f: OutcomeFamily) => void;
  /** When true, selection is locked (pre-filled from Estiplan) */
  locked?: boolean;
}

/** Step 1: What kind of outcome variable do you have? */
export function StepFamily({ value, onChange, locked = false }: Props) {
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  const handleGroupClick = (label: string) => {
    setExpandedGroup(expandedGroup === label ? null : label);
  };

  return (
    <div className="wizard-step">
      <div className="step-header">
        <span className="step-number">1</span>
        <span className="step-title">What kind of outcome do you have?</span>
      </div>
      <p className="step-description">
        The outcome variable determines the model family, which determines
        what scale your priors operate on. This is the single most important
        choice for setting priors.
      </p>
      <div className="option-cards">
        {FAMILY_GROUPS.map((group) => {
          const isExpanded = expandedGroup === group.label;
          const groupHasSelection = group.families.some(
            (f) => f.family === value,
          );

          return (
            <div key={group.label}>
              {/* Group header */}
              <div
                className={`option-card ${groupHasSelection ? 'selected' : ''}`}
                onClick={() => handleGroupClick(group.label)}
                style={{ cursor: 'pointer' }}
              >
                <div className="option-card-title">
                  {isExpanded ? '\u25B4' : '\u25BE'} {group.label}
                  {groupHasSelection && (
                    <span style={{
                      fontSize: 11,
                      fontWeight: 400,
                      color: 'var(--pw-accent)',
                      marginLeft: 8,
                    }}>
                      {group.families.find((f) => f.family === value)?.label}
                    </span>
                  )}
                </div>
                <div className="option-card-desc">{group.description}</div>
              </div>

              {/* Expanded: guidance note + family options */}
              {isExpanded && (
                <div style={{ paddingLeft: 20, marginTop: 4, marginBottom: 4 }}>
                  {/* Family options */}
                  <div className="option-cards">
                    {group.families.map((f) => (
                      <div
                        key={f.family}
                        className={`option-card ${value === f.family ? 'selected' : ''}`}
                        onClick={() => !locked && onChange(f.family)}
                        style={locked ? { opacity: value === f.family ? 1 : 0.4, pointerEvents: 'none' } : undefined}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1 }}>
                            <div className="option-card-title">{f.label}</div>
                            <div className="option-card-desc">{f.description}</div>
                          </div>
                          <MiniDist family={f.family} />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Group-level guidance (below options) */}
                  {group.guidance && (
                    <div style={{
                      fontSize: 12,
                      color: 'var(--pw-text-muted)',
                      padding: '10px 14px',
                      background: 'var(--pw-surface-raised)',
                      borderRadius: 6,
                      borderLeft: '3px solid var(--pw-accent)',
                      marginTop: 8,
                      lineHeight: 1.5,
                    }}>
                      {group.guidance}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <WhyBox>
        Different outcome types require different probability distributions.
        A binary outcome (yes/no) can't use a Gaussian model because Gaussian
        allows any real number. A count variable can't be negative or fractional.
        The model family encodes these constraints, and it determines the{' '}
        <em>link function</em> &mdash; the mathematical transformation that
        connects your predictors to the outcome. Your priors live on this
        transformed scale, which is why understanding the family comes first.
      </WhyBox>
    </div>
  );
}
