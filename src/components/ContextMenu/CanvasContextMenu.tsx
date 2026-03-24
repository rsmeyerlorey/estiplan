import { useState, useRef, useEffect } from 'react';
import { ContextMenu } from './ContextMenu';
import { useEstiplanStore } from '../../store/useEstiplanStore';
import styles from './ContextMenu.module.css';

interface Props {
  x: number;
  y: number;
  canvasX: number;
  canvasY: number;
  onClose: () => void;
}

export function CanvasContextMenu({
  x,
  y,
  canvasX,
  canvasY,
  onClose,
}: Props) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const addVariable = useEstiplanStore((s) => s.addVariable);
  const setNodePosition = useEstiplanStore((s) => s.setNodePosition);
  const autoLayout = useEstiplanStore((s) => s.autoLayout);

  useEffect(() => {
    if (adding && inputRef.current) {
      inputRef.current.focus();
    }
  }, [adding]);

  if (adding) {
    return (
      <ContextMenu x={x} y={y} onClose={onClose}>
        <div className={styles.subMenuLabel}>New Variable</div>
        <div className={styles.inputRow}>
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const trimmed = name.trim();
                if (trimmed) {
                  const id = addVariable(trimmed);
                  setNodePosition(id, canvasX - 32, canvasY - 32);
                }
                onClose();
              }
              if (e.key === 'Escape') onClose();
            }}
            placeholder="Variable name..."
          />
        </div>
      </ContextMenu>
    );
  }

  return (
    <ContextMenu x={x} y={y} onClose={onClose}>
      <button
        className={styles.menuItem}
        onClick={() => setAdding(true)}
      >
        Add Variable Here
      </button>
      <button
        className={styles.menuItem}
        onClick={() => {
          autoLayout();
          onClose();
        }}
      >
        Auto Layout
      </button>
    </ContextMenu>
  );
}
