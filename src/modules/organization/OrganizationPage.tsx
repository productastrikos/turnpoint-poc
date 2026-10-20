import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { Tabs, useTabParam } from '../../components/ui/Tabs';
import { StatTile } from '../../components/ui/StatTile';
import { Chip } from '../../components/ui/Chip';
import { DataTable } from '../../components/ui/DataTable';
import { Drawer } from '../../components/ui/Drawer';
import { LoadingState } from '../../components/ui/EmptyState';
import { OrgChart, type OrgNode } from '../../components/workflow/OrgChart';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { FilterChips } from '../../components/ui/FilterChips';
import { TABS } from '../../app/tabRegistry';
import { assignRole, listRoles } from '../../services/orgService';
import { PEOPLE_POOL, RACI_COLUMNS, contractorTree, twins, type OrgRole } from '../../mocks/orgMock';
import { CONTRACTOR_NAMES } from '../../mocks/master';
import { useCanEdit } from '../../app/AccessContext';
import { useToast } from '../../app/ToastContext';

function build(roles: OrgRole[], id: string): OrgNode {
  const r = roles.find((x) => x.id === id)!;
  return { role: r.role, name: r.person ?? 'VACANT', org: r.person ? 'OQ RPI' : 'Open position', tone: r.person ? 'oq' : 'neutral', children: roles.filter((x) => x.parent === id).map((c) => build(roles, c.id)) };
}

