// Single source of truth for navigation, routing, phase relevance, RBAC grouping and global search.
// The router (routes.tsx), the sidebar, /coverage and the access matrix are all generated from MODULES, so they cannot drift.
import type { Phase } from '../types';
import type { AccessGroup } from './access';

export type SectionId = 'general' | 'initiation' | 'scoping' | 'planning' | 'preta' | 'execution' | 'closeout';

export const SECTIONS: { id: SectionId; title: string; phase?: Phase }[] = [
  { id: 'general', title: 'Platform & General' },
  { id: 'initiation', title: 'TA Event Initiation', phase: 'initiation' },
  { id: 'scoping', title: 'Scoping & Worklist Frozen', phase: 'scoping' },
  { id: 'planning', title: 'Planning, Procurement & Contracting', phase: 'planning' },
  { id: 'preta', title: 'Pre-TA', phase: 'preTa' },
  { id: 'execution', title: 'Execution', phase: 'execution' },
  { id: 'closeout', title: 'Close-Out & Continuous Improvement', phase: 'closeout' },
];

export const PHASES: { id: Phase; label: string }[] = [
  { id: 'initiation', label: 'Initiation' },
  { id: 'scoping', label: 'Scoping' },
  { id: 'planning', label: 'Planning & Procurement' },
  { id: 'preTa', label: 'Pre-TA' },
  { id: 'execution', label: 'Execution' },
  { id: 'closeout', label: 'Close-Out' },
];

export const ALL_PHASES: readonly Phase[] = PHASES.map((p) => p.id);

export interface ModuleDef {
  id: string;
  path: string;
  label: string;
  section: SectionId;
  phases: readonly Phase[];
  group: AccessGroup;
  keywords?: string;
}

const ALL = ALL_PHASES;

