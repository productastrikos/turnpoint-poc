// Platform-level types: portfolio, KPIs, readiness, organisation, integrations.
import type { Tone } from './index';

export type TaStatus = 'completed' | 'active' | 'planned';
export type TaType = 'Major STO' | 'Minor TA' | 'Inspection Shutdown' | 'Catalyst Change';

export interface TaEvent {
  id: string;
  name: string;
  year: number;
  type: TaType;
  units: string[];
  startDate: string;
  durationDays: number;
  budgetOMR: number;
  manhours: number;
  status: TaStatus;
  complexity: 'High' | 'Medium';
  prepMonths: number; // preparation lead time (SOW 13: 36 / 24 months)
  readinessPct: number; // overall readiness today
  note: string;
}

export interface RagItem {
  label: string;
  value: string;
  sub: string;
  tone: Tone;
  link?: string;
}
