import { memo, useState, useCallback } from 'react';
import type { NodeProps } from '@xyflow/react';
import type { Estimand } from '../../types/dag';
import { useEstiplanStore } from '../../store/useEstiplanStore';
import styles from './EstimandCard.module.css';

function EstimandCardComponent({ id, data }: NodeProps) {
  const estimand = data as unknown as Estimand;
  const [showInfo, setShowInfo] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  const removeEstimand = useEstiplanStore((s) => s.removeEstimand);
  const setHighlightedEstimand = useEstiplanStore(
    (s) => s.setHighlightedEstimand,
  );
  const highlightedEstimandId = useEstiplanStore(
    (s) => s.highlightedEstimandId,
  );
  const toggleEstimandInteraction = useEstiplanStore(
    (s) => s.toggleEstimandInteraction,
  );
  const variables = useEstiplanStore((s) => s.variables);

  const handleMouseEnter = useCallback(() => {
    setHighlightedEstimand(id);
  }, [id, setHighlightedEstimand]);

  const handleMouseLeave = useCallback(() => {
    if (highlightedEstimandId === id) {
      setHighlightedEstimand(null);
    }
  }, [id, highlightedEstimandId, setHighlightedEstimand]);

  const handleClose = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      removeEstimand(id);
    },
    [id, removeEstimand],
  );

  const handleToggleInteraction = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      toggleEstimandInteraction(id, variables);
    },
    [id, toggleEstimandInteraction, variables],
  );

  const handleCopyCode = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(estimand.brmsCode);
        setCodeCopied(true);
        setTimeout(() => setCodeCopied(false), 1500);
      } catch {
        // Clipboard API may not be available
      }
    },
    [estimand.brmsCode],
  );

  const hasConditionedVars =
    estimand.kind === 'direct' && estimand.excludedMediators.length > 0;

  return (
    <div
      className={styles.estimandCard}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button className={styles.closeButton} onClick={handleClose}>
        &times;
      </button>

      {/* ── Estimand section ── */}
      <div className={styles.kindBadge}>
        {estimand.kind === 'total' ? 'Total Effect' : 'Direct Effect'}
      </div>
      <div className={styles.plainEnglish}>{estimand.plainEnglish}</div>
      <div className={styles.doNotation}>{estimand.doNotation}</div>

      {/* ── Divider ── */}
      <div className={styles.divider} />

      {/* ── Model section ── */}
      <div className={styles.sectionLabel}>Model</div>
      <div className={styles.mathBlock}>
        {estimand.mathLines.map((line, i) => (
          <div key={i} className={styles.mathLine}>
            {line}
          </div>
        ))}
      </div>

      {/* ── brms code section ── */}
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
        <code>{estimand.brmsCode}</code>
      </pre>

      {/* ── Interaction toggle (only for direct effects with mediators) ── */}
      {hasConditionedVars && (
        <label className={styles.toggleRow} onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={estimand.interaction}
            onChange={() => toggleEstimandInteraction(id, variables)}
          />
          <span className={styles.toggleLabel}>
            Allow slopes to vary by{' '}
            {variables.get(estimand.sourceId)?.name || 'treatment'}
          </span>
        </label>
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
    </div>
  );
}

export const EstimandCard = memo(EstimandCardComponent);
