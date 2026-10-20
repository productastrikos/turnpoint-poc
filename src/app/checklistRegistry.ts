// The client's "TA Digitalization DEMO Check List" (7 Oct 2026): all 97 numbered lines, each mapped to the screen that demonstrates it.
// Routes are resolved from moduleRegistry, so the coverage page and the router cannot drift apart.
import { MODULE_BY_ID, type ModuleId } from './moduleRegistry';
import { TABS } from './tabRegistry';

export type CoverageStatus = 'built' | 'simulated' | 'integration';

export interface ChecklistItem {
  id: string;
  section: string;
  no: number;
  title: string;
  status: CoverageStatus;
  module: ModuleId;
  tab?: string;
  note?: string;
}

export const CHECKLIST_SECTIONS = [
  'Document deliverables',
  'General items',
  'TA Event Initiation',
  'Scoping & Worklist Frozen',
  'Planning & Preparation and Procurement & Contracting',
  'Pre-TA',
  'Execution',
  'Close-Out & Continuous Improvement',
] as const;

type S = (typeof CHECKLIST_SECTIONS)[number];
const D: S = CHECKLIST_SECTIONS[0];
const G: S = CHECKLIST_SECTIONS[1];
const I: S = CHECKLIST_SECTIONS[2];
const SC: S = CHECKLIST_SECTIONS[3];
const P: S = CHECKLIST_SECTIONS[4];
const R: S = CHECKLIST_SECTIONS[5];
const X: S = CHECKLIST_SECTIONS[6];
const C: S = CHECKLIST_SECTIONS[7];

const it = (id: string, section: S, no: number, title: string, status: CoverageStatus, module: ModuleId, tab?: string, note?: string): ChecklistItem => ({ id, section, no, title, status, module, tab, note });

