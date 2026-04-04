/**
 * PriorWizardPanel — wraps the Prior Wizard for use inside Estiplan's side panel.
 * Applies the theme bridge CSS and passes pre-fill props from estimand context.
 */
import { PriorWizard, type PriorResult } from './PriorWizard';
import './theme-bridge.css';
import './prior-wizard.css';
import styles from './PriorWizardPanel.module.css';

interface Props {
  /** Pre-fill from Estiplan estimand context */
  outcomeName?: string;
  treatmentName?: string;
  outcomeFamily?: Parameters<typeof PriorWizard>[0]['outcomeFamily'];
  /** Called when user selects priors (undefined = no model to apply to) */
  onPriorsReady?: (priors: PriorResult) => void;
  /** Go back to the menu view */
  onBack: () => void;
  /** Close the entire side panel */
  onClose: () => void;
  /** Brief flash when priors were applied */
  priorsAppliedFlash?: boolean;
}

export function PriorWizardPanel({
  outcomeName,
  treatmentName,
  outcomeFamily,
  onPriorsReady,
  onBack,
  onClose,
  priorsAppliedFlash,
}: Props) {
  return (
    <div className="prior-wizard-panel">
      {/* Panel header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <button className={styles.backButton} onClick={onBack} title="Back to menu">
            &#x2190;
          </button>
          <span className={styles.headerTitle}>Prior Wizard</span>
        </div>
        <button className={styles.closeButton} onClick={onClose} title="Close panel">
          &#x2715;
        </button>
      </div>

      {/* Flash overlay when priors applied */}
      {priorsAppliedFlash && (
        <div className={styles.flashOverlay}>
          <div className={styles.flashMessage}>
            &#x2713; Priors applied to model
          </div>
        </div>
      )}

      {/* Wizard content */}
      <div className={styles.content}>
        <PriorWizard
          embedded
          outcomeName={outcomeName}
          treatmentName={treatmentName}
          outcomeFamily={outcomeFamily}
          onPriorsReady={onPriorsReady}
        />
      </div>
    </div>
  );
}
