import { memo } from 'react';
import {
  getBezierPath,
  EdgeLabelRenderer,
  type EdgeProps,
} from '@xyflow/react';
import type { CausalEdgeData } from '../../types/dag';
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

  return (
    <>
      <path id={id} className={pathClasses} d={edgePath} markerEnd={markerEnd} />
      {edgeData?.annotation && (
        <EdgeLabelRenderer>
          <div
            className={styles.annotationLabel}
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            {edgeData.annotation}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const CausalArrow = memo(CausalArrowComponent);
