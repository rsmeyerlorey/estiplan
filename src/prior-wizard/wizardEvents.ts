/**
 * Custom event for opening the Prior Wizard from a ModelCard.
 * Uses DOM CustomEvent to bridge React Flow nodes → App.tsx.
 */

export interface WizardContext {
  modelId: string;
  outcomeName: string;
  treatmentName: string;
  outcomeFamily?: string;
}

export function emitOpenWizard(ctx: WizardContext) {
  window.dispatchEvent(
    new CustomEvent('estiplan:open-prior-wizard', { detail: ctx }),
  );
}
