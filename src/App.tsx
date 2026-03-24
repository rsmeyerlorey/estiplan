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
