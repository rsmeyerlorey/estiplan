import { useEffect, useState, useCallback, useRef } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { useEstiplanStore } from './store/useEstiplanStore';
import { Toolbar } from './components/Toolbar/Toolbar';
import { EstiplanCanvas } from './components/Canvas/EstiplanCanvas';
import { PriorWizardPanel } from './prior-wizard/PriorWizardPanel';
import { variableTypeToFamily } from './prior-wizard/familyMap';
import type { PriorResult } from './prior-wizard/PriorWizard';
import type { WizardContext } from './prior-wizard/wizardEvents';
import type { OutcomeFamily } from './prior-wizard/lib/types';
import type { VariableType } from './types/dag';
import whiteboardStyles from './themes/whiteboard.module.css';
import chalkboardStyles from './themes/chalkboard.module.css';
import appStyles from './App.module.css';

type PanelMode = 'closed' | 'menu' | 'wizard';

const MENU_WIDTH = 320;
const WIZARD_DEFAULT_WIDTH_RATIO = 0.6; // 60% of viewport
const WIZARD_MIN_WIDTH = 360;

function App() {
  const theme = useEstiplanStore((s) => s.theme);
  const [panelMode, setPanelMode] = useState<PanelMode>('closed');
  const [wizardWidth, setWizardWidth] = useState<number | null>(null);
  const [priorsAppliedFlash, setPriorsAppliedFlash] = useState(false);
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up flash timeout on unmount
  useEffect(() => {
    return () => {
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    };
  }, []);

  // Context from a model card — pre-fills the wizard
  const [wizardContext, setWizardContext] = useState<{
    modelId: string;
    outcomeName: string;
    treatmentName: string;
    outcomeFamily?: OutcomeFamily;
  } | null>(null);

  const themeClass =
    theme === 'whiteboard'
      ? whiteboardStyles.whiteboard
      : chalkboardStyles.chalkboard;

  // Compute wizard width on first open
  const getWizardWidth = useCallback(() => {
    if (wizardWidth !== null) return wizardWidth;
    return Math.max(WIZARD_MIN_WIDTH, Math.round(window.innerWidth * WIZARD_DEFAULT_WIDTH_RATIO));
  }, [wizardWidth]);

  // Global keyboard shortcuts for undo/redo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
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

  // Listen for "open wizard" events from ModelCard
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<WizardContext>).detail;
      const family = variableTypeToFamily(detail.outcomeFamily as VariableType);
      setWizardContext({
        modelId: detail.modelId,
        outcomeName: detail.outcomeName,
        treatmentName: detail.treatmentName,
        outcomeFamily: family,
      });
      setPanelMode('wizard');
    };

    window.addEventListener('estiplan:open-prior-wizard', handler);
    return () => window.removeEventListener('estiplan:open-prior-wizard', handler);
  }, []);

  const handleToggleMenu = useCallback(() => {
    setPanelMode((prev) => {
      if (prev === 'closed') return 'menu';
      // Any open state → close
      setWizardContext(null);
      return 'closed';
    });
  }, []);

  const handleOpenWizard = useCallback(() => {
    setPanelMode('wizard');
  }, []);

  const handleClosePanel = useCallback(() => {
    setPanelMode('closed');
    setWizardContext(null);
  }, []);

  const handleBackToMenu = useCallback(() => {
    setPanelMode('menu');
    setWizardContext(null);
  }, []);

  const handlePriorsReady = useCallback((priors: PriorResult) => {
    if (!wizardContext?.modelId) {
      return;
    }

    const store = useEstiplanStore.getState();
    const model = store.models.find((m) => m.id === wizardContext.modelId);
    if (!model) {
      console.warn('Model was deleted; cannot apply priors');
      setPanelMode('closed');
      setWizardContext(null);
      return;
    }

    const variables = store.variables;
    const modelId = wizardContext.modelId;

    // Update intercept
    const interceptIdx = model.priors.findIndex((p) => p.class === 'Intercept');
    if (interceptIdx >= 0) {
      store.updateModelPrior(modelId, interceptIdx, `normal(${fmt(priors.interceptMean)}, ${fmt(priors.interceptSD)})`, variables);
    }

    // Update slope(s). If the user chose the standardized scale, the slope prior
    // represents "effect per 1 SD" and applies equally to any standardized predictor,
    // so propagate it to ALL b-class priors (treatment, adjustments, factor levels).
    // For centered/natural scales, the prior is in units specific to the treatment,
    // so only update the treatment's slope (first b-class prior).
    const slopePriorString = `normal(${fmt(priors.slopeMean)}, ${fmt(priors.slopeSD)})`;
    const propagateToAll = priors.scale === 'standardized';

    if (propagateToAll) {
      // Update every b-class prior. We must re-read the model each iteration because
      // updateModelPrior regenerates the model (and its prior list).
      let bIdx = 0;
      while (true) {
        const current = useEstiplanStore.getState().models.find((m) => m.id === modelId);
        if (!current) break;
        const nextIdx = current.priors.findIndex((p, i) => p.class === 'b' && i >= bIdx);
        if (nextIdx < 0) break;
        store.updateModelPrior(modelId, nextIdx, slopePriorString, variables);
        bIdx = nextIdx + 1;
      }
    } else {
      const afterIntercept = useEstiplanStore.getState().models.find((m) => m.id === modelId);
      if (afterIntercept) {
        const slopeIdx = afterIntercept.priors.findIndex((p) => p.class === 'b');
        if (slopeIdx >= 0) {
          store.updateModelPrior(modelId, slopeIdx, slopePriorString, variables);
        }
      }
    }

    // Update dispersion if present
    if (priors.dispersionRate != null) {
      const afterSlope = useEstiplanStore.getState().models.find((m) => m.id === modelId);
      if (afterSlope) {
        const dispIdx = afterSlope.priors.findIndex(
          (p) => p.class === 'sigma' || p.class === 'phi',
        );
        if (dispIdx >= 0) {
          store.updateModelPrior(modelId, dispIdx, `exponential(${fmt(priors.dispersionRate)})`, variables);
        }
      }
    }

    // Flash confirmation + auto-close after brief delay
    if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    setPriorsAppliedFlash(true);
    flashTimeoutRef.current = setTimeout(() => {
      setPriorsAppliedFlash(false);
      setPanelMode('closed');
      setWizardContext(null);
      flashTimeoutRef.current = null;
    }, 1200);
  }, [wizardContext]);

  // Resize handle logic
  const resizeRef = useRef<{ startX: number; startW: number } | null>(null);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const currentWidth = panelMode === 'wizard' ? getWizardWidth() : MENU_WIDTH;
      resizeRef.current = { startX: e.clientX, startW: currentWidth };

      const onMouseMove = (ev: MouseEvent) => {
        if (!resizeRef.current) return;
        const delta = ev.clientX - resizeRef.current.startX;
        const newWidth = Math.max(WIZARD_MIN_WIDTH, resizeRef.current.startW + delta);
        setWizardWidth(newWidth);
        // If they're resizing from the menu, upgrade to wizard mode
        if (panelMode === 'menu' && newWidth > MENU_WIDTH + 50) {
          setPanelMode('wizard');
        }
      };

      const onMouseUp = () => {
        resizeRef.current = null;
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [panelMode, getWizardWidth],
  );

  const panelWidth = panelMode === 'wizard' ? getWizardWidth() : panelMode === 'menu' ? MENU_WIDTH : 0;

  return (
    <div className={`${appStyles.app} ${themeClass}`}>
      <ReactFlowProvider>
        <Toolbar onToggleMenu={handleToggleMenu} menuOpen={panelMode !== 'closed'} />
        <div className={appStyles.mainArea}>
          {panelMode !== 'closed' && (
            <div className={appStyles.sidePanel} style={{ width: panelWidth }}>
              {panelMode === 'menu' && (
                <MenuContent onOpenWizard={handleOpenWizard} onClose={handleClosePanel} />
              )}
              {panelMode === 'wizard' && (
                <PriorWizardPanel
                  outcomeName={wizardContext?.outcomeName}
                  treatmentName={wizardContext?.treatmentName}
                  outcomeFamily={wizardContext?.outcomeFamily}
                  onBack={handleBackToMenu}
                  onClose={handleClosePanel}
                  onPriorsReady={wizardContext ? handlePriorsReady : undefined}
                  priorsAppliedFlash={priorsAppliedFlash}
                />
              )}
              <div
                className={appStyles.resizeHandle}
                onMouseDown={handleResizeStart}
              />
            </div>
          )}
          <div className={appStyles.canvasArea}>
            <EstiplanCanvas />
          </div>
        </div>
      </ReactFlowProvider>
    </div>
  );
}

