import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { Variable } from '../../types/dag';
import { VARIABLE_TYPE_LABELS } from '../../types/dag';
import { useEstiplanStore } from '../../store/useEstiplanStore';
import styles from './VariableNode.module.css';

function VariableNodeComponent({ id, data }: NodeProps) {
  const variable = data as unknown as Variable;
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(variable.name);
  const [hoveredHandle, setHoveredHandle] = useState<
    'source' | 'target' | null
  >(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const updateVariable = useEstiplanStore((s) => s.updateVariable);
  const highlightedPaths = useEstiplanStore((s) => s.highlightedPaths);
  const flowDirection = useEstiplanStore((s) => s.flowDirection);

  const isTB = flowDirection === 'TB';

  const isHighlighted =
    highlightedPaths !== null &&
    highlightedPaths.some((path) => path.includes(id));
  const isDimmed = highlightedPaths !== null && !isHighlighted;

  const handleDoubleClick = useCallback(() => {
    setEditValue(variable.name);
    setEditing(true);
  }, [variable.name]);

  const handleConfirm = useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== variable.name) {
      updateVariable(id, { name: trimmed });
    }
    setEditing(false);
  }, [editValue, variable.name, id, updateVariable]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleConfirm();
      if (e.key === 'Escape') setEditing(false);
    },
    [handleConfirm],
  );

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const circleClasses = [
    styles.circle,
    isHighlighted ? styles.circleHighlighted : '',
    isDimmed ? styles.circleDimmed : '',
    variable.variableType === 'unobserved' ? styles.circleUnobserved : '',
  ]
    .filter(Boolean)
    .join(' ');

  // TB: target TOP, source BOTTOM, labels RIGHT
  // LR: target LEFT, source RIGHT, labels BELOW
  const targetPosition = isTB ? Position.Top : Position.Left;
  const sourcePosition = isTB ? Position.Bottom : Position.Right;
  const triangleClass = isTB ? styles.triangleDown : styles.triangleRight;
  const labelClass = isTB ? styles.labelRight : styles.labelBelow;

  return (
    <div className={styles.variableNode}>
      {/* Target handle: circle — "is affected by..." */}
      <Handle
        type="target"
        position={targetPosition}
        className={`${styles.handle} ${styles.handleCircle}`}
        onMouseEnter={() => setHoveredHandle('target')}
        onMouseLeave={() => setHoveredHandle(null)}
      />
      {hoveredHandle === 'target' && (
        <div
          className={`${styles.handleTooltip} ${isTB ? styles.tooltipAbove : styles.tooltipLeft}`}
        >
          is affected by&hellip;
        </div>
      )}

      {/* The main circle */}
      <div className={circleClasses} onDoubleClick={handleDoubleClick}>
        <span className={styles.shorthand}>{variable.shorthand}</span>
      </div>

      {/* Source handle: triangle — "affects..." */}
      <Handle
        type="source"
        position={sourcePosition}
        className={`${styles.handle} ${styles.handleTriangle} ${triangleClass}`}
        onMouseEnter={() => setHoveredHandle('source')}
        onMouseLeave={() => setHoveredHandle(null)}
      />
      {hoveredHandle === 'source' && (
        <div
          className={`${styles.handleTooltip} ${isTB ? styles.tooltipBelow : styles.tooltipRight}`}
        >
          affects&hellip;
        </div>
      )}

      {/* Labels: absolutely positioned so they don't affect bounding box */}
      <div className={`${styles.labelGroup} ${labelClass}`}>
        {editing ? (
          <input
            ref={inputRef}
            className={styles.nameInput}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleConfirm}
            onKeyDown={handleKeyDown}
          />
        ) : (
          <div className={styles.name} onDoubleClick={handleDoubleClick}>
            {variable.name}
          </div>
        )}

        <div className={styles.typeBadge}>
          {VARIABLE_TYPE_LABELS[variable.variableType]}
        </div>
      </div>
    </div>
  );
}

export const VariableNode = memo(VariableNodeComponent);
