import { memo, useState, useCallback, useMemo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { Estimand } from '../../types/dag';
import { useEstiplanStore } from '../../store/useEstiplanStore';
import { findBackdoorAdjustmentSet } from '../../dag/dseparation';
import {
  REASON_TOOLTIPS,
  BAD_CONTROL_TOOLTIPS,
  IDENTIFIABILITY_TOOLTIPS,
  SECTION_TOOLTIPS,
  ESTIMAND_KIND_TOOLTIPS,
} from '../../dag/explanations';
import { InfoTip } from './InfoTip';
import styles from './EstimandCard.module.css';

/**
 * EstimandCard — the causal question.
 * Shows: kind badge, plain English, do-calculus notation.
 * Has a "Generate Model" button that previews backdoor analysis
 * before creating the separate ModelCard.
 */
function EstimandCardComponent({ id, data }: NodeProps) {
  const estimand = data as unknown as Estimand;
  const [showAnalysis, setShowAnalysis] = useState(false);

  const removeEstimand = useEstiplanStore((s) => s.removeEstimand);
  const generateModelForEstimand = useEstiplanStore(
    (s) => s.generateModelForEstimand,
  );
  const setHighlightedEstimand = useEstiplanStore(
    (s) => s.setHighlightedEstimand,
  );
  const highlightedEstimandId = useEstiplanStore(
    (s) => s.highlightedEstimandId,
  );
  const variables = useEstiplanStore((s) => s.variables);
  const causalEdges = useEstiplanStore((s) => s.causalEdges);

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

  // Run backdoor analysis for preview
  const backdoorResult = useMemo(() => {
    if (!showAnalysis) return null;
    const unobservedIds = new Set<string>();
    variables.forEach((v) => {
      if (v.variableType === 'unobserved') unobservedIds.add(v.id);
    });
    return findBackdoorAdjustmentSet(
      causalEdges,
      estimand.sourceId,
      estimand.targetId,
      estimand.excludedMediators,
      unobservedIds,
    );
  }, [showAnalysis, causalEdges, variables, estimand.sourceId, estimand.targetId, estimand.excludedMediators]);

  const handleCreateModel = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      generateModelForEstimand(id, variables, causalEdges);
      setShowAnalysis(false);
    },
    [id, generateModelForEstimand, variables, causalEdges],
  );

  const hasModel = estimand.modelId !== null;

  return (
    <div
      className={styles.estimandCard}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button className={styles.closeButton} onClick={handleClose}>
        &times;
      </button>

      <InfoTip
        text={estimand.kind === 'total'
          ? ESTIMAND_KIND_TOOLTIPS.total
          : ESTIMAND_KIND_TOOLTIPS.direct}
        align="left"
      >
        <div className={styles.kindBadge}>
          {estimand.kind === 'total' ? 'Total Effect' : 'Direct Effect'}
        </div>
      </InfoTip>
      <div className={styles.plainEnglish}>{estimand.plainEnglish}</div>
      <div className={styles.doNotation}>{estimand.doNotation}</div>

      {/* ── Generate Model section ── */}
      {!hasModel && !showAnalysis && (
        <button
          className={`${styles.generateButton} nodrag nopan`}
          onClick={(e) => {
            e.stopPropagation();
            setShowAnalysis(true);
          }}
        >
          Generate Statistical Model&hellip;
        </button>
      )}

      {!hasModel && showAnalysis && backdoorResult && (
        <div className={`${styles.analysisPreview} nodrag nopan`}>
          <div className={styles.analysisDivider} />
          <InfoTip text={SECTION_TOOLTIPS.backdoorAnalysis} align="left">
            <div className={styles.analysisLabel}>Backdoor Analysis</div>
          </InfoTip>

          {backdoorResult.identifiable ? (
            <InfoTip text={IDENTIFIABILITY_TOOLTIPS.identifiable} align="left">
              <div className={styles.analysisOk}>
                &#x2713; Causal effect identifiable
              </div>
            </InfoTip>
          ) : (
            <InfoTip text={IDENTIFIABILITY_TOOLTIPS.notIdentifiable} align="left">
              <div className={styles.analysisWarn}>
                &#x26A0; No sufficient adjustment set
              </div>
            </InfoTip>
          )}

          {backdoorResult.adjustmentSet.length > 0 && (
            <div className={styles.analysisSection}>
              <InfoTip text={SECTION_TOOLTIPS.conditioningOn} align="left">
                <div className={styles.analysisSectionLabel}>
                  Good controls (condition on):
                </div>
              </InfoTip>
              {backdoorResult.adjustmentSet.map((entry) => {
                const v = variables.get(entry.variableId);
                if (!v) return null;
                const label = entry.reason === 'fork'
                  ? 'fork'
                  : entry.reason === 'pipe-backdoor'
                    ? 'pipe'
                    : 'fix';
                return (
                  <div key={entry.variableId} className={styles.analysisItem}>
                    <InfoTip text={REASON_TOOLTIPS[entry.reason] || ''}>
                      <span className={styles.analysisTag}>
                        {label}
                      </span>
                    </InfoTip>
                    {v.name}
                  </div>
                );
              })}
            </div>
          )}

          {backdoorResult.badControls.length > 0 && (
            <div className={styles.analysisSection}>
              <InfoTip text={SECTION_TOOLTIPS.doNotConditionOn} align="left">
                <div className={styles.analysisSectionLabel}>
                  Bad controls (do NOT condition on):
                </div>
              </InfoTip>
              {backdoorResult.badControls.map((warning) => {
                const v = variables.get(warning.variableId);
                if (!v) return null;
                const label = warning.type === 'collider'
                  ? 'collider'
                  : warning.type === 'mediator-total'
                    ? 'mediator'
                    : 'post-tx';
                const badTip = BAD_CONTROL_TOOLTIPS[warning.type] || warning.explanation;
                return (
                  <div
                    key={warning.variableId}
                    className={styles.analysisItemWarn}
                  >
                    <InfoTip text={badTip}>
                      <span className={styles.analysisTagBad}>
                        {label}
                      </span>
                    </InfoTip>
                    {v.name}
                  </div>
                );
              })}
            </div>
          )}

          {backdoorResult.adjustmentSet.length === 0 &&
            backdoorResult.badControls.length === 0 && (
              <div className={styles.analysisNote}>
                No confounds detected &mdash; simple bivariate model
              </div>
            )}

          <div className={styles.analysisActions}>
            <button
              className={styles.createModelButton}
              onClick={handleCreateModel}
            >
              Create Model Card
            </button>
            <button
              className={styles.cancelButton}
              onClick={(e) => {
                e.stopPropagation();
                setShowAnalysis(false);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {hasModel && (
        <div className={styles.modelLinked}>
          &#x2713; Model generated
        </div>
      )}

      {/* Hidden handles so React Flow can draw connector edges */}
      <Handle type="target" position={Position.Top} style={{ opacity: 0, pointerEvents: 'none' }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, pointerEvents: 'none' }} />
    </div>
  );
}

export const EstimandCard = memo(EstimandCardComponent);
