import { memo, useCallback } from 'react';
import type { NodeProps } from '@xyflow/react';
import type { Estimand } from '../../types/dag';
import { useEstiplanStore } from '../../store/useEstiplanStore';
import styles from './EstimandCard.module.css';

function EstimandCardComponent({ id, data }: NodeProps) {
  const estimand = data as unknown as Estimand;
  const removeEstimand = useEstiplanStore((s) => s.removeEstimand);
  const setHighlightedEstimand = useEstiplanStore(
    (s) => s.setHighlightedEstimand,
  );
  const highlightedEstimandId = useEstiplanStore(
    (s) => s.highlightedEstimandId,
  );

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

  return (
    <div
      className={styles.estimandCard}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button className={styles.closeButton} onClick={handleClose}>
        x
      </button>
      <div className={styles.kindBadge}>
        {estimand.kind === 'total' ? 'Total Effect' : 'Direct Effect'}
      </div>
      <div className={styles.plainEnglish}>{estimand.plainEnglish}</div>
      <div className={styles.doNotation}>{estimand.doNotation}</div>
    </div>
  );
}

export const EstimandCard = memo(EstimandCardComponent);
