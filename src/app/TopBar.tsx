import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRole } from './RoleContext';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { useActiveTa } from './TaContext';
import { PERSONAS } from './access';
import { GlobalSearch } from './GlobalSearch';
import { SyncPill } from '../modules/integrations/SyncPill';
import { sendToSystems } from '../services/integrationService';
import { GuidedDemoButton } from './GuidedDemo';
import { Icon } from './icons';
import { getAlerts } from '../services/alertsService';

export type Theme = 'dark' | 'light';

export function TopBar({
  theme,
  onToggleTheme,
  onToggleSidebar,
  chatOpen,
  onToggleChat,
}: {
  theme: Theme;
  onToggleTheme: () => void;
  onToggleSidebar: () => void;
  chatOpen: boolean;
  onToggleChat: () => void;
}) {
  const { persona, setPersona } = useRole();
  const { signOut } = useAuth();
  const { showToast } = useToast();
  const { tas, activeTaId, setActiveTaId } = useActiveTa();
  const [unread, setUnread] = useState(0);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getAlerts().then((a) => setUnread(a.filter((x) => !x.read).length));
  }, []);

  useEffect(() => {
    if (!menu) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false);
    };
    window.addEventListener('mousedown', onDoc);
    return () => window.removeEventListener('mousedown', onDoc);
  }, [menu]);

  function onPersonaChange(id: string) {
    setPersona(id);
    const p = PERSONAS.find((x) => x.id === id)!;
    showToast(
      p.kind === 'contractor'
        ? `Signed in as ${p.label}: cost figures, strategy and approvals are now restricted`
        : `Signed in as ${p.label} (${p.org}). Menu and page rights updated.`,
      'accent'
    );
  }

  function onTaChange(id: string) {
    setActiveTaId(id);
    const t = tas.find((x) => x.id === id);
    if (t) showToast(`Active turnaround: ${t.name}. Dashboard headline numbers rescaled.`, 'accent');
  }

  const initials = persona.person
    .split(/[\s.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join('')
    .toUpperCase();

  return (
    <header className="topbar">
      <button className="icon-btn" onClick={onToggleSidebar} aria-label="Toggle sidebar" title="Toggle sidebar">
        <Icon name="menu" />
      </button>
      <GlobalSearch />
      <div className="topbar-spacer" />
      <div className="topbar-right">
        <label className="tb-label" htmlFor="ta-select">Active TA</label>
        <select id="ta-select" value={activeTaId} onChange={(e) => onTaChange(e.target.value)} aria-label="Active turnaround">
          {tas.length === 0 && <option value={activeTaId}>Loading…</option>}
          {tas.map((t) => (
            <option key={t.id} value={t.id}>
              {t.id} · {t.status === 'active' ? 'ACTIVE' : t.status === 'completed' ? 'completed' : 'planned'}
            </option>
          ))}
        </select>
        <SyncPill />
        <GuidedDemoButton />
        <label className="tb-label" htmlFor="persona-select">View as</label>
        <select id="persona-select" value={persona.id} onChange={(e) => onPersonaChange(e.target.value)} aria-label="View as role">
          {PERSONAS.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
        <button className="icon-btn" onClick={onToggleTheme} aria-label="Toggle theme" title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
        </button>
        <button className={`advisory-btn ${chatOpen ? 'is-on' : ''}`} onClick={onToggleChat} aria-label="Ask TURNPOINT" aria-pressed={chatOpen}>
          <Icon name="spark" size={16} />
          <span>Ask TURNPOINT</span>
        </button>
        <Link to="/alerts" className="icon-btn" aria-label="Alerts and notifications" title="Alerts & notifications">
          <Icon name="bell" />
          {unread > 0 && <span className="bell-count">{unread}</span>}
        </Link>
        <div className="profile" ref={menuRef}>
          <button className="profile-trigger" onClick={() => setMenu((m) => !m)} aria-haspopup="menu" aria-expanded={menu} title={persona.person}>
            {initials || 'U'}
          </button>
          {menu && (
            <div className="profile-menu" role="menu">
              <div className="profile-menu-header">
                <div className="avatar">{initials || 'U'}</div>
                <div>
                  <div className="name">{persona.person}</div>
                  <div className="role">{persona.label} · {persona.org}</div>
                </div>
              </div>
              <button className="profile-menu-item" role="menuitem" onClick={() => { setMenu(false); onToggleTheme(); }}>
                <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} /> {theme === 'dark' ? 'Light mode' : 'Dark mode'}
              </button>
              <button
                className="profile-menu-item"
                role="menuitem"
                title="Reloads the app with fresh seed data so every meeting starts clean"
                onClick={() => {
                  sendToSystems({ type: 'reset' }); // the SAP / P6 stand-in consoles start clean too
                  window.location.assign('/');
                }}
              >
                <Icon name="refresh" size={16} /> Reset demo data
              </button>
              <button className="profile-menu-item" role="menuitem" onClick={signOut}>
                <Icon name="lock" size={16} /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
