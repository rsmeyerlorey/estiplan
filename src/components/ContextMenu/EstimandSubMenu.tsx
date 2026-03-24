import { useState, useMemo } from 'react';
import { ContextMenu } from './ContextMenu';
import { useEstiplanStore } from '../../store/useEstiplanStore';
import { findAllPaths, buildAdjacency } from '../../dag/pathfinding';
import { findMediators } from '../../dag/mediators';
import type { EstimandKind } from '../../types/dag';
import styles from './ContextMenu.module.css';

/**
 * EstimandSubMenu — declares the causal question (estimand).
 * The backdoor analysis and model generation happen later,
 * on the EstimandCard itself via the "Generate Model" button.
 */

interface Props {
  anchorId: string;
  direction: 'forward' | 'reverse';
  x: number;
  y: number;
  onClose: () => void;
  onBack: () => void;
}

type Step = 'pickOther' | 'pickKind' | 'pickMediators';

export function EstimandSubMenu({
  anchorId,
  direction,
  x,
  y,
  onClose,
  onBack,
}: Props) {
  const [step, setStep] = useState<Step>('pickOther');
  const [otherId, setOtherId] = useState<string | null>(null);
  const [selectedMediators, setSelectedMediators] = useState<Set<string>>(
    new Set(),
  );

  const variables = useEstiplanStore((s) => s.variables);
  const causalEdges = useEstiplanStore((s) => s.causalEdges);
  const declareEstimand = useEstiplanStore((s) => s.declareEstimand);

  const anchor = variables.get(anchorId);

  const sourceId = direction === 'forward' ? anchorId : otherId;
  const targetId = direction === 'forward' ? otherId : anchorId;

  const otherVariables = useMemo(
    () => Array.from(variables.values()).filter((v) => v.id !== anchorId),
    [variables, anchorId],
  );

  const reachableSources = useMemo(() => {
    if (direction !== 'reverse') return null;
    const adj = buildAdjacency(causalEdges);
    return otherVariables.filter((v) => {
      const paths = findAllPaths(adj, v.id, anchorId);
      return paths.length > 0;
    });
  }, [direction, causalEdges, otherVariables, anchorId]);

  const paths = useMemo(() => {
    if (!sourceId || !targetId) return [];
    const adj = buildAdjacency(causalEdges);
    return findAllPaths(adj, sourceId, targetId);
  }, [sourceId, targetId, causalEdges]);

  const mediators = useMemo(() => {
    if (!sourceId || !targetId) return [];
    return findMediators(paths, sourceId, targetId)
      .map((id) => variables.get(id))
      .filter((v) => v !== undefined);
  }, [paths, sourceId, targetId, variables]);

  if (!anchor) return null;

  const handleDeclare = (
    kind: EstimandKind,
    excluded: string[] = [],
  ) => {
    if (!sourceId || !targetId) return;
    declareEstimand(
      sourceId,
      targetId,
      kind,
      excluded,
      variables,
      causalEdges,
    );
    onClose();
  };

  // Step 1: Pick the other variable
  if (step === 'pickOther') {
    const label =
      direction === 'forward'
        ? `Effect of ${anchor.name} on\u2026`
        : `What affects ${anchor.name}?`;

    const candidates =
      direction === 'reverse' && reachableSources
        ? otherVariables.map((v) => ({
            variable: v,
            hasPath: reachableSources.some((rs) => rs.id === v.id),
          }))
        : otherVariables.map((v) => ({ variable: v, hasPath: true }));

    return (
      <ContextMenu x={x} y={y} onClose={onClose}>
        <div className={styles.subMenuLabel}>{label}</div>
        {candidates.length === 0 ? (
          <div className={styles.menuItem} style={{ opacity: 0.5 }}>
            No other variables
          </div>
        ) : (
          candidates.map(({ variable: v, hasPath }) => (
            <button
              key={v.id}
              className={styles.menuItem}
              style={hasPath ? undefined : { opacity: 0.4 }}
              title={
                hasPath
                  ? undefined
                  : `No causal path from ${v.name} to ${anchor.name}`
              }
              onClick={() => {
                setOtherId(v.id);
                setStep('pickKind');
              }}
            >
              {v.name} ({v.shorthand})
              {!hasPath && ' \u2014 no path'}
            </button>
          ))
        )}
        <div className={styles.separator} />
        <button className={styles.menuItem} onClick={onBack}>
          &larr; Back
        </button>
      </ContextMenu>
    );
  }

  const source = sourceId ? variables.get(sourceId) : null;
  const target = targetId ? variables.get(targetId) : null;

  // Step 2: Pick effect kind
  if (step === 'pickKind') {
    return (
      <ContextMenu x={x} y={y} onClose={onClose}>
        <div className={styles.subMenuLabel}>
          Effect of {source?.name} on {target?.name}
        </div>
        <button
          className={styles.menuItem}
          onClick={() => handleDeclare('total')}
        >
          Total causal effect
        </button>
        {mediators.length > 0 && (
          <button
            className={styles.menuItem}
            onClick={() => {
              setSelectedMediators(new Set(mediators.map((m) => m.id)));
              setStep('pickMediators');
            }}
          >
            Direct effect (exclude mediators)...
          </button>
        )}
        {paths.length === 0 && (
          <div
            className={styles.menuItem}
            style={{ opacity: 0.5, cursor: 'default' }}
          >
            No causal paths found
          </div>
        )}
        <div className={styles.separator} />
        <button
          className={styles.menuItem}
          onClick={() => {
            setOtherId(null);
            setStep('pickOther');
          }}
        >
          &larr; Back
        </button>
      </ContextMenu>
    );
  }

  // Step 3: Pick which mediators to exclude
  if (step === 'pickMediators') {
    return (
      <ContextMenu x={x} y={y} onClose={onClose}>
        <div className={styles.subMenuLabel}>Exclude paths through:</div>
        {mediators.map((m) => (
          <label key={m.id} className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={selectedMediators.has(m.id)}
              onChange={() => {
                setSelectedMediators((prev) => {
                  const next = new Set(prev);
                  if (next.has(m.id)) next.delete(m.id);
                  else next.add(m.id);
                  return next;
                });
              }}
            />
            {m.name} ({m.shorthand})
          </label>
        ))}
        <div className={styles.separator} />
        <button
          className={styles.menuItem}
          onClick={() =>
            handleDeclare('direct', Array.from(selectedMediators))
          }
        >
          Declare Estimand
        </button>
        <button
          className={styles.menuItem}
          onClick={() => setStep('pickKind')}
        >
          &larr; Back
        </button>
      </ContextMenu>
    );
  }

  return null;
}
