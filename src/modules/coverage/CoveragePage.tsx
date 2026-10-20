import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { StatTile } from '../../components/ui/StatTile';
import { Chip } from '../../components/ui/Chip';
import { DataTable } from '../../components/ui/DataTable';
import { FilterChips } from '../../components/ui/FilterChips';
import { CHECKLIST, CHECKLIST_SECTIONS, coverageCounts, routeFor, validateChecklist, type ChecklistItem, type CoverageStatus } from '../../app/checklistRegistry';
import { MODULE_BY_ID } from '../../app/moduleRegistry';
import { PAGES } from '../../app/routes';

const LABEL: Record<CoverageStatus, string> = { built: 'Built', simulated: 'Simulated', integration: 'Integration point' };
const TONE: Record<CoverageStatus, 'good' | 'accent' | 'warn'> = { built: 'good', simulated: 'accent', integration: 'warn' };

export default function CoveragePage() {
  const counts = coverageCounts();
  const [section, setSection] = useState('all');
  const [status, setStatus] = useState('all');
  const [q, setQ] = useState('');
  const [check, setCheck] = useState<{ ok: number; problems: { id: string; problem: string }[] } | null>(null);

  const rows = useMemo(
    () =>
      CHECKLIST.filter((c) => (section === 'all' || c.section === section) && (status === 'all' || c.status === status) && (!q || `${c.id} ${c.title} ${c.note ?? ''}`.toLowerCase().includes(q.toLowerCase()))),
    [section, status, q]
  );

  function runCheck() {
    const problems = validateChecklist();
    CHECKLIST.forEach((c) => {
      if (!PAGES[c.module]) problems.push({ id: c.id, problem: `page for module "${c.module}" is not implemented yet` });
    });
    setCheck({ ok: CHECKLIST.length - new Set(problems.map((p) => p.id)).size, problems });
  }

  return (
    <div>
      <PageHeader
        title="Checklist Coverage"
        subtitle="All 97 lines of the client's TA Digitalization demo checklist, each linked to the screen that demonstrates it. Generated from the same registry that drives the menu and the router, so it cannot drift."
        action={<button className="btn btn-primary" onClick={runCheck}>Run link check</button>}
      />

      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <StatTile label="Checklist items" value={String(counts.total)} />
        <StatTile label="Built (working on mock data)" value={String(counts.built)} tone="good" />
        <StatTile label="Simulated (AI / offline / load test)" value={String(counts.simulated)} tone="accent" />
        <StatTile label="Integration point (SAP / P6)" value={String(counts.integration)} tone="warn" />
      </div>

      {check && (
        <div className={`callout ${check.problems.length === 0 ? 'callout-good' : 'callout-crit'}`} style={{ marginBottom: 16 }} role="status">
          {check.problems.length === 0 ? (
            <strong>Link check passed: {check.ok} of {CHECKLIST.length} items resolve to a registered route, an existing tab and an implemented page.</strong>
          ) : (
            <>
              <strong>{check.problems.length} problem(s):</strong>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                {check.problems.slice(0, 12).map((p) => (
                  <li key={p.id + p.problem}>{p.id}: {p.problem}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      <Card>
        <CardHeader title="Checklist" action={<input type="text" placeholder="Search items" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 220 }} />} />
        <div className="stack" style={{ gap: 8, marginBottom: 12 }}>
          <FilterChips options={CHECKLIST_SECTIONS.map((s) => ({ value: s, label: s.replace('Planning & Preparation and Procurement & Contracting', 'Planning & Procurement'), count: CHECKLIST.filter((c) => c.section === s).length }))} value={section} onChange={setSection} allLabel="All sections" />
          <FilterChips options={(['built', 'simulated', 'integration'] as const).map((s) => ({ value: s, label: LABEL[s] }))} value={status} onChange={setStatus} allLabel="Any status" />
        </div>
        <DataTable
          dense
          rowKey={(c: ChecklistItem) => c.id}
          rows={rows}
          columns={[
            { key: 'id', header: 'ID', mono: true, width: 56, render: (c) => <strong>{c.id}</strong> },
            { key: 'title', header: 'Checklist item', render: (c) => <div>{c.title}{c.note && <div className="small muted">{c.note}</div>}</div> },
            { key: 'section', header: 'Section', render: (c) => <span className="small">{c.section.replace('Planning & Preparation and Procurement & Contracting', 'Planning & Procurement')}</span> },
            { key: 'status', header: 'Status', render: (c) => <Chip tone={TONE[c.status]}>{LABEL[c.status]}</Chip>, sortValue: (c) => c.status },
            { key: 'route', header: 'Opens', nosort: true, render: (c) => <Link to={routeFor(c)} className="small" style={{ color: 'var(--accent-strong)', fontWeight: 600 }}>{MODULE_BY_ID[c.module].label}{c.tab ? ` · ${c.tab}` : ''} →</Link> },
          ]}
        />
      </Card>
    </div>
  );
}