export const MODULES = [
  // ---------------- Platform & General ----------------
  { id: 'dashboard', path: '/', label: 'Command Dashboard', section: 'general', phases: ALL, group: 'field', keywords: 'home overview s-curve kpi' },
  { id: 'executive-summary', path: '/executive-summary', label: 'Executive Summary', section: 'general', phases: ['execution', 'closeout'], group: 'strategic', keywords: 'steering rag report' },
  { id: 'portfolio', path: '/portfolio', label: 'Multi-TA Portfolio', section: 'general', phases: ['initiation'], group: 'strategic', keywords: '10 year plan business plan budget duration' },
  { id: 'plan-check', path: '/plan-check', label: 'Plan vs History Check', section: 'general', phases: ALL, group: 'strategic', keywords: 'compare previous turnaround validate plan benchmark contingency freeze lead time duration mistakes' },
  { id: 'kpis', path: '/kpis', label: 'KPIs & S-Curve', section: 'general', phases: ['execution', 'closeout'], group: 'field', keywords: 'performance scorecard spi cpi trif s-curve' },
  { id: 'readiness', path: '/readiness', label: 'Overall STO Readiness', section: 'general', phases: ['planning', 'preTa', 'execution'], group: 'field', keywords: 'readiness score gaps' },
  { id: 'budget', path: '/budget', label: 'Budget Control', section: 'general', phases: ['planning', 'preTa', 'execution', 'closeout'], group: 'commercial', keywords: 'cost wbs forecast variance' },
  { id: 'ai-panel', path: '/ai-panel', label: 'AI Assistant & Analytics', section: 'general', phases: ['execution', 'preTa'], group: 'field', keywords: 'chatbot risk prediction forecast predictive' },
  { id: 'mobile-capture', path: '/mobile-capture', label: 'Mobile Field App (Offline)', section: 'general', phases: ['preTa', 'execution'], group: 'field', keywords: 'offline sim sync photo gps barcode' },
  { id: 'integrations', path: '/integrations', label: 'Integration Hub (SAP · P6)', section: 'general', phases: ALL, group: 'admin', keywords: 'sap s/4hana primavera p6 xer odata sync' },
  { id: 'platform', path: '/platform', label: 'Platform & Performance', section: 'general', phases: ['initiation'], group: 'admin', keywords: 'roadmap implementation plan load test users response' },
  { id: 'access-control', path: '/access-control', label: 'Access Control (RBAC)', section: 'general', phases: ['initiation'], group: 'admin', keywords: 'roles permissions security users' },
  { id: 'alerts', path: '/alerts', label: 'Alerts & Notifications', section: 'general', phases: ['execution', 'closeout'], group: 'field', keywords: 'notifications permits' },
  { id: 'coverage', path: '/coverage', label: 'Checklist Coverage', section: 'general', phases: ALL, group: 'strategic', keywords: 'checklist demo 97 items' },

  // ---------------- TA Event Initiation ----------------
  { id: 'organization', path: '/organization', label: 'TA Organization', section: 'initiation', phases: ['initiation', 'execution'], group: 'strategic', keywords: 'ta office organogram contractor twin raci' },
  { id: 'risk-register', path: '/risk-register', label: 'Risk Register', section: 'initiation', phases: ['initiation', 'scoping', 'planning', 'execution'], group: 'governance', keywords: 'steering committee mitigation' },
  { id: 'milestones', path: '/milestones', label: 'Milestones & Event Tracker', section: 'initiation', phases: ['initiation', 'execution'], group: 'field', keywords: 'ta milestones events issues tracker' },
  { id: 'strategy', path: '/strategy', label: 'TA Strategy Document', section: 'initiation', phases: ['initiation'], group: 'strategic', keywords: 'strategy document' },

  // ---------------- Scoping & Worklist Frozen ----------------
  { id: 'scope', path: '/scope', label: 'Scope & Worklist', section: 'scoping', phases: ['scoping', 'planning', 'execution'], group: 'governance', keywords: 'three gate approval freeze certificate duplicate variation challenge priority mandatory' },

  // ---------------- Planning, Procurement & Contracting ----------------
  { id: 'materials', path: '/materials', label: 'Materials / MTO', section: 'planning', phases: ['planning'], group: 'commercial', keywords: 'long lead medium short mto' },
  { id: 'bom', path: '/bom', label: 'BOM & Approval Flow', section: 'planning', phases: ['planning'], group: 'commercial', keywords: 'bill of materials procurement alerts' },
  { id: 'material-tracking', path: '/material-tracking', label: 'Material & Procurement Tracking', section: 'planning', phases: ['planning', 'preTa'], group: 'commercial', keywords: 'expediting po pr vendor delivery' },
  { id: 'work-packs', path: '/work-packs', label: 'Work Packs', section: 'planning', phases: ['planning', 'preTa'], group: 'field', keywords: 'work pack readiness' },
  { id: 'qaqc', path: '/qaqc', label: 'QA/QC & ITP', section: 'planning', phases: ['planning', 'execution'], group: 'field', keywords: 'inspection test plan acceptance hold witness' },
  { id: 'flange-tracking', path: '/flange-tracking', label: 'Flange Management', section: 'planning', phases: ['planning', 'execution'], group: 'field', keywords: 'qr torque' },
  { id: 'pid-analyzer', path: '/pid-analyzer', label: 'P&ID / Isometric Analyzer', section: 'planning', phases: ['planning'], group: 'field', keywords: 'pid isometric mto extraction drawing' },

  // ---------------- Pre-TA ----------------
  { id: 'lookahead', path: '/lookahead', label: 'Lookahead Plan', section: 'preta', phases: ['preTa', 'execution'], group: 'field', keywords: '2 week 4 week look ahead' },
  { id: 'mobilization', path: '/mobilization', label: 'Contractor Mobilization', section: 'preta', phases: ['planning', 'preTa', 'execution'], group: 'field', keywords: 'resources equipment manpower' },
  { id: 'pre-ta-scaffold', path: '/pre-ta/scaffold', label: 'Scaffold Management', section: 'preta', phases: ['preTa', 'execution'], group: 'field', keywords: 'scaffold' },
  { id: 'pre-ta-isolation', path: '/pre-ta/isolation', label: 'Isolation Management', section: 'preta', phases: ['preTa', 'execution'], group: 'field', keywords: 'isolation loto blind' },
  { id: 'pre-ta-insulation', path: '/pre-ta/insulation', label: 'Insulation Management', section: 'preta', phases: ['preTa', 'execution'], group: 'field', keywords: 'insulation' },
  { id: 'pre-ta-weld', path: '/pre-ta/weld', label: 'Weld Management', section: 'preta', phases: ['preTa', 'execution'], group: 'field', keywords: 'weld ndt joints' },
  { id: 'pre-ta-rigging', path: '/pre-ta/rigging', label: 'Rigging & Lift Management', section: 'preta', phases: ['preTa', 'execution'], group: 'field', keywords: 'lift crane rigging' },
  { id: 'pre-ta-tools', path: '/pre-ta/tools', label: 'Tools Management', section: 'preta', phases: ['preTa', 'execution'], group: 'field', keywords: 'tools' },
  { id: 'pre-ta-bagging', path: '/pre-ta/bagging-tagging', label: 'Bagging & Tagging', section: 'preta', phases: ['preTa'], group: 'field', keywords: 'bagging tagging' },
  { id: 'pre-ta-heavy', path: '/pre-ta/heavy-equipment', label: 'Heavy Equipment', section: 'preta', phases: ['preTa', 'execution'], group: 'field', keywords: 'crane forklift heavy equipment' },
  { id: 'pre-ta-prefab', path: '/pre-ta/prefab', label: 'Fabrication & Pre-fab', section: 'preta', phases: ['planning', 'preTa'], group: 'field', keywords: 'fabricated spool prefab' },
  { id: 'pre-ta-waste', path: '/pre-ta/waste', label: 'Waste Management', section: 'preta', phases: ['preTa', 'execution', 'closeout'], group: 'field', keywords: 'waste manifest disposal' },
  { id: 'pre-ta-inspection', path: '/pre-ta/equipment-inspection', label: 'Equipment & Tools Inspection', section: 'preta', phases: ['preTa', 'execution'], group: 'field', keywords: 'inspection tools certification' },
  { id: 'disciplines', path: '/disciplines', label: 'Discipline Dashboards', section: 'preta', phases: ['preTa', 'execution', 'closeout'], group: 'field', keywords: 'discipline pre-ta post-ta' },

  // ---------------- Execution ----------------
  { id: 'critical-path', path: '/critical-path', label: 'Critical Path Monitor', section: 'execution', phases: ['execution'], group: 'field', keywords: 'cp1 cp2 cp3 dependency network changes' },
  { id: 'what-if', path: '/what-if', label: 'What-if Schedule Analysis', section: 'execution', phases: ['execution'], group: 'field', keywords: 'scenario drop scope simulate' },
  { id: 'readiness-board', path: '/readiness-board', label: 'Walkdown / PSSR / Startup Readiness', section: 'execution', phases: ['execution', 'closeout'], group: 'field', keywords: 'walkdown pssr startup ready' },
  { id: 'issues', path: '/issues', label: 'Issues & Safety Log', section: 'execution', phases: ['execution'], group: 'field', keywords: 'issues safety incidents hse' },
  { id: 'discovery-jobs', path: '/discovery-jobs', label: 'Discovery Jobs', section: 'execution', phases: ['execution'], group: 'governance', keywords: 'discovery' },
  { id: 'scf', path: '/scf', label: 'SCF & Additional Work', section: 'execution', phases: ['execution'], group: 'governance', keywords: 'scope change request' },
  { id: 'change-moc', path: '/change-moc', label: 'Change / MOC', section: 'execution', phases: ['execution'], group: 'governance', keywords: 'management of change moc' },
  { id: 'field-checklists', path: '/field-checklists', label: 'Digital Field Checklists', section: 'execution', phases: ['execution'], group: 'field', keywords: 'checklist forms' },
  { id: 'productivity', path: '/productivity', label: 'Productivity Analysis', section: 'execution', phases: ['execution'], group: 'field', keywords: 'productivity index' },
  { id: 'box-up', path: '/box-up', label: 'Box-Up Management', section: 'execution', phases: ['execution'], group: 'field', keywords: 'box up closure' },
  { id: 'pssr', path: '/pssr', label: 'PSSR', section: 'execution', phases: ['execution', 'closeout'], group: 'field', keywords: 'pre startup safety review' },
  { id: 'mc-certificates', path: '/mc-certificates', label: 'Mechanical Completion Certificates', section: 'execution', phases: ['execution', 'closeout'], group: 'field', keywords: 'mc certificate' },
  { id: 'blinding', path: '/blinding', label: 'Blinding / De-blinding', section: 'execution', phases: ['preTa', 'execution'], group: 'field', keywords: 'blind spade' },
  { id: 'equipment-tracking', path: '/equipment-tracking', label: 'Equipment / Valve Tracking', section: 'execution', phases: ['execution'], group: 'field', keywords: 'valves bundles exchangers' },
  { id: 'ncr', path: '/ncr', label: 'Non-Conformance Reports', section: 'execution', phases: ['execution'], group: 'field', keywords: 'ncr nonconformance' },
  { id: 'rework', path: '/rework', label: 'Re-work & Delay Capture', section: 'execution', phases: ['execution'], group: 'field', keywords: 'delay rework pareto' },
  { id: 'area-handover', path: '/area-handover', label: 'Area / Unit Handover', section: 'execution', phases: ['execution', 'closeout'], group: 'field', keywords: 'completion certificate handover mmc' },
  { id: 'attendance', path: '/attendance', label: 'Attendance & Manpower', section: 'execution', phases: ['preTa', 'execution'], group: 'field', keywords: 'attendance shift manpower' },
  { id: 'shift-log', path: '/shift-log', label: 'Shift Handover Log', section: 'execution', phases: ['execution'], group: 'field', keywords: 'day night shift handover' },
  { id: 'contractor-kpi', path: '/contractor-kpi', label: 'Contractor KPIs', section: 'execution', phases: ['execution', 'closeout'], group: 'commercial', keywords: 'contractor scorecard' },
  { id: 'daily-report', path: '/daily-report', label: 'Daily Newsletter', section: 'execution', phases: ['execution', 'closeout'], group: 'field', keywords: 'newsletter daily report' },

  // ---------------- Close-Out & Continuous Improvement ----------------
  { id: 'closeout', path: '/closeout', label: 'Close-Out Report', section: 'closeout', phases: ['closeout'], group: 'commercial', keywords: 'close out report ai final cost schedule' },
  { id: 'lessons-learned', path: '/lessons-learned', label: 'Lessons Learned', section: 'closeout', phases: ['closeout', 'initiation'], group: 'field', keywords: 'lessons learned actions' },
  { id: 'post-ta', path: '/post-ta-completion', label: 'Post-TA Work Completion', section: 'closeout', phases: ['closeout'], group: 'field', keywords: 'punch list post ta' },
  { id: 'handover-archive', path: '/handover-archive', label: 'Handover & Archive', section: 'closeout', phases: ['closeout'], group: 'field', keywords: 'documents handover archive dossier' },
] as const satisfies readonly ModuleDef[];

