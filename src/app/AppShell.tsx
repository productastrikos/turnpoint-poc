import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { TopBar, type Theme } from './TopBar';
import { PhaseSpine } from './PhaseSpine';
import { Sidebar } from './Sidebar';
import { usePhase } from './PhaseContext';
import { useRole } from './RoleContext';
import { AccessCtx } from './AccessContext';
import { GROUP_LABEL } from './access';
import { MODULE_BY_ID, moduleForPath, navEntryForModule } from './moduleRegistry';
import { ChatPanel } from './ChatLauncher';
import { ErrorBoundary } from './ErrorBoundary';
import { Card } from '../components/ui/Card';
import { useToast } from './ToastContext';
import { Icon } from './icons';
import { startTurnpointLink } from '../integration/turnpointLink';
import { useLang } from '../i18n/lang';

// Shorter labels for the tab strip (the sidebar and search keep the full module names).
const TAB_LABEL: Record<string, string> = {
  dashboard: 'Dashboard',
  'executive-summary': 'Executive Summary',
  kpis: 'KPIs & S-Curve',
  readiness: 'STO Readiness',
  portfolio: 'Multi-TA Portfolio',
  'daily-report': 'Daily Newsletter',
  integrations: 'SAP · P6 Integration',
  platform: 'Platform & Performance',
  'access-control': 'Access Control',
  coverage: 'Checklist Coverage',
  organization: 'Organization',
  milestones: 'Milestones & Tracker',
  'risk-register': 'Risk Register',
  strategy: 'Strategy',
  materials: 'MTO & Lead Times',
  bom: 'BOM',
  'material-tracking': 'Procurement Tracking',
  'pid-analyzer': 'P&ID Analyzer',
  'work-packs': 'Work Packs',
  qaqc: 'QA/QC & ITP',
  'flange-tracking': 'Flanges',
  lookahead: 'Lookahead',
  mobilization: 'Mobilization',
  disciplines: 'Disciplines',
  'pre-ta-scaffold': 'Scaffold',
  'pre-ta-isolation': 'Isolation',
  'pre-ta-insulation': 'Insulation',
  'pre-ta-weld': 'Weld',
  'pre-ta-rigging': 'Rigging & Lift',
  'pre-ta-tools': 'Tools',
  'pre-ta-bagging': 'Bagging & Tagging',
  'pre-ta-heavy': 'Heavy Equipment',
  'pre-ta-prefab': 'Pre-fab',
  'pre-ta-waste': 'Waste',
  'pre-ta-inspection': 'Equip. Inspection',
  'critical-path': 'Critical Path',
  'what-if': 'What-if',
  productivity: 'Productivity',
  scf: 'SCF',
  'discovery-jobs': 'Discovery Jobs',
  'change-moc': 'Change / MOC',
  issues: 'Issues & Safety',
  ncr: 'NCR',
  rework: 'Re-work & Delay',
  'field-checklists': 'Field Checklists',
  'readiness-board': 'Readiness Board',
  'box-up': 'Box-Up',
  blinding: 'Blinding',
  pssr: 'PSSR',
  'mc-certificates': 'MC Certificates',
  'area-handover': 'Area Handover',
  'equipment-tracking': 'Equipment & Valves',
  attendance: 'Attendance',
  'shift-log': 'Shift Log',
  'contractor-kpi': 'Contractor KPIs',
  closeout: 'Close-Out Report',
  'lessons-learned': 'Lessons Learned',
  'post-ta': 'Post-TA Work',
  'handover-archive': 'Handover & Archive',
};

