import { NavLink, useLocation } from 'react-router-dom';
import { MODULE_BY_ID, NAV, PHASES, SECTIONS } from './moduleRegistry';
import { usePhase } from './PhaseContext';
import { useRole } from './RoleContext';
import { Icon } from './icons';

export function Sidebar({ collapsed }: { collapsed: boolean }) {
  const { activePhase } = usePhase();
  const { levelFor } = useRole();
  const location = useLocation();
  const phaseLabel = PHASES.find((p) => p.id === activePhase)?.label ?? activePhase;
  const currentEntry = navIdForPath(location.pathname);

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`} aria-label="Modules">
      <div className="sidebar-brand">
        <div className="brand-mark">T</div>
        {!collapsed && (
          <div className="brand-text">
            <strong>TURNPOINT</strong>
            <span>Turnaround Digitalization</span>
          </div>
        )}
      </div>
      <nav className="sidebar-nav">
        {SECTIONS.map((section) => {
          const entries = NAV.filter((n) => n.section === section.id);
          if (!entries.length) return null;
          return (
            <div className="sidebar-group" key={section.id}>
              {!collapsed && <div className="nav-section-label">{section.title}</div>}
              {entries.map((entry) => {
                const first = MODULE_BY_ID[entry.members[0]];
                const mods = entry.members.map((m) => MODULE_BY_ID[m]).filter(Boolean);
                const allLocked = mods.every((m) => levelFor(m.group) === 'none');
                const relevant = mods.some((m) => m.phases.includes(activePhase) && m.phases.length < PHASES.length);
                const isActive = currentEntry === entry.id;
                // land on the first module this role may open
                const target = mods.find((m) => levelFor(m.group) !== 'none') ?? first;
                return (
                  <NavLink
                    key={entry.id}
                    to={target.path}
                    className={`nav-item ${isActive ? 'active' : ''} ${allLocked ? 'locked' : ''}`}
                    title={collapsed ? entry.label : allLocked ? 'Restricted for your role' : relevant ? `Used in ${phaseLabel}` : undefined}
                  >
                    <Icon name={entry.icon} />
                    {!collapsed && <span className="nav-label">{entry.label}</span>}
                    {!collapsed && allLocked && <Icon name="lock" size={13} />}
                    {!collapsed && !allLocked && relevant && <span className="phase-dot" />}
                  </NavLink>
                );
              })}
            </div>
          );
        })}
      </nav>
      {!collapsed && (
        <div className="sidebar-foot">
          Stage focus: <strong>{phaseLabel}</strong>
          <span>Dot marks entries used in this stage.</span>
        </div>
      )}
    </aside>
  );
}

/** Which sidebar entry owns this pathname (undefined for pages with no entry, e.g. Alerts). */
function navIdForPath(pathname: string): string | undefined {
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  for (const n of NAV) {
    for (const id of n.members) if (MODULE_BY_ID[id]?.path === p) return n.id;
  }
  return undefined;
}
