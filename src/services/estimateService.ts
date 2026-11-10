// "AI budget estimate" for scope items: wraps the on-device model in src/ai/budgetModel.ts and the (illustrative)
// job history. Nothing leaves the browser.
import { estimateBudget, type Estimate, type EstimateInput } from '../ai/budgetModel';
import { PAST_JOBS } from '../mocks/scopeMock';
import { delay } from './_util';

export type { Estimate, EstimateInput } from '../ai/budgetModel';

/** Synchronous estimate (used when many items are estimated in one go). */
export const estimateNow = (input: EstimateInput): Estimate => estimateBudget(input, PAST_JOBS);

/** Estimate with a short "thinking" delay so the button reads as work being done. */
export function estimateScopeBudget(input: EstimateInput): Promise<Estimate> {
  return delay(estimateNow(input), 650);
}