function RestrictedPage({ moduleLabel, group }: { moduleLabel: string; group: keyof typeof GROUP_LABEL }) {
  const { persona, setPersona } = useRole();
  const { showToast } = useToast();
  const navigate = useNavigate();
  return (
    <div className="restricted-page">
      <Card>
        <div className="lock-big"><Icon name="lock" size={38} /></div>
        <div className="eyebrow">Restricted for role</div>
        <h2 style={{ fontSize: 24, margin: '6px 0 10px' }}>{moduleLabel}</h2>
        <p style={{ color: 'var(--ink-2)', fontSize: 13.5 }}>
          Signed in as <strong>{persona.label}</strong> ({persona.org}). This page is in the group <strong>{GROUP_LABEL[group]}</strong>, which your role cannot open.
          Role-based access control hides sensitive layouts and data from users who are not authorised for them.
        </p>
        <div className="row-wrap" style={{ justifyContent: 'center', marginTop: 16 }}>
          <button className="btn" onClick={() => showToast('Access request sent to the TA Event Manager (simulated)', 'accent')}>Request access</button>
          <button className="btn" onClick={() => navigate('/access-control')}>See the access matrix</button>
          <button className="btn btn-primary" onClick={() => setPersona('ta-manager')}>Switch to TA Event Manager</button>
        </div>
      </Card>
    </div>
  );
}

function HubTabs({ moduleId }: { moduleId: string }) {
  const { levelFor } = useRole();
  const { t } = useLang();
  const entry = navEntryForModule(moduleId);
  if (!entry || entry.members.length < 2) return null;
  return (
    <div className="hub-tabs" role="tablist" aria-label={entry.label}>
      <span className="hub-title">{t(entry.label)}</span>
      {entry.members.map((id) => {
        const m = MODULE_BY_ID[id];
        if (!m) return null;
        const locked = levelFor(m.group) === 'none';
        return (
          <NavLink key={id} to={m.path} end role="tab" className={({ isActive }) => `hub-tab ${isActive ? 'active' : ''} ${locked ? 'locked' : ''}`} title={locked ? 'Restricted for your role' : m.label}>
            {t(TAB_LABEL[id] ?? m.label)}
          </NavLink>
        );
      })}
    </div>
  );
}

function readTheme(): Theme {
  try {
    return localStorage.getItem('turnpoint-theme') === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { setActivePhase } = usePhase();
  const { levelFor, persona } = useRole();
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [collapsed, setCollapsed] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const { showToast } = useToast();

  // SAP / P6 stand-in consoles talk to this window over the local integration bus
  useEffect(() => startTurnpointLink(showToast), [showToast]);

  const mod = moduleForPath(location.pathname);
  const level = mod ? levelFor(mod.group) : 'full';

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('turnpoint-theme', theme);
    } catch {
      /* storage unavailable: theme just is not remembered */
    }
  }, [theme]);

  const toggleTheme = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);

  useEffect(() => {
    if (!mod) return;
    // keep the current stage if the page belongs to it, otherwise move to the page's first stage
    setActivePhase((prev) => (mod.phases.includes(prev) ? prev : mod.phases[0]));
  }, [mod, setActivePhase]);

  return (
    <div className={`app-shell ${chatOpen ? 'chat-open' : ''}`}>
      <a href="#main" className="skip-link">Skip to content</a>
      <Sidebar collapsed={collapsed} />
      <div className="app-main">
        <TopBar
          theme={theme}
          onToggleTheme={toggleTheme}
          onToggleSidebar={() => setCollapsed((c) => !c)}
          chatOpen={chatOpen}
          onToggleChat={() => setChatOpen((o) => !o)}
        />
        <PhaseSpine />
        <main className="content" id="main">
          {mod && <HubTabs moduleId={mod.id} />}
          {mod && level === 'none' ? (
            <RestrictedPage moduleLabel={mod.label} group={mod.group} />
          ) : (
            <AccessCtx.Provider value={level}>
              {mod && level === 'view' && (
                <div className="readonly-banner" role="status">
                  <Icon name="eye" size={16} /> View-only for {persona.label}: you can browse and filter this page, but actions that change data are disabled.
                </div>
              )}
              <ErrorBoundary key={location.pathname + location.search}>{children}</ErrorBoundary>
            </AccessCtx.Provider>
          )}
        </main>
      </div>
      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}
