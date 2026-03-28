import { useState, useRef, useCallback, useEffect } from 'react';
import { useEstiplanStore } from '../../store/useEstiplanStore';
import type { SavedState } from '../../store/persistence';
import styles from './Toolbar.module.css';

export function Toolbar() {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [aboutOpen, setAboutOpen] = useState(false);
  const aboutRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close about panel when clicking outside
  useEffect(() => {
    if (!aboutOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (aboutRef.current && !aboutRef.current.contains(e.target as Node)) {
        setAboutOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [aboutOpen]);

  const addVariable = useEstiplanStore((s) => s.addVariable);
  const setNodePosition = useEstiplanStore((s) => s.setNodePosition);
  const autoLayout = useEstiplanStore((s) => s.autoLayout);
  const toggleTheme = useEstiplanStore((s) => s.toggleTheme);
  const theme = useEstiplanStore((s) => s.theme);
  const flowDirection = useEstiplanStore((s) => s.flowDirection);
  const toggleFlowDirection = useEstiplanStore((s) => s.toggleFlowDirection);
  const clearAll = useEstiplanStore((s) => s.clearAll);
  const loadState = useEstiplanStore((s) => s.loadState);
  const getSerializableState = useEstiplanStore((s) => s.getSerializableState);
  const undo = useEstiplanStore((s) => s.undo);
  const redo = useEstiplanStore((s) => s.redo);
  const canUndo = useEstiplanStore((s) => s.canUndo);
  const canRedo = useEstiplanStore((s) => s.canRedo);

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

  const handleNew = useCallback(() => {
    if (
      window.confirm(
        'Start a new estiplan? Unsaved changes will be lost.',
      )
    ) {
      clearAll();
    }
  }, [clearAll]);

  const handleSave = useCallback(() => {
    const planName = window.prompt('Name your estiplan:', 'my-estiplan');
    if (!planName) return; // User cancelled

    const sanitized = planName.trim().replace(/[^a-zA-Z0-9_\-\s]/g, '').replace(/\s+/g, '-') || 'estiplan';
    const state = getSerializableState();
    const json = JSON.stringify(state, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sanitized}.estiplan.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [getSerializableState]);

  const handleLoad = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const parsed = JSON.parse(ev.target?.result as string) as SavedState;
          if (parsed.version !== 1) {
            alert('Invalid estiplan file: unsupported version.');
            return;
          }
          if (!Array.isArray(parsed.variables) || !Array.isArray(parsed.causalEdges)) {
            alert('Invalid estiplan file: missing required data.');
            return;
          }
          loadState(parsed);
        } catch {
          alert('Failed to load file. Make sure it is a valid .estiplan.json file.');
        }
      };
      reader.readAsText(file);

      // Reset the input so the same file can be loaded again
      e.target.value = '';
    },
    [loadState],
  );

  const handleDuplicateVariant = useCallback(() => {
    const planName = window.prompt('Save current estiplan as:', 'estiplan-original');
    if (!planName) return; // User cancelled

    const sanitized = planName.trim().replace(/[^a-zA-Z0-9_\-\s]/g, '').replace(/\s+/g, '-') || 'estiplan-original';

    // Export current state first
    const state = getSerializableState();
    const json = JSON.stringify(state, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sanitized}.estiplan.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Now clear estimands from the canvas (keep variables and edges)
    // Load current state but with empty estimands
    const variant: SavedState = {
      ...state,
      estimands: [],
    };
    // Offset all positions slightly so user sees the change
    const offsetPositions = { ...variant.nodePositions };
    for (const key of Object.keys(offsetPositions)) {
      offsetPositions[key] = {
        x: offsetPositions[key].x + 20,
        y: offsetPositions[key].y + 20,
      };
    }
    variant.nodePositions = offsetPositions;
    loadState(variant);
  }, [getSerializableState, loadState]);

  return (
    <div className={styles.toolbar}>
      <div className={styles.titleWrap} ref={aboutRef}>
        <span
          className={styles.title}
          onClick={() => setAboutOpen(!aboutOpen)}
          style={{ cursor: 'pointer' }}
          title="About Estiplan"
        >
          Estiplan
        </span>
        {aboutOpen && (
          <div className={styles.aboutPanel}>
            <p className={styles.aboutBlurb}>
              <em>Estimand</em> comes from Latin — you can think of it as the{' '}
              <strong>esti</strong>mate you de<strong>mand</strong> from your data.
            </p>
            <p className={styles.aboutBlurb}>
              Estiplan is a tool that helps you define a scientific model, choose an
              estimand, and plan a statistical approach for answering your questions.
            </p>
            <p className={styles.aboutMeta}>
              Inspired by Richard McElreath's{' '}
              <a
                href="https://github.com/rmcelreath/stat_rethinking_2026"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.aboutLink}
              >
                Statistical Rethinking
              </a>{' '}
              (2026).
            </p>
          </div>
        )}
      </div>

      <button className={styles.btn} onClick={handleNew} title="New estiplan">
        New
      </button>

      <div className={styles.separator} />

      <button className={styles.btn} onClick={handleSave} title="Save to file">
        Save
      </button>
      <button className={styles.btn} onClick={handleLoad} title="Load from file">
        Load
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.estiplan.json"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      <div className={styles.separator} />

      <button
        className={styles.btn}
        onClick={undo}
        disabled={!canUndo()}
        title="Undo (Ctrl+Z)"
      >
        Undo
      </button>
      <button
        className={styles.btn}
        onClick={redo}
        disabled={!canRedo()}
        title="Redo (Ctrl+Y)"
      >
        Redo
      </button>

      <div className={styles.separator} />

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

      <button
        className={styles.btn}
        onClick={handleDuplicateVariant}
        title="Export current state, then clear estimands for a variant"
      >
        Duplicate as variant
      </button>

      <div className={styles.spacer} />

      <button className={styles.btn} onClick={toggleTheme}>
        {theme === 'whiteboard' ? 'Chalkboard' : 'Whiteboard'}
      </button>
    </div>
  );
}
