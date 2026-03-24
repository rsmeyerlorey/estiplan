import { memo, useState, useCallback } from 'react';
import {
  getBezierPath,
  EdgeLabelRenderer,
  type EdgeProps,
} from '@xyflow/react';
import type { CausalEdgeData } from '../../types/dag';
import { useEstiplanStore } from '../../store/useEstiplanStore';
import styles from './CausalArrow.module.css';

type CausalArrowData = CausalEdgeData & {
  isHighlighted?: boolean;
  isDimmed?: boolean;
};

function CausalArrowComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
}: EdgeProps) {
  const edgeData = data as CausalArrowData | undefined;
  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  const updateEdgeAnnotation = useEstiplanStore(
    (s) => s.updateEdgeAnnotation,
  );
  const flowDirection = useEstiplanStore((s) => s.flowDirection);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const pathClasses = [
    styles.edgePath,
    edgeData?.isHighlighted ? styles.edgePathHighlighted : '',
    edgeData?.isDimmed ? styles.edgePathDimmed : '',
  ]
    .filter(Boolean)
    .join(' ');

  const handleSquareClick = useCallback(() => {
    setEditValue(edgeData?.annotation || '');
    setEditing(true);
  }, [edgeData?.annotation]);

  const handleConfirm = useCallback(() => {
    updateEdgeAnnotation(id, editValue.trim());
    setEditing(false);
  }, [id, editValue, updateEdgeAnnotation]);

  // Annotation/square offset: right of line in TB, below line in LR
  const isTB = flowDirection === 'TB';
  const offsetX = isTB ? 14 : 0;
  const offsetY = isTB ? 0 : 14;

  return (
    <>
      {/* Invisible wider path for easier hovering */}
      <path
        className={styles.edgePathHitArea}
        d={edgePath}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      {/* Visible path */}
      <path
        id={id}
        className={pathClasses}
        d={edgePath}
        markerEnd={markerEnd}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />

      <EdgeLabelRenderer>
        {/* Hoverable square handle at midpoint — always visible on hover or if annotated */}
        {(hovered || edgeData?.annotation || editing) && (
          <div
            className={styles.midpointArea}
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
            {/* The square handle */}
            {!edgeData?.annotation && !editing && (
              <button
                className={styles.squareHandle}
                onClick={handleSquareClick}
                title="Add annotation"
              />
            )}

            {/* Inline editor */}
            {editing && (
              <div
                className={styles.annotationEditor}
                style={{
                  [isTB ? 'marginLeft' : 'marginTop']: '8px',
                }}
              >
                <input
                  className={styles.annotationInput}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleConfirm();
                    if (e.key === 'Escape') setEditing(false);
                  }}
                  onBlur={handleConfirm}
                  autoFocus
                  placeholder="e.g., positive, strong..."
                />
              </div>
            )}
          </div>
        )}

        {/* Annotation label — offset to side */}
        {edgeData?.annotation && !editing && (
          <div
            className={styles.annotationLabel}
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX + offsetX}px, ${labelY + offsetY}px)`,
              cursor: 'pointer',
            }}
            onClick={handleSquareClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
            {edgeData.annotation}
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  );
}

export const CausalArrow = memo(CausalArrowComponent);
