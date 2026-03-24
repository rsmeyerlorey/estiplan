import type { StateCreator } from 'zustand';
import type { Variable, VariableType } from '../../types/dag';
import { generateId } from '../../utils/id';
import { generateShorthand } from '../../utils/shorthand';

export interface VariableSlice {
  variables: Map<string, Variable>;
  addVariable: (name: string) => string;
  updateVariable: (id: string, updates: Partial<Omit<Variable, 'id'>>) => void;
  removeVariable: (id: string) => void;
  setVariableType: (id: string, variableType: VariableType) => void;
  setVariableShorthand: (id: string, shorthand: string) => void;
}

export const createVariableSlice: StateCreator<
  VariableSlice,
  [],
  [],
  VariableSlice
> = (set, get) => ({
  variables: new Map(),

  addVariable: (name: string) => {
    const id = generateId('var');
    const existingShorthands = new Set(
      Array.from(get().variables.values()).map((v) => v.shorthand),
    );
    const shorthand = generateShorthand(name, existingShorthands);
    const variable: Variable = {
      id,
      name,
      shorthand,
      variableType: 'continuous',
    };

    set((state) => {
      const newVars = new Map(state.variables);
      newVars.set(id, variable);
      return { variables: newVars };
    });

    return id;
  },

  updateVariable: (id, updates) => {
    set((state) => {
      const newVars = new Map(state.variables);
      const existing = newVars.get(id);
      if (existing) {
        newVars.set(id, { ...existing, ...updates });
      }
      return { variables: newVars };
    });
  },

  removeVariable: (id) => {
    set((state) => {
      const newVars = new Map(state.variables);
      newVars.delete(id);
      return { variables: newVars };
    });
  },

  setVariableType: (id, variableType) => {
    get().updateVariable(id, { variableType });
  },

  setVariableShorthand: (id, shorthand) => {
    get().updateVariable(id, { shorthand });
  },
});