export type ModuleId = (typeof MODULES)[number]['id'];

export const MODULE_LIST: readonly ModuleDef[] = MODULES;
export const MODULE_BY_ID: Record<string, ModuleDef> = Object.fromEntries(MODULE_LIST.map((m) => [m.id, m]));
export const MODULE_BY_PATH: Record<string, ModuleDef> = Object.fromEntries(MODULE_LIST.map((m) => [m.path, m]));

// ---------------- Sidebar navigation ----------------
// Every module keeps its own route (deep links, coverage page, search), but the sidebar shows ~20 entries:
// related modules are grouped into a hub and appear as a tab strip above the page.
export interface NavEntry {
  id: string;
  label: string;
  section: SectionId;
  icon: string;
  /** Module ids, first one is where the sidebar entry lands. One member = a plain link. */
  members: readonly string[];
}

export const NAV: readonly NavEntry[] = [
  { id: 'n-dashboard', label: 'Command Dashboard', section: 'general', icon: 'grid', members: ['dashboard'] },
  { id: 'n-reporting', label: 'Reporting & KPIs', section: 'general', icon: 'chart', members: ['executive-summary', 'kpis', 'readiness', 'portfolio', 'daily-report'] },
  { id: 'n-plancheck', label: 'Plan vs History Check', section: 'general', icon: 'check', members: ['plan-check'] },
  { id: 'n-budget', label: 'Budget Control', section: 'general', icon: 'coin', members: ['budget'] },
  { id: 'n-ai', label: 'AI Analytics', section: 'general', icon: 'spark', members: ['ai-panel'] },
  { id: 'n-mobile', label: 'Mobile Field App', section: 'general', icon: 'phone', members: ['mobile-capture'] },
  { id: 'n-integrations', label: 'Integrations & Admin', section: 'general', icon: 'link', members: ['integrations', 'platform', 'access-control', 'coverage'] },
  { id: 'n-setup', label: 'TA Setup & Governance', section: 'initiation', icon: 'org', members: ['organization', 'milestones', 'risk-register', 'strategy'] },
  { id: 'n-scope', label: 'Scope & Worklist', section: 'scoping', icon: 'list', members: ['scope'] },
  { id: 'n-procurement', label: 'Materials & Procurement', section: 'planning', icon: 'box', members: ['materials', 'bom', 'material-tracking', 'pid-analyzer'] },
  { id: 'n-workpacks', label: 'Work Packs & QA/QC', section: 'planning', icon: 'check', members: ['work-packs', 'qaqc', 'flange-tracking'] },
  { id: 'n-lookahead', label: 'Planning & Resources', section: 'preta', icon: 'calendar', members: ['lookahead', 'mobilization', 'disciplines'] },
  { id: 'n-preta', label: 'Pre-TA Trackers', section: 'preta', icon: 'wrench', members: ['pre-ta-scaffold', 'pre-ta-isolation', 'pre-ta-insulation', 'pre-ta-weld', 'pre-ta-rigging', 'pre-ta-tools', 'pre-ta-bagging', 'pre-ta-heavy', 'pre-ta-prefab', 'pre-ta-waste', 'pre-ta-inspection'] },
  { id: 'n-schedule', label: 'Critical Path & Schedule', section: 'execution', icon: 'route', members: ['critical-path', 'what-if', 'productivity'] },
  { id: 'n-change', label: 'Change Control', section: 'execution', icon: 'swap', members: ['scf', 'discovery-jobs', 'change-moc'] },
  { id: 'n-quality', label: 'Issues & Quality', section: 'execution', icon: 'alert', members: ['issues', 'ncr', 'rework', 'field-checklists'] },
  { id: 'n-completion', label: 'Completion & Startup', section: 'execution', icon: 'shield', members: ['readiness-board', 'box-up', 'blinding', 'pssr', 'mc-certificates', 'area-handover'] },
  { id: 'n-site', label: 'Site Operations', section: 'execution', icon: 'people', members: ['equipment-tracking', 'attendance', 'shift-log', 'contractor-kpi'] },
  { id: 'n-closeout', label: 'Close-Out & Lessons', section: 'closeout', icon: 'flag', members: ['closeout', 'lessons-learned', 'post-ta', 'handover-archive'] },
];

/** Alerts has no sidebar entry: it lives behind the bell in the header. */
export const NAV_HIDDEN: readonly string[] = ['alerts'];

export function navEntryForModule(moduleId: string): NavEntry | undefined {
  return NAV.find((n) => n.members.includes(moduleId));
}

// Where the phase spine lands when you click a stage — the hero page of that stage.
export const PHASE_LANDING: Record<Phase, string> = {
  initiation: '/milestones',
  scoping: '/scope',
  planning: '/work-packs',
  preTa: '/lookahead',
  execution: '/',
  closeout: '/closeout',
};

export function sectionForPhase(phase: Phase): SectionId {
  return SECTIONS.find((s) => s.phase === phase)?.id ?? 'general';
}

export function modulesInSection(section: SectionId): ModuleDef[] {
  return MODULE_LIST.filter((m) => m.section === section);
}

/** Resolve a pathname to its module (ignores query strings; exact match only). */
export function moduleForPath(pathname: string): ModuleDef | undefined {
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return MODULE_BY_PATH[p];
}
