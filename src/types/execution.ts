// Planning / pre-TA / execution / close-out types used by the checklist update.
import type { Discipline } from './index';

export interface ScheduleActivity {
  id: string; // internal activity id (ACT-xxx or CPA-xxx for critical path activities)
  p6Id: string; // Primavera P6 Activity ID, e.g. HCU-1020
  name: string;
  discipline: Discipline;
  area: string;
  jobId: string;
  contractor: string;
  startDay: number; // TA day, 1-based (Day 1 = 3 Aug 2026)
  endDay: number;
  pct: number; // physical % complete at the data date (Day 14)
  bluHours: number; // budgeted labour units (hours)
  calendar: '12h Day' | '12h Night' | '7-day' | '5-day';
  cp?: 'CP1' | 'CP2' | 'CP3';
  sapWo?: string;
}

export interface SapItem {
  number: string; // notification or work-order number
  kind: 'Notification' | 'Work Order';
  description: string;
  funcLoc: string;
  equipment: string;
  priority: 1 | 2 | 3 | 4;
  plannerGroup: string;
  estCostOMR: number;
  manhours: number;
  discipline: Discipline;
  area: string;
  reportedBy: string;
  createdOn: string;
  imported?: boolean;
}

export type MsgStatus = 'Delivered' | 'Retrying' | 'Failed' | 'Auto-resolved';

export interface IntegrationMessage {
  id: string;
  at: string; // ISO datetime on the scenario clock
  system: 'P6' | 'SAP';
  direction: 'Inbound' | 'Outbound';
  object: string;
  key: string;
  status: MsgStatus;
  latencyMs: number;
  channel: string;
  request: string; // JSON text
  response: string; // JSON text
  note?: string; // what the platform did about it
}
