import type { SCFApprover } from '../types';

export const SCF_COST_THRESHOLD_USD = 75_000;

// SOW §10.10: <75K USD AND within mechanical window -> TA Event Manager.
// >=75K USD OR exceeds mechanical window duration -> Head of Turnaround Services.
export function deriveApprover(costUSD: number, exceedsWindow: boolean): SCFApprover {
  return costUSD >= SCF_COST_THRESHOLD_USD || exceedsWindow ? 'Head of Turnaround Services' : 'TA Event Manager';
}
