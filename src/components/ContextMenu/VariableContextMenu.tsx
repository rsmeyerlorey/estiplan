import { useState, useRef, useEffect } from 'react';
import { ContextMenu } from './ContextMenu';
import { useEstiplanStore } from '../../store/useEstiplanStore';
import {
  VARIABLE_TYPE_LABELS,
  VARIABLE_TYPE_GROUPS,
  type VariableType,
} from '../../types/dag';
import { EstimandSubMenu } from './EstimandSubMenu';
import styles from './ContextMenu.module.css';

interface Props {
  nodeId: string;
  x: number;
  y: number;
  onClose: () => void;
}

type SubView =
  | 'main'
  | 'editName'
  | 'editShorthand'
  | 'setType'
  | 'estimandForward'
  | 'estimandReverse';

export function VariableContextMenu({ nodeId, x, y, onClose }: Props) {
  const [view, setView] = useState<SubView>('main');
  const variable = useEstiplanStore((s) => s.variables.get(nodeId));
  const updateVariable = useEstiplanStore((s) => s.updateVariable);
  const setVariableType = useEstiplanStore((s) => s.setVariableType);
  const setVariableShorthand = useEstiplanStore(
    (s) => s.setVariableShorthand,
  );
  const deleteVariable = useEstiplanStore((s) => s.deleteVariable);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (
      (view === 'editName' || view === 'editShorthand') &&
      inputRef.current
    ) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [view]);

  if (!variable) return null;

  if (view === 'estimandForward') {
    return (
      <EstimandSubMenu
        anchorId={nodeId}
        direction="forward"
        x={x}
        y={y}
        onClose={onClose}
        onBack={() => setView('main')}
      />
    );
  }

  if (view === 'estimandReverse') {
    return (
      <EstimandSubMenu
        anchorId={nodeId}
        direction="reverse"
        x={x}
        y={y}
        onClose={onClose}
        onBack={() => setView('main')}
      />
    );
  }

  if (view === 'editName') {
    return (
      <ContextMenu x={x} y={y} onClose={onClose}>
        <div className={styles.subMenuLabel}>Edit Name</div>
        <div className={styles.inputRow}>
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const trimmed = editValue.trim();
                if (trimmed) updateVariable(nodeId, { name: trimmed });
                onClose();
              }
              if (e.key === 'Escape') setView('main');
            }}
            placeholder="Variable name..."
          />
        </div>
      </ContextMenu>
    );
  }

  if (view === 'editShorthand') {
    return (
      <ContextMenu x={x} y={y} onClose={onClose}>
        <div className={styles.subMenuLabel}>Edit Shorthand</div>
        <div className={styles.inputRow}>
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const trimmed = editValue.trim();
                if (trimmed) setVariableShorthand(nodeId, trimmed);
                onClose();
              }
              if (e.key === 'Escape') setView('main');
            }}
            placeholder="e.g., H"
            maxLength={3}
          />
        </div>
      </ContextMenu>
    );
  }

  if (view === 'setType') {
    return (
      <ContextMenu x={x} y={y} onClose={onClose}>
        <div className={styles.subMenuLabel}>Set Variable Type</div>
        {VARIABLE_TYPE_GROUPS.map((group) => (
          <div key={group.label} className={styles.typeGroup}>
            <div className={styles.typeGroupLabel}>{group.label}</div>
            {group.types.map(({ type, label }) => (
              <button
                key={type}
                className={styles.menuItem}
                onClick={() => {
                  setVariableType(nodeId, type);
                  onClose();
                }}
              >
                {variable.variableType === type ? '\u2713 ' : '  '}
                {label}
              </button>
            ))}
          </div>
        ))}
        <div className={styles.separator} />
        <button className={styles.menuItem} onClick={() => setView('main')}>
          &larr; Back
        </button>
      </ContextMenu>
    );
  }

  // Main menu
  return (
    <ContextMenu x={x} y={y} onClose={onClose}>
      <button
        className={styles.menuItem}
        onClick={() => {
          setEditValue(variable.name);
          setView('editName');
        }}
      >
        Edit Name
      </button>
      <button
        className={styles.menuItem}
        onClick={() => {
          setEditValue(variable.shorthand);
          setView('editShorthand');
        }}
      >
        Change Shorthand ({variable.shorthand})
      </button>
      <button
        className={styles.menuItem}
        onClick={() => setView('setType')}
      >
        Set Type ({VARIABLE_TYPE_LABELS[variable.variableType]})
      </button>
      <div className={styles.separator} />
      <button
        className={styles.menuItem}
        onClick={() => setView('estimandForward')}
      >
        What is the effect on&hellip;?
      </button>
      <button
        className={styles.menuItem}
        onClick={() => setView('estimandReverse')}
      >
        What affects {variable.name}?
      </button>
      <div className={styles.separator} />
      <button
        className={`${styles.menuItem} ${styles.menuItemDanger}`}
        onClick={() => {
          deleteVariable(nodeId);
          onClose();
        }}
      >
        Delete Variable
      </button>
    </ContextMenu>
  );
}
