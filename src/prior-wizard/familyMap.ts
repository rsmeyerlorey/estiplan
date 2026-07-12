/**
 * Maps Estiplan's VariableType to Prior Wizard's OutcomeFamily.
 */
import type { VariableType } from '../types/dag';
import type { OutcomeFamily } from './lib/types';

export function variableTypeToFamily(type: VariableType): OutcomeFamily | undefined {
  switch (type) {
    case 'continuous':
    case 'time-series':
    case 'time-cycle':
      return 'gaussian';
    case 'positive-continuous':
      return 'lognormal';
    case 'proportion':
      return 'beta';
    case 'binary':
      return 'bernoulli';
    case 'count':
      return 'poisson';
    case 'ordinal':
      return 'cumulative';
    case 'categorical':
      return 'categorical';
    case 'unobserved':
    case 'selection':
      return undefined; // Can't set priors for unobserved/selection nodes
    default:
      return 'gaussian';
  }
}
