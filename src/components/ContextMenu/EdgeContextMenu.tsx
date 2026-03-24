import { useState, useRef, useEffect } from 'react';
import { ContextMenu } from './ContextMenu';
import { useEstiplanStore } from '../../store/useEstiplanStore';
import styles from './ContextMenu.module.css';

interface Props {
  edgeId: string;
  x: number;
  y: number;
  onClose: () => void;
}

export function EdgeContextMenu({ edgeId, x, y, onClose }: Props) {
  const [editing, setEditing] = useState(false);
  const [annotation, setAnnotation] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const edge = useEstiplanStore((s) =>
    s.causalEdges.find((e) => e.id === edgeId),
  );
  const updateEdgeAnnotation = useEstiplanStore(
    (s) => s.updateEdgeAnnotation,
  );
  const removeCausalEdge = useEstiplanStore((s) => s.removeCausalEdge);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editing]);

  if (!edge) return null;

  if (editing) {
    return (
      <ContextMenu x={x} y={y} onClose={onClose}>
        <div className={styles.subMenuLabel}>Edge Annotation</div>
        <div className={styles.inputRow}>
          <input
            ref={inputRef}
            value={annotation}
            onChange={(e) => setAnnotation(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                updateEdgeAnnotation(edgeId, annotation);
                onClose();
              }
              if (e.key === 'Escape') setEditing(false);
            }}
            placeholder="e.g., positive, strong..."
          />
        </div>
      </ContextMenu>
    );
  }

  return (
    <ContextMenu x={x} y={y} onClose={onClose}>
      <button
        className={styles.menuItem}
        onClick={() => {
          setAnnotation(edge.data.annotation || '');
          setEditing(true);
        }}
      >
        {edge.data.annotation ? 'Edit Annotation' : 'Add Annotation'}
      </button>
      <div className={styles.separator} />
      <button
        className={`${styles.menuItem} ${styles.menuItemDanger}`}
        onClick={() => {
          removeCausalEdge(edgeId);
          onClose();
        }}
      >
        Delete Edge
      </button>
    </ContextMenu>
  );
}
