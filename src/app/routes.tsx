import { lazy, Suspense, type ReactElement } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { MODULE_LIST, type ModuleId } from './moduleRegistry';
import { LoadingState } from '../components/ui/EmptyState';
import { ComingSoonPage } from '../modules/_shared/ComingSoonPage';

const L = lazy;

// One entry per module in moduleRegistry. Pages are code-split so the first paint stays fast.
const Dashboard = L(() => import('../modules/dashboard/DashboardPage'));
const CriticalPath = L(() => import('../modules/critical-path/CriticalPathPage'));
const ChangeMoc = L(() => import('../modules/change-moc/ChangeMocPage'));
const RiskRegister = L(() => import('../modules/risk-register/RiskRegisterPage'));
const DiscoveryJobs = L(() => import('../modules/discovery-jobs/DiscoveryJobsPage'));
const Scf = L(() => import('../modules/scf/ScfPage'));
const Alerts = L(() => import('../modules/alerts/AlertsPage'));
const Disciplines = L(() => import('../modules/disciplines/DisciplinesPage'));
const Scope = L(() => import('../modules/scope/ScopePage'));
const Flange = L(() => import('../modules/flange-tracking/FlangeTrackingPage'));
const Equipment = L(() => import('../modules/equipment-tracking/EquipmentTrackingPage'));
const Budget = L(() => import('../modules/budget/BudgetPage'));
const Materials = L(() => import('../modules/materials/MaterialsPage'));
const DailyReport = L(() => import('../modules/daily-report/DailyReportPage'));
const Mobile = L(() => import('../modules/mobile-capture/MobileCapturePage'));
const AiPanel = L(() => import('../modules/ai-panel/AiPanelPage'));
const Integrations = L(() => import('../modules/integrations/IntegrationHubPage'));
const Coverage = L(() => import('../modules/coverage/CoveragePage'));
const Portfolio = L(() => import('../modules/portfolio/PortfolioPage'));
const PlanCheck = L(() => import('../modules/plan-check/PlanCheckPage'));
const ExecSummary = L(() => import('../modules/executive-summary/ExecutiveSummaryPage'));
const Platform = L(() => import('../modules/platform/PlatformPage'));
const Readiness = L(() => import('../modules/readiness/ReadinessPage'));
const ReadinessBoard = L(() => import('../modules/readiness/ReadinessBoardPage'));
const Issues = L(() => import('../modules/issues/IssuesPage'));
const Ncr = L(() => import('../modules/ncr/NcrPage'));
const Rework = L(() => import('../modules/rework/ReworkPage'));
const WhatIf = L(() => import('../modules/what-if/WhatIfPage'));
const WorkPacks = L(() => import('../modules/work-packs/WorkPacksPage'));
const Bom = L(() => import('../modules/bom/BomPage'));
const MaterialTracking = L(() => import('../modules/material-tracking/MaterialTrackingPage'));
const Qaqc = L(() => import('../modules/qaqc/QaqcPage'));
const PidAnalyzer = L(() => import('../modules/pid-analyzer/PidAnalyzerPage'));
const Lookahead = L(() => import('../modules/lookahead/LookaheadPage'));
const Mobilization = L(() => import('../modules/mobilization/MobilizationPage'));
const Attendance = L(() => import('../modules/attendance/AttendancePage'));
const PreTa = L(() => import('../modules/pre-ta/PreTaTrackerPage'));
const FieldChecklists = L(() => import('../modules/field-checklists/FieldChecklistsPage'));
const Productivity = L(() => import('../modules/productivity/ProductivityPage'));
const BoxUp = L(() => import('../modules/box-up/BoxUpPage'));
const Pssr = L(() => import('../modules/pssr/PssrPage'));
const McCerts = L(() => import('../modules/mc-certificates/McCertificatesPage'));
const Blinding = L(() => import('../modules/blinding/BlindingPage'));
const AreaHandover = L(() => import('../modules/area-handover/AreaHandoverPage'));
const ShiftLog = L(() => import('../modules/shift-log/ShiftLogPage'));
const ContractorKpi = L(() => import('../modules/contractor-kpi/ContractorKpiPage'));
const Kpis = L(() => import('../modules/kpis/KpisPage'));
const Organization = L(() => import('../modules/organization/OrganizationPage'));
const AccessControl = L(() => import('../modules/access-control/AccessControlPage'));
const Milestones = L(() => import('../modules/milestones/MilestonesPage'));
const Strategy = L(() => import('../modules/strategy/StrategyPage'));
const Closeout = L(() => import('../modules/closeout/CloseoutPage'));
const Lessons = L(() => import('../modules/lessons-learned/LessonsLearnedPage'));
const PostTa = L(() => import('../modules/post-ta/PostTaPage'));
const HandoverArchive = L(() => import('../modules/handover-archive/HandoverArchivePage'));