export default function OrganizationPage() {
  const { showToast } = useToast();
  const canEdit = useCanEdit();
  const [tab, setTab] = useTabParam(TABS.organization, 'office');
  const [roles, setRoles] = useState<OrgRole[] | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [con, setCon] = useState('all');

  const load = useCallback(() => listRoles().then(setRoles), []);
  useEffect(() => {
    load();
  }, [load]);

  const all = useMemo(() => roles ?? [], [roles]);
  const office = all.filter((r) => r.team === 'office');
  const execution = all.filter((r) => r.team === 'execution');
  const current = all.find((r) => r.id === sel) ?? null;

  async function assign(r: OrgRole, person: string) {
    await assignRole(r.id, person || null);
    await load();
    showToast(person ? `${person} assigned as ${r.role}` : `${r.role} is now vacant`, person ? 'good' : 'warn');
  }

  if (!roles) return <div><PageHeader title="TA Organization" subtitle="" checklist="G3 · I1 · X1 · X2" /><LoadingState /></div>;

  const vacant = all.filter((r) => !r.person).length;
  const cname = con === 'all' ? CONTRACTOR_NAMES[0] : con;
  const execRoot: OrgNode = {
    ...build(all, 'exec-lead'),
    children: execution.filter((r) => r.parent === 'exec-lead').map((c) => build(all, c.id)),
  };
  const gal = contractorTree.Galfar;
  const contractorChart: OrgNode = { role: gal.role, name: gal.person, org: 'Galfar (MMC)', tone: 'contractor', children: gal.children?.map((c) => ({ role: c.role, name: c.person, org: 'Galfar', tone: 'contractor' as const })) };

  return (
    <div>
      <PageHeader
        title="TA Organization"
        subtitle="Set up the TA Office, the preparation and execution organogram with each individual's roles and responsibilities, and the contractor twin organisation that mirrors it."
        checklist="G3 · I1 · X1 · X2"
      />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'office', label: 'TA Office setup' }, { id: 'execution', label: 'Execution organogram' }, { id: 'contractor', label: 'Contractor twin organisation' }]} />

      {tab === 'office' && (
        <div className="stack" style={{ gap: 16 }}>
          <div className="grid grid-4">
            <StatTile label="TA Office roles" value={String(office.length)} />
            <StatTile label="Filled" value={String(office.filter((r) => r.person).length)} tone="good" />
            <StatTile label="Vacant" value={String(office.filter((r) => !r.person).length)} tone={vacant ? 'warn' : 'good'} />
            <StatTile label="Setup complete" value={`${Math.round((office.filter((r) => r.person).length / office.length) * 100)}%`} tone="accent" />
          </div>
          <Card>
            <CardHeader title="TA Office organogram" />
            <OrgChart root={build(all, 'ta-mgr')} />
          </Card>
          <div className="grid grid-3-2" style={{ alignItems: 'start' }}>
            <Card>
              <CardHeader title="Roles and assignments" />
              <DataTable
                dense
                rowKey={(r: OrgRole) => r.id}
                rows={office}
                columns={[
                  { key: 'role', header: 'Role', render: (r) => <div><strong>{r.role}</strong><div className="small muted">{r.responsibilities[0]}</div></div> },
                  { key: 'person', header: 'Assigned to', nosort: true, render: (r) => (
                    <select value={r.person ?? ''} disabled={!canEdit} onChange={(e) => assign(r, e.target.value)} aria-label={`Assign ${r.role}`}>
                      <option value="">Vacant</option>
                      {Array.from(new Set([...(r.person ? [r.person] : []), ...PEOPLE_POOL])).map((p) => <option key={p}>{p}</option>)}
                    </select>
                  ) },
                  { key: 's', header: 'Status', render: (r) => <Chip tone={r.person ? 'good' : 'warn'}>{r.person ? 'filled' : 'vacant'}</Chip> },
                ]}
              />
            </Card>
            <Card>
              <CardHeader title="RACI: key TA Office responsibilities" />
              <div className="dt-scroll"><table className="table dt-dense">
                <thead><tr><th>Lead</th>{RACI_COLUMNS.map((c) => <th key={c} style={{ textAlign: 'center', fontSize: 9.5 }}>{c}</th>)}</tr></thead>
                <tbody>
                  {office.filter((r) => r.raci).map((r) => (
                    <tr key={r.id}><td style={{ fontSize: 12 }}>{r.role.replace(' Lead', '')}</td>{RACI_COLUMNS.map((c) => <td key={c} style={{ textAlign: 'center' }}>{r.raci![c] ? <Chip tone={r.raci![c] === 'R' ? 'accent' : r.raci![c] === 'A' ? 'crit' : 'neutral'}>{r.raci![c]}</Chip> : ''}</td>)}</tr>
                  ))}
                </tbody>
              </table></div>
              <p className="small muted" style={{ margin: '8px 0 0' }}>R responsible · A accountable · C consulted · I informed</p>
            </Card>
          </div>
        </div>
      )}

      {tab === 'execution' && (
        <div className="stack" style={{ gap: 16 }}>
          <Card>
            <CardHeader title="Preparation & execution organogram" action={<span className="small muted">Click a role to see its responsibilities</span>} />
            <div className="org-clickable"><OrgChartClickable root={execRoot} roles={all} onSelect={setSel} /></div>
          </Card>
          <Card>
            <CardHeader title="Roles and responsibilities by individual" />
            <DataTable
              dense
              rowKey={(r: OrgRole) => r.id}
              rows={execution}
              onRowClick={(r) => setSel(r.id)}
              columns={[
                { key: 'person', header: 'Individual', render: (r) => <strong>{r.person ?? 'Vacant'}</strong> },
                { key: 'role', header: 'Role' },
                { key: 'resp', header: 'Responsibilities', nosort: true, render: (r) => <span className="small">{r.responsibilities.join(' · ')}</span> },
              ]}
            />
          </Card>
        </div>
      )}

      {tab === 'contractor' && (
        <div className="stack" style={{ gap: 16 }}>
          <div className="toolbar"><FilterChips options={CONTRACTOR_NAMES.slice(1).map((c) => ({ value: c }))} value={con} onChange={setCon} allLabel={CONTRACTOR_NAMES[0]} /></div>
          <div className="grid grid-3-2" style={{ alignItems: 'start' }}>
            <Card>
              <CardHeader title={`Twin organisation: OQ RPI ↔ ${cname}`} />
              <DataTable
                dense
                rowKey={(t) => t.oqRole}
                rows={twins}
                columns={[
                  { key: 'oq', header: 'OQ RPI', render: (t) => <div><strong>{t.oqRole}</strong><div className="small muted">{t.oqPerson}</div></div> },
                  { key: 'arrow', header: '', nosort: true, render: () => <span className="muted">↔</span> },
                  { key: 'c', header: cname, render: (t) => { const m = t.contractorRole[cname]; return <div><strong>{m.role}</strong><div className="small muted">{m.person}</div></div>; } },
                ]}
              />
              <p className="small muted" style={{ margin: '10px 0 0' }}>Each OQ role has a named counterpart at the contractor, so every approval, escalation and daily report has an obvious twin. Contractor staff see only the data their role needs (see Access Control).</p>
            </Card>
            <Card>
              <CardHeader title="Galfar (MMC) organogram" />
              <OrgChart root={contractorChart} />
              <div className="row" style={{ marginTop: 10 }}><ProgressBar value={820} max={820} showLabel={false} /><span className="small mono">820 peak</span></div>
            </Card>
          </div>
        </div>
      )}

      <Drawer open={Boolean(current)} onClose={() => setSel(null)} title={current?.role ?? ''} subtitle={current?.person ?? 'Vacant'}>
        {current && (
          <div className="stack">
            <div className="eyebrow">Responsibilities</div>
            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8, fontSize: 13 }}>
              {current.responsibilities.map((r) => <li key={r}>{r}</li>)}
            </ul>
            <div className="eyebrow">Reports to</div>
            <div>{all.find((x) => x.id === current.parent)?.role ?? '—'} {all.find((x) => x.id === current.parent)?.person ? `· ${all.find((x) => x.id === current.parent)?.person}` : ''}</div>
            <div className="eyebrow">Direct reports</div>
            <div>{all.filter((x) => x.parent === current.id).map((x) => x.role).join(', ') || 'none'}</div>
          </div>
        )}
      </Drawer>
    </div>
  );
}

/** The org chart with clickable nodes: reuses OrgChart's markup but overlays a click handler by role name. */
function OrgChartClickable({ root, roles, onSelect }: { root: OrgNode; roles: OrgRole[]; onSelect: (id: string) => void }) {
  return (
    <div
      onClick={(e) => {
        const card = (e.target as HTMLElement).closest('.org-card');
        if (!card) return;
        const role = card.querySelector('.org-role')?.textContent;
        const r = roles.find((x) => x.role === role);
        if (r) onSelect(r.id);
      }}
      style={{ cursor: 'pointer' }}
    >
      <OrgChart root={root} />
    </div>
  );
}