export const CHECKLIST: ChecklistItem[] = [
  // ---------- Document deliverables ----------
  it('D1', D, 1, 'Project Implementation Plan based on a high-level plan for the upcoming Turnarounds till 2028', 'built', 'platform', 'roadmap', 'Roadmap Gantt 2026-2028 with TA events and milestones'),
  it('D2', D, 2, 'Supports 1500+ concurrent users', 'simulated', 'platform', 'performance', 'Illustrative load-test report'),
  it('D3', D, 3, 'Demonstrates ≤1 second response time', 'simulated', 'platform', 'performance', 'Illustrative p50/p95/p99 latency'),
  it('D4', D, 4, 'Load testing evidence provided', 'simulated', 'platform', 'performance', 'Illustrative, not a measured test'),
  it('D5', D, 5, 'SAP S/4HANA bi-directional integration', 'integration', 'integrations', 'sap', 'Integration Hub: mapping, pull / push, monitoring; Live two-way sync tab runs against a stand-in SAP console'),
  it('D6', D, 6, 'Primavera P6 two-way synchronization', 'integration', 'integrations', 'p6', 'Integration Hub: XER import, ALU/RLU recalculation, export; Live two-way sync tab runs against a stand-in P6 console with real CPM'),

  // ---------- General items ----------
  it('G1', G, 1, 'Multi-TA portfolio management (10-year TA Business Plan, budget and estimated duration)', 'built', 'portfolio', undefined, 'Selecting a TA sets the Active TA in the top bar'),
  it('G2', G, 2, 'Covers entire turnaround lifecycle from initiation to close-out', 'built', 'dashboard', undefined, 'Phase spine: Initiation, Scoping, Planning & Procurement, Pre-TA, Execution, Close-Out'),
  it('G3', G, 3, 'TA Office Organization Setup', 'built', 'organization', 'office'),
  it('G4', G, 4, 'Role-Based Access Control Security', 'built', 'access-control', 'matrix', 'The "View as" switch in the top bar hides and locks modules'),
  it('G5', G, 5, 'Primavera P6 two-way sync for seamless data flow', 'integration', 'integrations', 'p6'),
  it('G6', G, 6, 'The mobile application should work 100% offline using the SIM card', 'simulated', 'mobile-capture', undefined, 'Offline toggle, SIM indicator, queued actions, sync'),
  it('G7', G, 7, 'Attendance System: plan vs actual manpower in both shifts, in the daily newsletter', 'built', 'attendance'),
  it('G8', G, 8, 'P&ID & Isometric Analyzer', 'simulated', 'pid-analyzer', undefined, 'Extraction animation on a mock drawing'),
  it('G9', G, 9, 'Performance Reporting Dashboard & KPIs', 'built', 'kpis', 'scorecard'),
  it('G10', G, 10, 'Budget: planned / committed / actual / forecast per Sub-WBS, base vs current estimate, variable vs fixed, approved extras included', 'built', 'budget', 'bridge'),
  it('G11', G, 11, 'Overall STO readiness, not limited to scoping, planning and scheduling', 'built', 'readiness'),
  it('G12', G, 12, 'AI risk prediction', 'built', 'ai-panel', 'risk', 'Trained slip model + 2,000-run schedule simulation on live data; training history is generated'),
  it('G13', G, 13, 'AI chatbot capability', 'built', 'ai-panel', 'assistant', 'Claude with tools over live data when a key is set, otherwise an on-device engine; available from every page'),
  it('G14', G, 14, 'User friendly', 'built', 'dashboard', undefined, 'Global search (press /), consistent filters, empty and loading states, 1280x720 layout'),

  // ---------- TA Event Initiation ----------
  it('I1', I, 1, 'TA Event Organization Planning & Preparation Setup', 'built', 'organization', 'office'),
  it('I2', I, 2, 'Turnaround Risk Register with mitigation tracking, progress dashboards and close-out updates for the Steering Committee', 'built', 'risk-register', 'steerco'),
  it('I3', I, 3, 'TA Milestones', 'built', 'milestones', 'milestones'),
  it('I4', I, 4, 'Turnaround Event Tracker (key events, milestones, issues)', 'built', 'milestones', 'tracker'),
  it('I5', I, 5, 'Turnaround Strategy document', 'built', 'strategy'),
  it('I6', I, 6, 'Previous TA Lessons learned digitized with dashboards and actions closed out', 'built', 'lessons-learned', 'dashboard'),

  // ---------- Scoping & Worklist Frozen ----------
  it('S1', SC, 1, 'Comprehensive Risk Assessment: risk-based scope optimization', 'built', 'scope', 'risk'),
  it('S2', SC, 2, 'Enforce minimum mandatory input requirements in scope generation', 'built', 'scope', 'worklist', 'New scope item form with mandatory fields and completeness meter'),
  it('S3', SC, 3, 'Create scope items by manual entry, bulk upload, Excel import or SAP notifications / work orders; configurable multi-gate approvals', 'simulated', 'scope', 'worklist', 'SAP pull is simulated through the Integration Hub'),
  it('S4', SC, 4, 'Budgetary estimates at the scope level', 'built', 'scope', 'worklist'),
  it('S5', SC, 5, 'Three-stage gating: Area Ops Focal Point, Head of Area Operations, VP Asset Operations', 'built', 'scope', 'approvals'),
  it('S6', SC, 6, 'Scope challenge basis: risk with cost estimate and manhours', 'built', 'scope', 'challenge'),
  it('S7', SC, 7, 'Tracking scope variation and change from the originator, before and after scope freeze', 'built', 'scope', 'variations'),
  it('S8', SC, 8, 'Digitally Approved Turnaround Scope & Scope Freeze Certificate', 'built', 'scope', 'freeze'),
  it('S9', SC, 9, 'AI-based duplicate scope detection', 'built', 'scope', 'worklist', 'Trained pairwise model (hold-out AUC 0.98); also screens new items, Excel imports and SAP pulls'),

  // ---------- Planning, Procurement & Contracting ----------
  it('P1', P, 1, 'Consolidate and segregate MTOs: Long (>6 months), Medium (4-6 months), Short (<4 months) lead', 'built', 'materials'),
  it('P2', P, 2, 'Flange management digitization', 'built', 'flange-tracking'),
  it('P3', P, 3, 'BOM with customizable approval flow and procurement alerts by material lead time', 'built', 'bom'),
  it('P4', P, 4, 'Work pack management', 'built', 'work-packs'),
  it('P5', P, 5, 'Digitalize QA/QC/Acceptance workflows', 'built', 'qaqc', 'inspections'),
  it('P6', P, 6, 'Systemization & prioritization of all activities in the Turnaround Worklist', 'built', 'scope', 'priority'),
  it('P7', P, 7, 'Material tracking and expediting dashboard', 'built', 'material-tracking', 'tracking'),
  it('P8', P, 8, 'Procurement tracking and expediting', 'built', 'material-tracking', 'procurement'),
  it('P9', P, 9, 'Inspection Test Plan tracking after PO issuance', 'built', 'qaqc', 'itp'),

  // ---------- Pre-TA ----------
  it('R1', R, 1, 'Scaffold Management and Tracking', 'built', 'pre-ta-scaffold'),
  it('R2', R, 2, 'Isolation Management', 'built', 'pre-ta-isolation'),
  it('R3', R, 3, 'Dashboard: Lookahead plan', 'built', 'lookahead', 'grid'),
  it('R4', R, 4, 'Track contractor mobilization plan (resources and equipment) during Planning, Pre-TA and TA execution', 'built', 'mobilization'),
  it('R5', R, 5, 'Insulation Management', 'built', 'pre-ta-insulation'),
  it('R6', R, 6, 'Weld Management', 'built', 'pre-ta-weld'),
  it('R7', R, 7, 'Rigging & Lift Management', 'built', 'pre-ta-rigging'),
  it('R8', R, 8, 'Tools Management', 'built', 'pre-ta-tools'),
  it('R9', R, 9, 'Bagging & Tagging progress', 'built', 'pre-ta-bagging'),
  it('R10', R, 10, 'Heavy Equipment Management', 'built', 'pre-ta-heavy'),
  it('R11', R, 11, 'Fabricated Material Management & Pre-fabrication status', 'built', 'pre-ta-prefab'),
  it('R12', R, 12, 'Waste management', 'built', 'pre-ta-waste'),
  it('R13', R, 13, 'Inspection of the Equipment & Tools status', 'built', 'pre-ta-inspection'),
  it('R14', R, 14, 'Discipline-wise customized dashboards for Pre-TA, TA execution and post-TA', 'built', 'disciplines', 'pre-ta'),

  // ---------- Execution ----------
  it('X1', X, 1, 'TA Event Organization Execution setup: preparation and execution organogram with roles and responsibilities', 'built', 'organization', 'execution'),
  it('X2', X, 2, 'TA Event Execution Organization: Contractor Twin Organization setup', 'built', 'organization', 'contractor'),
  it('X3', X, 3, 'Visualize and review critical path (CP1, CP2, CP3) with insights on dependencies, logic, resource and cost; track daily changes', 'built', 'critical-path', 'network'),
  it('X4', X, 4, 'Logging and tracking issues, safety issues', 'built', 'issues', 'log'),
  it('X5', X, 5, 'Discovery job workflows from identification, approval and integration with the base TA scope', 'built', 'discovery-jobs'),
  it('X6', X, 6, 'Seamless data collection by field teams through digital checklists', 'built', 'field-checklists'),
  it('X7', X, 7, 'Productivity analysis', 'built', 'productivity'),
  it('X8', X, 8, 'Box-Up Management', 'built', 'box-up'),
  it('X9', X, 9, 'PSSR (Pre-Startup Safety Review)', 'built', 'pssr'),
  it('X10', X, 10, 'SCFs (Scope Change Requests) and additional work requests during TA execution', 'built', 'scf'),
  it('X11', X, 11, 'What-if analysis on the schedule: scenarios of completion, dropping scope', 'built', 'what-if'),
  it('X12', X, 12, 'Mechanical Completion certificate', 'built', 'mc-certificates'),
  it('X13', X, 13, 'Mobile app: update progress, provide approvals, capture data in low or no network', 'simulated', 'mobile-capture'),
  it('X14', X, 14, 'Progress of blinding and de-blinding', 'built', 'blinding'),
  it('X15', X, 15, 'S-Curve monitoring', 'built', 'kpis', 'scurve'),
  it('X16', X, 16, 'AI-enabled schedule forecasting', 'built', 'ai-panel', 'forecast', 'P50 / P90 finish from a Monte Carlo run over the critical-path network'),
  it('X17', X, 17, 'AI-Predictive critical path analysis', 'built', 'ai-panel', 'predictive', 'Criticality index per activity from the same simulation'),
  it('X18', X, 18, 'Live status dashboard: systems / units / areas ready for the Walkdown', 'built', 'readiness-board', 'walkdown'),
  it('X19', X, 19, 'Live status dashboard: systems / units / areas ready for PSSR sign-off', 'built', 'readiness-board', 'pssr'),
  it('X20', X, 20, 'Live status dashboard: systems / units / areas ready for operational startup', 'built', 'readiness-board', 'startup'),
  it('X21', X, 21, 'Real-time monitoring and dynamic update of the critical path, with automatic identification of newly critical activities', 'simulated', 'critical-path', 'monitor', 'Timer-driven simulation'),
  it('X22', X, 22, 'Dashboard: Executive summary report', 'built', 'executive-summary'),
  it('X23', X, 23, 'Dashboard: Issues', 'built', 'issues', 'dashboard'),
  it('X24', X, 24, 'Dashboard: Budget (budget comparison screens)', 'built', 'budget', 'comparison'),
  it('X25', X, 25, 'Dashboard: Re-work reports', 'built', 'rework', 'dashboard'),
  it('X26', X, 26, 'Nonconformance reports', 'built', 'ncr'),
  it('X27', X, 27, 'Area / Unit completion certificate handing over from the Main Mechanical contractor', 'built', 'area-handover', 'handover'),
  it('X28', X, 28, 'Delivering Automated (AI) Close-out Report', 'simulated', 'closeout', 'ai'),
  it('X29', X, 29, 'Contractor KPI digitization', 'built', 'contractor-kpi'),
  it('X30', X, 30, 'Report towards the end of the TA on how many times the critical path has changed', 'built', 'critical-path', 'changes'),
  it('X31', X, 31, 'Day / Night Shift Log for handing over and taking over', 'built', 'shift-log'),
  it('X32', X, 32, 'Delay & Rework Capture', 'built', 'rework', 'capture'),
  it('X33', X, 33, 'Equipment (valves, bundles, etc.) tracking during turnaround execution', 'built', 'equipment-tracking'),

  // ---------- Close-Out & Continuous Improvement ----------
  it('C1', C, 1, 'Lesson learned report', 'built', 'lessons-learned', 'report'),
  it('C2', C, 2, 'Digitalize the Area completion of Post TA work', 'built', 'post-ta'),
  it('C3', C, 3, 'Digital Turnaround Close-Out Report', 'built', 'closeout', 'report'),
  it('C4', C, 4, 'Final Cost & Schedule Performance Report', 'built', 'closeout', 'performance'),
  it('C5', C, 5, 'AI-generated close-out report', 'simulated', 'closeout', 'ai'),
  it('C6', C, 6, 'End to End Documents handover and archiving', 'built', 'handover-archive'),
];

