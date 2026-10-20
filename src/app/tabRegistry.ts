// Tab ids per page. Pages build their tab bar from these arrays and /coverage validates deep links against them,
// so a checklist link can never point at a tab that does not exist.
export const TABS = {
  platform: ['roadmap', 'performance'],
  'ai-panel': ['risk', 'assistant', 'forecast', 'predictive'],
  scope: ['worklist', 'approvals', 'risk', 'challenge', 'variations', 'freeze', 'priority'],
  'critical-path': ['activities', 'network', 'monitor', 'changes'],
  'risk-register': ['register', 'steerco'],
  milestones: ['milestones', 'tracker'],
  organization: ['office', 'execution', 'contractor'],
  budget: ['control', 'comparison', 'bridge'],
  'material-tracking': ['tracking', 'procurement'],
  qaqc: ['inspections', 'itp', 'remarks'],
  kpis: ['scorecard', 'scurve', 'progress'],
  lookahead: ['grid', 'activities'],
  'area-handover': ['handover', 'milestones'],
  'readiness-board': ['walkdown', 'pssr', 'startup'],
  integrations: ['overview', 'live', 'p6', 'sap', 'monitoring', 'dryrun'],
  rework: ['dashboard', 'capture'],
  issues: ['dashboard', 'log'],
  closeout: ['report', 'performance', 'compare', 'ai'],
  'lessons-learned': ['dashboard', 'actions', 'report'],
  disciplines: ['pre-ta', 'execution', 'post-ta'],
  'access-control': ['matrix', 'users'],
} as const;

export type TabbedModule = keyof typeof TABS;