export const PAGES: Record<ModuleId, ReactElement> = {
  dashboard: <Dashboard />,
  'critical-path': <CriticalPath />,
  'change-moc': <ChangeMoc />,
  'risk-register': <RiskRegister />,
  'discovery-jobs': <DiscoveryJobs />,
  scf: <Scf />,
  alerts: <Alerts />,
  disciplines: <Disciplines />,
  scope: <Scope />,
  'flange-tracking': <Flange />,
  'equipment-tracking': <Equipment />,
  budget: <Budget />,
  materials: <Materials />,
  'daily-report': <DailyReport />,
  'mobile-capture': <Mobile />,
  'ai-panel': <AiPanel />,
  integrations: <Integrations />,
  coverage: <Coverage />,
  portfolio: <Portfolio />,
  'plan-check': <PlanCheck />,
  'executive-summary': <ExecSummary />,
  platform: <Platform />,
  readiness: <Readiness />,
  'readiness-board': <ReadinessBoard />,
  issues: <Issues />,
  ncr: <Ncr />,
  rework: <Rework />,
  'what-if': <WhatIf />,
  'work-packs': <WorkPacks />,
  bom: <Bom />,
  'material-tracking': <MaterialTracking />,
  qaqc: <Qaqc />,
  'pid-analyzer': <PidAnalyzer />,
  lookahead: <Lookahead />,
  mobilization: <Mobilization />,
  attendance: <Attendance />,
  'pre-ta-scaffold': <PreTa slug="scaffold" />,
  'pre-ta-isolation': <PreTa slug="isolation" />,
  'pre-ta-insulation': <PreTa slug="insulation" />,
  'pre-ta-weld': <PreTa slug="weld" />,
  'pre-ta-rigging': <PreTa slug="rigging" />,
  'pre-ta-tools': <PreTa slug="tools" />,
  'pre-ta-bagging': <PreTa slug="bagging-tagging" />,
  'pre-ta-heavy': <PreTa slug="heavy-equipment" />,
  'pre-ta-prefab': <PreTa slug="prefab" />,
  'pre-ta-waste': <PreTa slug="waste" />,
  'pre-ta-inspection': <PreTa slug="equipment-inspection" />,
  'field-checklists': <FieldChecklists />,
  productivity: <Productivity />,
  'box-up': <BoxUp />,
  pssr: <Pssr />,
  'mc-certificates': <McCerts />,
  blinding: <Blinding />,
  'area-handover': <AreaHandover />,
  'shift-log': <ShiftLog />,
  'contractor-kpi': <ContractorKpi />,
  kpis: <Kpis />,
  organization: <Organization />,
  'access-control': <AccessControl />,
  milestones: <Milestones />,
  strategy: <Strategy />,
  closeout: <Closeout />,
  'lessons-learned': <Lessons />,
  'post-ta': <PostTa />,
  'handover-archive': <HandoverArchive />,
};

export function AppRoutes() {
  return (
    <Suspense fallback={<LoadingState label="Loading page…" />}>
      <Routes>
        {MODULE_LIST.map((m) => (
          <Route
            key={m.id}
            path={m.path}
            element={PAGES[m.id as ModuleId]}
          />
        ))}
        <Route path="/scope-approvals" element={<Navigate to="/scope?tab=approvals" replace />} />
        <Route path="*" element={<ComingSoonPage title="Page not found" note="This route does not exist in the POC. Use the menu or the search box." />} />
      </Routes>
    </Suspense>
  );
}