export function routeFor(item: ChecklistItem): string {
  const m = MODULE_BY_ID[item.module];
  return m ? `${m.path}${item.tab ? `?tab=${item.tab}` : ''}` : '';
}

export interface LinkProblem {
  id: string;
  problem: string;
}

/** Every item must resolve to a registered module, and any tab must exist in that module's tab list. */
export function validateChecklist(): LinkProblem[] {
  const problems: LinkProblem[] = [];
  const seen = new Set<string>();
  for (const item of CHECKLIST) {
    if (seen.has(item.id)) problems.push({ id: item.id, problem: 'duplicate id' });
    seen.add(item.id);
    if (!MODULE_BY_ID[item.module]) {
      problems.push({ id: item.id, problem: `module "${item.module}" is not registered` });
      continue;
    }
    if (item.tab) {
      const tabs = (TABS as Record<string, readonly string[]>)[item.module];
      if (!tabs || !tabs.includes(item.tab)) problems.push({ id: item.id, problem: `tab "${item.tab}" does not exist on ${item.module}` });
    }
  }
  return problems;
}

export function coverageCounts() {
  return {
    total: CHECKLIST.length,
    built: CHECKLIST.filter((c) => c.status === 'built').length,
    simulated: CHECKLIST.filter((c) => c.status === 'simulated').length,
    integration: CHECKLIST.filter((c) => c.status === 'integration').length,
  };
}
