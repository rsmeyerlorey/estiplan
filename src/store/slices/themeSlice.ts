import type { StateCreator } from 'zustand';
import type { ThemeMode, FlowDirection } from '../../types/theme';

export interface ThemeSlice {
  theme: ThemeMode;
  flowDirection: FlowDirection;
  toggleTheme: () => void;
  setTheme: (theme: ThemeMode) => void;
  toggleFlowDirection: () => void;
  setFlowDirection: (dir: FlowDirection) => void;
}

export const createThemeSlice: StateCreator<ThemeSlice, [], [], ThemeSlice> = (
  set,
) => ({
  theme: 'whiteboard',
  flowDirection: 'TB',
  toggleTheme: () =>
    set((state) => ({
      theme: state.theme === 'whiteboard' ? 'chalkboard' : 'whiteboard',
    })),
  setTheme: (theme) => set({ theme }),
  toggleFlowDirection: () =>
    set((state) => ({
      flowDirection: state.flowDirection === 'TB' ? 'LR' : 'TB',
    })),
  setFlowDirection: (flowDirection) => set({ flowDirection }),
});
