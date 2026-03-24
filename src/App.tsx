import { useEffect } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { useEstiplanStore } from './store/useEstiplanStore';
import { Toolbar } from './components/Toolbar/Toolbar';
import { EstiplanCanvas } from './components/Canvas/EstiplanCanvas';
import whiteboardStyles from './themes/whiteboard.module.css';
import chalkboardStyles from './themes/chalkboard.module.css';
import appStyles from './App.module.css';

function App() {
  const theme = useEstiplanStore((s) => s.theme);

  const themeClass =
    theme === 'whiteboard'
      ? whiteboardStyles.whiteboard
      : chalkboardStyles.chalkboard;

  // Global keyboard shortcuts for undo/redo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't intercept when typing in an input
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        useEstiplanStore.getState().undo();
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === 'y' || (e.key === 'z' && e.shiftKey))
      ) {
        e.preventDefault();
        useEstiplanStore.getState().redo();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className={`${appStyles.app} ${themeClass}`}>
      <ReactFlowProvider>
        <Toolbar />
        <EstiplanCanvas />
      </ReactFlowProvider>
    </div>
  );
}

export default App;
