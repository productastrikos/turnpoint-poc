import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { Tabs, useTabParam } from '../../components/ui/Tabs';
import { Chip } from '../../components/ui/Chip';
import { DataTable } from '../../components/ui/DataTable';
import { FilterChips } from '../../components/ui/FilterChips';
import { ActionButton } from '../../components/ui/ActionButton';
import { LoadingState } from '../../components/ui/EmptyState';
import { TABS } from '../../app/tabRegistry';
import { GROUP_LABEL, PERSONAS, type AccessGroup, type AccessLevel } from '../../app/access';
import { MODULE_LIST } from '../../app/moduleRegistry';
import { useRole } from '../../app/RoleContext';
import { useToast } from '../../app/ToastContext';
import { listUsers, setActive, setPersonaFor, type UserRow } from '../../services/userService';

const TONE: Record<AccessLevel, 'good' | 'warn' | 'crit'> = { full: 'good', view: 'warn', none: 'crit' };
const LABEL: Record<AccessLevel, string> = { full: 'Full', view: 'View only', none: 'No access' };
const GROUPS = Object.keys(GROUP_LABEL) as AccessGroup[];

export default function AccessControlPage() {
  const { persona, setPersona } = useRole();
  const { showToast } = useToast();
  const [tab, setTab] = useTabParam(TABS['access-control'], 'matrix');
  const [group, setGroup] = useState('all');
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const load = useCallback(() => listUsers().then(setUsers), []);
  useEffect(() => {
    load();
  }, [load]);

  const modules = MODULE_LIST.filter((m) => group === 'all' || m.group === group);

  async function toggle(u: UserRow) {
    await setActive(u.id, !u.active);
    await load();
    showToast(`${u.name} ${u.active ? 'deactivated: sessions revoked' : 'reactivated'}`, u.active ? 'warn' : 'good');
  }
  async function changeRole(u: UserRow, p: string) {
    await setPersonaFor(u.id, p);
    await load();
    showToast(`${u.name} is now ${PERSONAS.find((x) => x.id === p)?.label}`, 'good');
  }

  return (
    <div>
      <PageHeader
        title="Access Control (RBAC)"
        subtitle={`Role-based access: each role gets Full, View-only or No access to groups of modules. The "View as" switch in the top bar applies these rules live. You are viewing as ${persona.label}.`}
        checklist="G4"
      />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'matrix', label: 'Role × module matrix' }, { id: 'users', label: 'Users', badge: users?.length }]} />

      {tab === 'matrix' && (
        <div className="stack" style={{ gap: 16 }}>
          <Card>
            <CardHeader title="Roles and what they can reach" />
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr><th>Module group</th>{PERSONAS.map((p) => <th key={p.id} style={{ textAlign: 'center' }}>{p.label}<div className="small muted" style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>{p.org}</div></th>)}</tr>
                </thead>
                <tbody>
                  {GROUPS.map((g) => (
                    <tr key={g}>
                      <td><strong>{GROUP_LABEL[g]}</strong></td>
                      {PERSONAS.map((p) => <td key={p.id} style={{ textAlign: 'center' }}><Chip tone={TONE[p.access[g]]}>{LABEL[p.access[g]]}</Chip></td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid grid-3" style={{ marginTop: 14 }}>
              {PERSONAS.map((p) => (
                <div key={p.id} className="card-flat">
                  <div className="spread"><strong>{p.label}</strong>{p.id === persona.id && <Chip tone="accent">you</Chip>}</div>
                  <div className="small muted" style={{ margin: '4px 0 8px' }}>{p.blurb}</div>
                  <button className="btn btn-sm" disabled={p.id === persona.id} onClick={() => { setPersona(p.id); showToast(`Now viewing as ${p.label}`, 'accent'); }}>View as {p.label}</button>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Module-level access" action={<FilterChips options={GROUPS.map((g) => ({ value: g, label: g }))} value={group} onChange={setGroup} allLabel="All groups" />} />
            <DataTable
              dense
              pageSize={14}
              rowKey={(m) => m.id}
              rows={modules}
              columns={[
                { key: 'label', header: 'Module', render: (m) => <div><strong>{m.label}</strong><div className="small muted mono">{m.path}</div></div> },
                { key: 'group', header: 'Group', render: (m) => <Chip tone="neutral">{m.group}</Chip> },
                ...PERSONAS.map((p) => ({ key: p.id, header: p.label.split(' ')[0], nosort: true, align: 'center' as const, render: (m: (typeof MODULE_LIST)[number]) => <Chip tone={TONE[p.access[m.group]]}>{LABEL[p.access[m.group]].replace(' only', '').replace('No access', 'None')}</Chip> })),
              ]}
            />
          </Card>

          <div className="grid grid-3">
            <Card><div className="eyebrow">Field-level masking</div><p className="small" style={{ margin: '6px 0 0' }}>Cost figures, budgets and quotes are masked for contractor roles on every page (try Contractor Supervisor, then open Budget or Scope).</p></Card>
            <Card><div className="eyebrow">Approval rights</div><p className="small" style={{ margin: '6px 0 0' }}>Gate approvals, SCF decisions and inspection clearance are restricted to OQ roles and shown as locked for contractors.</p></Card>
            <Card><div className="eyebrow">Identity and audit</div><p className="small" style={{ margin: '6px 0 0' }}>Production design: Active Directory single sign-on, role from AD group, every approval and export written to an audit log.</p></Card>
          </div>
        </div>
      )}

      {tab === 'users' && (
        <Card>
          {!users ? <LoadingState /> : (
            <DataTable
              dense
              rowKey={(u: UserRow) => u.id}
              rows={users}
              columns={[
                { key: 'name', header: 'User', render: (u) => <div><strong>{u.name}</strong><div className="small muted">{u.email}</div></div> },
                { key: 'org', header: 'Organisation' },
                { key: 'persona', header: 'Role', nosort: true, render: (u) => <select value={u.persona} onChange={(e) => changeRole(u, e.target.value)} aria-label={`Role for ${u.name}`}>{PERSONAS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select> },
                { key: 'lastActive', header: 'Last active', render: (u) => <span className="small">{u.lastActive}</span> },
                { key: 'active', header: 'Status', render: (u) => <Chip tone={u.active ? 'good' : 'neutral'}>{u.active ? 'active' : 'deactivated'}</Chip>, sortValue: (u) => (u.active ? 1 : 0) },
                { key: 'a', header: '', nosort: true, render: (u) => <ActionButton variant={u.active ? 'danger' : 'primary'} onClick={() => toggle(u)}>{u.active ? 'Deactivate' : 'Reactivate'}</ActionButton> },
              ]}
            />
          )}
        </Card>
      )}
    </div>
  );
}
