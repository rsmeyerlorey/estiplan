import { useState, useRef, useCallback } from 'react';
import { useEstiplanStore } from '../../store/useEstiplanStore';
import styles from './Toolbar.module.css';

export function Toolbar() {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const addVariable = useEstiplanStore((s) => s.addVariable);
  const setNodePosition = useEstiplanStore((s) => s.setNodePosition);
  const autoLayout = useEstiplanStore((s) => s.autoLayout);
  const toggleTheme = useEstiplanStore((s) => s.toggleTheme);
  const theme = useEstiplanStore((s) => s.theme);
  const flowDirection = useEstiplanStore((s) => s.flowDirection);
  const toggleFlowDirection = useEstiplanStore((s) => s.toggleFlowDirection);

  const handleAdd = useCallback(() => {
    if (adding) {
      const trimmed = name.trim();
      if (trimmed) {
        const id = addVariable(trimmed);
        // Place roughly in the center area with some randomness
        const x = 200 + Math.random() * 300;
        const y = 150 + Math.random() * 200;
        setNodePosition(id, x, y);
      }
      setName('');
      setAdding(false);
    } else {
      setAdding(true);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [adding, name, addVariable, setNodePosition]);

  const handleToggleDirection = useCallback(() => {
    toggleFlowDirection();
    // Re-layout after changing direction
    setTimeout(() => autoLayout(), 0);
  }, [toggleFlowDirection, autoLayout]);

  return (
    <div className={styles.toolbar}>
      <span className={styles.title}>Estiplan</span>

      {adding && (
        <input
          ref={inputRef}
          className={styles.addInput}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd();
            if (e.key === 'Escape') {
              setName('');
              setAdding(false);
            }
          }}
          onBlur={() => {
            if (!name.trim()) setAdding(false);
          }}
          placeholder="Variable name..."
        />
      )}

      <button className={styles.btn} onClick={handleAdd}>
        {adding ? 'Confirm' : '+ Add Variable'}
      </button>

      <button className={styles.btn} onClick={autoLayout}>
        Auto Layout
      </button>

      <button
        className={styles.btn}
        onClick={handleToggleDirection}
        title={
          flowDirection === 'TB'
            ? 'Switch to left-to-right flow'
            : 'Switch to top-to-bottom flow'
        }
      >
        {flowDirection === 'TB' ? '\u2B07 Top\u2013Down' : '\u27A1 Left\u2013Right'}
      </button>

      <div className={styles.spacer} />

      <button className={styles.btn} onClick={toggleTheme}>
        {theme === 'whiteboard' ? 'Chalkboard' : 'Whiteboard'}
      </button>
    </div>
  );
}
