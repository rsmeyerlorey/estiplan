import type { Variable } from '../types/dag';
import type { Estimand } from '../types/dag';
import type { CausalEdge } from './slices/edgeSlice';
import type { NodePositions } from './useEstiplanStore';

export interface HistorySnapshot {
  variables: [string, Variable][];
  causalEdges: CausalEdge[];
  estimands: Estimand[];
  nodePositions: NodePositions;
}

const MAX_HISTORY = 50;

export class HistoryManager {
  private undoStack: HistorySnapshot[] = [];
  private redoStack: HistorySnapshot[] = [];
  private _paused = false;

  /** Pause snapshot capturing (e.g. during undo/redo apply) */
  pause() {
    this._paused = true;
  }

  resume() {
    this._paused = false;
  }

  get isPaused() {
    return this._paused;
  }

  push(snapshot: HistorySnapshot) {
    if (this._paused) return;
    this.undoStack.push(snapshot);
    if (this.undoStack.length > MAX_HISTORY) {
      this.undoStack.shift();
    }
    // Any new action clears the redo stack
    this.redoStack = [];
  }

  undo(current: HistorySnapshot): HistorySnapshot | null {
    if (this.undoStack.length === 0) return null;
    const previous = this.undoStack.pop()!;
    this.redoStack.push(current);
    return previous;
  }

  redo(current: HistorySnapshot): HistorySnapshot | null {
    if (this.redoStack.length === 0) return null;
    const next = this.redoStack.pop()!;
    this.undoStack.push(current);
    return next;
  }

  get canUndo() {
    return this.undoStack.length > 0;
  }

  get canRedo() {
    return this.redoStack.length > 0;
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
  }
}

/** Singleton instance used by the store */
export const historyManager = new HistoryManager();
