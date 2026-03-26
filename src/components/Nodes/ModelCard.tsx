import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { StatisticalModel } from '../../types/dag';
import { useEstiplanStore } from '../../store/useEstiplanStore';
import {
  REASON_TOOLTIPS,
  BAD_CONTROL_TOOLTIPS,
  IDENTIFIABILITY_TOOLTIPS,
  TABLE_TWO_TOOLTIP,
  SECTION_TOOLTIPS,
  reasonLabel,
  badControlLabel,
} from '../../dag/explanations';
import { InfoTip } from './InfoTip';
import styles from './ModelCard.module.css';

/**
 * ModelCard — the statistical strategy for answering a causal question.
 * Shows: adjustment set with reasons, bad control warnings,
 * math notation, brms code, interaction toggle, Table Two note.
 */
function ModelCardComponent({ id, data }: NodeProps) {
  const model = data as unknown as StatisticalModel;
  const [showInfo, setShowInfo] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [cardWidth, setCardWidth] = useState(360);
  const cardRef = useRef<HTMLDivElement>(null);

  const [showPriors, setShowPriors] = useState(false);
  const [editingPriorIdx, setEditingPriorIdx] = useState<number | null>(null);
  const [editingPriorValue, setEditingPriorValue] = useState('');
  const priorInputRef = useRef<HTMLInputElement>(null);

  const toggleModelInteraction = useEstiplanStore(
    (s) => s.toggleModelInteraction,
  );
  const updateModelPrior = useEstiplanStore((s) => s.updateModelPrior);
  const removeModel = useEstiplanStore((s) => s.removeModel);
  const setHighlightedEstimand = useEstiplanStore(
    (s) => s.setHighlightedEstimand,
  );
  const setHighlightedModel = useEstiplanStore(
    (s) => s.setHighlightedModel,
  );
  const highlightedEstimandId = useEstiplanStore(
    (s) => s.highlightedEstimandId,
  );
  const variables = useEstiplanStore((s) => s.variables);

  const handleMouseEnter = useCallback(() => {
    setHighlightedEstimand(model.estimandId);
    setHighlightedModel(id);
  }, [id, model.estimandId, setHighlightedEstimand, setHighlightedModel]);

  const handleMouseLeave = useCallback(() => {
    if (highlightedEstimandId === model.estimandId) {
      setHighlightedEstimand(null);
    }
    setHighlightedModel(null);
  }, [model.estimandId, highlightedEstimandId, setHighlightedEstimand, setHighlightedModel]);

  const handleCopyCode = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(model.brmsCode);
        setCodeCopied(true);
        setTimeout(() => setCodeCopied(false), 1500);
      } catch {
        // Clipboard API may not be available
      }
    },
    [model.brmsCode],
  );

  const onResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = cardWidth;
      const onMouseMove = (ev: MouseEvent) => {
        const delta = ev.clientX - startX;
        setCardWidth(Math.max(220, startWidth + delta));
      };
      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [cardWidth],
  );

  useEffect(() => {
    if (editingPriorIdx !== null && priorInputRef.current) {
      priorInputRef.current.focus();
      priorInputRef.current.select();
    }
  }, [editingPriorIdx]);

  const handlePriorEdit = useCallback(
    (idx: number) => {
      setEditingPriorIdx(idx);
      setEditingPriorValue(model.priors[idx].prior);
    },
    [model.priors],
  );

  const handlePriorCommit = useCallback(() => {
    if (editingPriorIdx !== null && editingPriorValue.trim()) {
      updateModelPrior(id, editingPriorIdx, editingPriorValue.trim(), variables);
    }
    setEditingPriorIdx(null);
  }, [id, editingPriorIdx, editingPriorValue, updateModelPrior, variables]);

  const hasConditionedVars =
    model.conditionedOn.length > 0 || model.excludedMediators.length > 0;

  const treatmentName =
    variables.get(model.sourceId)?.name || 'treatment';

  // Determine reason tag style
  const getReasonTagClass = (reason: string) => {
    if (reason === 'fork') return styles.reasonTagFork;
    if (reason === 'pipe-backdoor') return styles.reasonTagPipe;
    if (reason === 'opened-collider') return styles.reasonTagCollider;
    return styles.reasonTagFork;
  };

  return (
    <div
      ref={cardRef}
      className={styles.modelCard}
      style={{ width: cardWidth }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* ── Close button ── */}
      <button
        className={styles.closeButton}
        onClick={(e) => {
          e.stopPropagation();
          removeModel(id);
        }}
      >
        &times;
      </button>

      {/* ── Header ── */}
      <div className={styles.header}>
        <span className={styles.headerBadge}>Statistical Model</span>
      </div>

      {/* ── Identifiability ── */}
      {model.identifiable ? (
        model.adjustmentSet.length > 0 && (
          <InfoTip text={IDENTIFIABILITY_TOOLTIPS.identifiable} align="left" tag="div">
            <div className={styles.identOk}>
              &#x2713; Causal effect is identifiable via backdoor adjustment
            </div>
          </InfoTip>
        )
      ) : (
        <InfoTip text={IDENTIFIABILITY_TOOLTIPS.notIdentifiable} align="left" tag="div">
          <div className={styles.identWarn}>
            &#x26A0; No sufficient adjustment set found &mdash; consider
            additional assumptions or measurements
          </div>
        </InfoTip>
      )}

      {/* ── Adjustment set (good controls) ── */}
      {model.adjustmentSet.length > 0 && (
        <div className={styles.adjustmentSection}>
          <InfoTip text={SECTION_TOOLTIPS.conditioningOn} align="left" tag="div">
            <div className={styles.sectionLabel}>Conditioning on</div>
          </InfoTip>
          {model.adjustmentSet.map((entry) => {
            const v = variables.get(entry.variableId);
            if (!v) return null;
            return (
              <div key={entry.variableId} className={styles.adjustmentItem}>
                <span className={styles.adjustmentName}>
                  {v.name} ({v.shorthand})
                </span>
                <InfoTip text={REASON_TOOLTIPS[entry.reason] || ''}>
                  <span className={getReasonTagClass(entry.reason)}>
                    {reasonLabel(entry.reason)}
                  </span>
                </InfoTip>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Bad controls (warnings) ── */}
      {model.badControls.length > 0 && (
        <div className={styles.warningSection}>
          <InfoTip text={SECTION_TOOLTIPS.doNotConditionOn} align="left" tag="div">
            <div className={styles.sectionLabel}>Do not condition on</div>
          </InfoTip>
          {model.badControls.map((warning) => {
            const v = variables.get(warning.variableId);
            if (!v) return null;
            const badTip = BAD_CONTROL_TOOLTIPS[warning.type] || warning.explanation;
            return (
              <div key={warning.variableId} className={styles.warningItem}>
                <InfoTip text={badTip}>
                  <span className={styles.warningBadge}>
                    {badControlLabel(warning.type)}
                  </span>
                </InfoTip>
                <span className={styles.warningText}>
                  <strong>{v.name}</strong>
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className={styles.divider} />

      {/* ── Math notation ── */}
      <div className={styles.sectionLabel}>Model</div>
      <div className={styles.mathBlock}>
        {model.mathLines.map((line, i) => (
          <div key={i} className={styles.mathLine}>
            {line}
          </div>
        ))}
      </div>

      {/* ── Priors (collapsible) ── */}
      {model.priors && model.priors.length > 0 && (
        <div className={styles.priorsSection}>
          <button
            className={styles.priorsToggle}
            onClick={(e) => { e.stopPropagation(); setShowPriors(!showPriors); }}
          >
            <span className={styles.sectionLabel} style={{ marginBottom: 0 }}>
              Priors {showPriors ? '\u25B4' : '\u25BE'}
            </span>
          </button>
          {showPriors && (
            <>
              <div className={styles.priorsNote}>
                Assumes centered &amp; standardized predictors. Click a prior to edit.
              </div>
              <div className={styles.priorsList}>
                {model.priors.map((p, idx) => (
                  <div key={idx} className={styles.priorItem}>
                    <span className={styles.priorLabel}>{p.label}</span>
                    {editingPriorIdx === idx ? (
                      <input
                        ref={priorInputRef}
                        className={`${styles.priorInput} nodrag nopan`}
                        value={editingPriorValue}
                        onChange={(e) => setEditingPriorValue(e.target.value)}
                        onBlur={handlePriorCommit}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handlePriorCommit();
                          if (e.key === 'Escape') setEditingPriorIdx(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <button
                        className={styles.priorValue}
                        onClick={(e) => { e.stopPropagation(); handlePriorEdit(idx); }}
                        title="Click to edit"
                      >
                        {p.prior}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── brms code ── */}
      <div className={styles.sectionLabel}>
        brms
        <button
          className={styles.copyButton}
          onClick={handleCopyCode}
          title="Copy code"
        >
          {codeCopied ? '\u2713' : '\u2398'}
        </button>
      </div>
      <pre className={styles.codeBlock}>
        <code>{model.brmsCode}</code>
      </pre>

      {/* ── Interaction toggle ── */}
      {hasConditionedVars && (
        <label
          className={styles.toggleRow}
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={model.interaction}
            onChange={() => toggleModelInteraction(id, variables)}
          />
          <span className={styles.toggleLabel}>
            Allow slopes to vary by {treatmentName}
          </span>
        </label>
      )}

      {/* ── Table Two Fallacy note ── */}
      {model.conditionedOn.length > 0 && (
        <InfoTip text={TABLE_TWO_TOOLTIP} align="left" tag="div">
          <div className={styles.tableTwoNote}>
            Note: Only the coefficient for {treatmentName} is a causal effect.
            Coefficients on adjustment variables are not causal estimates (Table
            Two Fallacy).
          </div>
        </InfoTip>
      )}

      {/* ── Info tooltip ── */}
      <div className={styles.infoRow}>
        <button
          className={styles.infoButton}
          onClick={(e) => {
            e.stopPropagation();
            setShowInfo(!showInfo);
          }}
          title="Data preparation tips"
        >
          &#x24D8;
        </button>
        {showInfo && (
          <div className={styles.infoPopup}>
            Always do proper data preparation before model fitting &mdash; you
            may want to center continuous predictors, adjust variable scales,
            check for missing data, or verify factor levels.
          </div>
        )}
      </div>

      {/* ── Resize handle ── */}
      <div
        className={`${styles.resizeHandle} nopan nodrag`}
        onMouseDown={onResizeStart}
      />

      {/* Hidden handles so React Flow can draw connector edges */}
      <Handle type="target" position={Position.Top} style={{ opacity: 0, pointerEvents: 'none' }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, pointerEvents: 'none' }} />
    </div>
  );
}

export const ModelCard = memo(ModelCardComponent);