/** Side menu: about blurb + wizard launcher */
function MenuContent({ onOpenWizard, onClose }: { onOpenWizard: () => void; onClose: () => void }) {
  return (
    <div className={appStyles.menuContent}>
      <p className={appStyles.aboutBlurb}>
        <em>Estimand</em> comes from Latin — you can think of it as the{' '}
        <strong>esti</strong>mate you de<strong>mand</strong> from your data.
      </p>
      <p className={appStyles.aboutBlurb}>
        Estiplan is a tool that helps you define a scientific model, choose an
        estimand, and plan a statistical approach for answering your questions.
      </p>
      <p className={appStyles.aboutMeta}>
        Inspired by Richard McElreath's{' '}
        <a
          href="https://github.com/rmcelreath/stat_rethinking_2026"
          target="_blank"
          rel="noopener noreferrer"
          className={appStyles.aboutLink}
        >
          Statistical Rethinking
        </a>{' '}
        (2026).
      </p>

      <button className={appStyles.wizardLauncher} onClick={onOpenWizard}>
        <div>
          <div className={appStyles.wizardLauncherText}>
            Adjust Priors with the Prior Wizard
          </div>
          <div className={appStyles.wizardLauncherSub}>
            Optional — explore what your priors mean
          </div>
        </div>
      </button>
    </div>
  );
}

/** Format number for prior strings */
function fmt(n: number, decimals: number = 2): string {
  return Number(n.toFixed(decimals)).toString();
}

export default App;
