// Shared domain types for the TURNPOINT POC. Mock data + services are typed against these.

// Checklist lifecycle stages: Initiation -> Scoping -> Planning & Procurement -> Pre-TA -> Execution -> Close-Out
export type Phase = 'initiation' | 'scoping' | 'planning' | 'preTa' | 'execution' | 'closeout';

export type Discipline =
  | 'Inspection'
  | 'Rotating Equipment'
  | 'Process'
  | 'Instrumentation'
  | 'Civil'
  | 'Electrical';

export interface Job {
  id: string;
  desc: string;
  discipline: Discipline;
  requestedBy: string;
  costOMR: number;
  gate: 1 | 2 | 3;
  status: 'pending' | 'approved' | 'rejected';
  phase: Phase;
  approvals: GateApproval[];
  createdAt: string;
  // ---- scope / worklist fields (checklist S1-S9, P6) ----
  area: string;
  tag: string; // principal equipment tag
  manhours: number;
  likelihood: 1 | 2 | 3 | 4 | 5;
  consequence: 1 | 2 | 3 | 4 | 5;
  source: 'Manual' | 'Bulk upload' | 'Excel import' | 'SAP notification' | 'SAP work order';
  taClass: 'TA' | 'Non-TA';
  sapRef?: string;
  startDay: number; // planned start, TA day (1 = 3 Aug)
  durationDays: number;
  inBaseline: boolean; // part of the scope frozen at the freeze date
  contractor: string;
}

export interface GateApproval {
  gate: 1 | 2 | 3;
  approver: string;
  role: string;
  status: 'pending' | 'approved' | 'rejected';
  actedAt?: string;
  comment?: string;
}

export type FlangeStage = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const FLANGE_STAGE_LABELS: Record<FlangeStage, string> = {
  0: 'Not Started',
  1: 'Opened',
  2: 'Cleaned & Inspected',
  3: 'Assembled',
  4: 'Torqued',
  5: 'Leak Tested',
  6: 'Closed',
};

export interface Flange {
  id: string;
  tagNo: string;
  area: string;
  line: string;
  size: string;
  rating: string;
  contractor: string;
  stage: FlangeStage;
  updatedAt: string;
  qrCode: string;
}

export type EquipmentStatus = 'removed' | 'in-repair' | 'ready' | 'installed';

export interface Equipment {
  id: string;
  tagNo: string;
  description: string;
  area: string;
  status: EquipmentStatus;
  custodian: string;
  updatedAt: string;
  history: { status: EquipmentStatus; at: string; by: string }[];
}

export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface RiskItem {
  id: string;
  description: string;
  category: string;
  severity: RiskSeverity;
  likelihood: 'rare' | 'possible' | 'likely' | 'certain';
  owner: string;
  mitigation: string;
  status: 'open' | 'mitigating' | 'closed';
  raisedAt: string;
}

export type SCFStatus = 'evaluating' | 'approved' | 'rejected' | 'closed';
export type SCFApprover = 'TA Event Manager' | 'Head of Turnaround Services';

export interface SCF {
  id: string;
  kind?: 'SCF' | 'Additional work request';
  title: string;
  requestedBy: string;
  department: 'Maintenance' | 'Inspection' | 'Process' | 'Engineering';
  costUSD: number;
  durationDays: number;
  exceedsWindow: boolean;
  approver: SCFApprover;
  status: SCFStatus;
  justification: string;
  raisedAt: string;
}

export type DiscoveryJobState =
  | 'identified'
  | 'evaluating'
  | 'approved'
  | 'rejected'
  | 'merged';

export interface DiscoveryJob {
  id: string;
  desc: string;
  discipline: Discipline;
  foundBy: string;
  area: string;
  state: DiscoveryJobState;
  estCostOMR: number;
  raisedAt: string;
  notes: string;
}

export type ChangeState =
  | 'draft'
  | 'under-review'
  | 'approved'
  | 'rejected'
  | 'frozen';

export interface ChangeRequest {
  id: string;
  title: string;
  description: string;
  requestedBy: string;
  discipline: Discipline;
  state: ChangeState;
  impact: 'low' | 'medium' | 'high';
  auditTrail: { state: ChangeState; at: string; by: string; note?: string }[];
}

export type CPStatus = 'on-track' | 'at-risk' | 'delayed';

export interface CriticalPathActivity {
  id: string;
  name: string;
  path: 'CP1' | 'CP2' | 'CP3';
  status: CPStatus;
  changeCount: number;
  plannedFinish: string;
  forecastFinish: string;
  owner: string;
  // ---- network fields (checklist X3, X17, X21) ----
  predecessors: string[];
  durationDays: number;
  floatDays: number;
  resource: string; // crew / contractor
  costOMR: number;
  logic: 'FS' | 'SS' | 'FF';
}

export interface KPI {
  label: string;
  value: string;
  delta?: string;
  trend?: 'up' | 'down' | 'flat';
  tone?: 'good' | 'warn' | 'crit' | 'neutral' | 'accent';
}

export interface SCurvePoint {
  day: number;
  planned: number;
  actual: number;
}

export type AlertType =
  | 'scf-approval'
  | 'boxup-certificate'
  | 'pssr-approval'
  | 'permit-overdue'
  | 'integration';

export interface AlertItem {
  id: string;
  type: AlertType;
  message: string;
  severity: 'info' | 'warn' | 'crit';
  raisedAt: string;
  read: boolean;
  link?: string;
}

export type BudgetStatus = 'on-budget' | 'watch' | 'over';

export interface BudgetLine {
  id: string;
  subWbs: string;
  kind: 'variable' | 'fixed'; // variable estimated costs vs fixed logistics costs (checklist G10)
  discipline: Discipline | 'Logistics';
  plannedOMR: number;
  committedOMR: number;
  actualOMR: number;
  forecastOMR: number;
}

export type LeadTime = 'long' | 'medium' | 'short';

export interface MaterialItem {
  id: string;
  description: string;
  leadTime: LeadTime;
  leadWeeks: number; // delivery time after PO award, in weeks (>26 long, 17-26 medium, <17 short ~ 6 / 4-6 / <4 months)
  prStatus: 'not-raised' | 'raised' | 'po-issued' | 'delivered';
  requiredBy: string;
  area: string;
  jobId: string;
  qty: number;
  uom: string;
  estCostOMR: number;
}

export interface Role {
  id: string;
  name: string;
  kind: 'oq-staff' | 'contractor';
}

export type Tone = 'good' | 'warn' | 'crit' | 'neutral' | 'accent';
