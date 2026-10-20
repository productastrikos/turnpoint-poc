import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { StatTile } from '../../components/ui/StatTile';
import { ActionButton } from '../../components/ui/ActionButton';
import { DataTable } from '../../components/ui/DataTable';
import { Gantt, type GanttRow } from '../../components/charts/Gantt';
import {
  ADD_OPTIONS,
  BASELINE,
  DROP_OPTIONS,
  compute,
  deleteSaved,
  listSaved,
  runWhatIf,
  saveScenario,
  type Scenario,
  type SavedScenario,
  type WhatIfResult,
} from '../../services/whatIfService';
import { useToast } from '../../app/ToastContext';
import { CostGuard } from '../../components/ui/CostValue';
import { useRole } from '../../app/RoleContext';
import { shortDate } from '../../mocks/_gen';

const base = compute(BASELINE);
const fmtD = (d: number) => (d === 0 ? 'on baseline' : `${d > 0 ? '+' : ''}${d} d`);

export default function WhatIfPage() {
  const { showToast } = useToast();
  const { role } = useRole();
  const [s, setS] = useState<Scenario>(BASELINE);
  const [r, setR] = useState<WhatIfResult>(base);
  const [saved, setSaved] = useState<SavedScenario[]>([]);
  const [name, setName] = useState('');

  useEffect(() => {
    let live = true;
    runWhatIf(s).then((x) => live && setR(x));
    return () => {
      live = false;
    };
  }, [s]);
  const refresh = useCallback(() => listSaved().then(setSaved), []);
  useEffect(() => {
    refresh();
  }, [refresh]);

  const toggle = (key: 'drops' | 'adds', id: string) => setS((p) => ({ ...p, [key]: p[key].includes(id) ? p[key].filter((x) => x !== id) : [...p[key], id] }));

  async function save() {
    const sc = await saveScenario(name, s);
    setName('');
    await refresh();
    showToast(`${sc.name} saved: finish ${shortDate(sc.result.finish)} (${fmtD(sc.result.deltaDays)})`, 'good');
  }

  const rows: GanttRow[] = (['CP1', 'CP2', 'CP3'] as const).flatMap((p) => [
    { id: `${p}-b`, label: `${p} baseline forecast`, start: '2026-08-16', end: base.pathEnd[p], color: 'var(--ink-3)' },
    { id: `${p}-s`, label: `${p} scenario`, start: '2026-08-16', end: r.pathEnd[p], color: r.pathEnd[p] > base.pathEnd[p] ? 'var(--crit)' : r.pathEnd[p] < base.pathEnd[p] ? 'var(--good)' : 'var(--accent)' },
  ]);

  const dirty = JSON.stringify(s) !== JSON.stringify(BASELINE);

  return (
    <div>
      <PageHeader
        title="What-if Schedule Analysis"
        subtitle="Simulate scenarios of completion and of dropping scope against the baseline. Drop a job, add a crew, approve extra work or move the start-up window and see the new finish date, cost and driving path. The model is deliberately simple and deterministic, so every number can be explained."
        checklist="X11"
        action={dirty ? <button className="btn" onClick={() => setS(BASELINE)}>Reset to baseline</button> : undefined}
      />

      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <StatTile label="Scenario finish" value={shortDate(r.finish)} delta={`${fmtD(r.deltaDays)} vs baseline forecast`} trend={r.deltaDays > 0 ? 'down' : r.deltaDays < 0 ? 'up' : 'flat'} tone={r.deltaDays > 0 ? 'crit' : r.deltaDays < 0 ? 'good' : 'neutral'} />
        <StatTile label="Vs contractual end (3 Sep)" value={r.vsPlanDays > 0 ? `+${r.vsPlanDays} d` : r.vsPlanDays < 0 ? `${r.vsPlanDays} d` : 'on plan'} tone={r.vsPlanDays > 0 ? 'warn' : 'good'} />
        {role === 'contractor' ? <StatTile label="Cost at completion" value="Restricted" delta="cost figures are OQ staff only" /> : <StatTile label="Cost at completion" value={`OMR ${(r.costOMR / 1e6).toFixed(2)}M`} delta={`${r.deltaCost >= 0 ? '+' : ''}${r.deltaCost.toLocaleString()} vs baseline`} trend={r.deltaCost > 0 ? 'down' : 'up'} tone={r.deltaCost > 0 ? 'warn' : 'good'} />}
        <StatTile label="Driving path" value={r.drivingPath} delta={`${r.manhours.toLocaleString()} man-hours`} tone="accent" />
      </div>

      <div className="grid grid-2-3" style={{ alignItems: 'start' }}>
        <div className="stack">
          <Card>
            <CardHeader title="Drop scope" />
            {DROP_OPTIONS.map((d) => (
              <label key={d.jobId} className="list-row" style={{ cursor: 'pointer', alignItems: 'flex-start' }}>
                <span style={{ display: 'flex', gap: 10 }}>
                  <input type="checkbox" checked={s.drops.includes(d.jobId)} onChange={() => toggle('drops', d.jobId)} />
                  <span><strong style={{ fontSize: 13 }}>{d.jobId} {d.label}</strong><div className="small muted">{d.note}</div></span>
                </span>
                <CostGuard><span className="mono small">OMR {(d.costOMR / 1000).toFixed(0)}K</span></CostGuard>
              </label>
            ))}
          </Card>
          <Card>
            <CardHeader title="Approve extra work" />
            {ADD_OPTIONS.map((a) => (
              <label key={a.id} className="list-row" style={{ cursor: 'pointer', alignItems: 'flex-start' }}>
                <span style={{ display: 'flex', gap: 10 }}>
                  <input type="checkbox" checked={s.adds.includes(a.id)} onChange={() => toggle('adds', a.id)} />
                  <span><strong style={{ fontSize: 13 }}>{a.label}</strong><div className="small muted">{a.note}</div></span>
                </span>
                <CostGuard><span className="mono small">+OMR {(a.costOMR / 1000).toFixed(0)}K</span></CostGuard>
              </label>
            ))}
          </Card>
          <Card>
            <CardHeader title="Resources and timing" />
            {(['CP1', 'CP2', 'CP3'] as const).map((p) => {
              const key = (`crews${p}`) as 'crewsCP1' | 'crewsCP2' | 'crewsCP3';
              return (
                <div key={p} style={{ marginBottom: 12 }}>
                  <div className="spread small"><span>Extra crews on <strong>{p}</strong></span><span className="mono">{s[key]}</span></div>
                  <input type="range" min={0} max={3} step={1} value={s[key]} onChange={(e) => setS({ ...s, [key]: Number(e.target.value) })} style={{ width: '100%' }} aria-label={`Extra crews on ${p}`} />
                </div>
              );
            })}
            <label className="list-row" style={{ cursor: 'pointer' }}>
              <span style={{ display: 'flex', gap: 10 }}><input type="checkbox" checked={s.overtimeCP1} onChange={() => setS({ ...s, overtimeCP1: !s.overtimeCP1 })} /> Overtime on CP1 (+10% productivity)</span>
              <CostGuard><span className="mono small">+OMR 38K</span></CostGuard>
            </label>
            <div style={{ marginTop: 10 }}>
              <div className="spread small"><span>Shift start-up window</span><span className="mono">{s.startShift > 0 ? '+' : ''}{s.startShift} d</span></div>
              <input type="range" min={-3} max={5} step={1} value={s.startShift} onChange={(e) => setS({ ...s, startShift: Number(e.target.value) })} style={{ width: '100%' }} aria-label="Shift start-up window" />
            </div>
          </Card>
        </div>

        <div className="stack">
          <Card>
            <CardHeader title="Critical paths: baseline vs scenario" />
            <Gantt rows={rows} from="2026-08-16" to="2026-09-08" tickMode="day" rowHeight={26} labelWidth={150} width={680} today="2026-08-16" milestones={[{ date: '2026-09-03', label: 'Contractual end', color: 'var(--crit)' }, { date: r.finish, label: 'Scenario finish', color: 'var(--accent)' }]} />
          </Card>
          <Card>
            <CardHeader title="Why the result changed" action={<Chip tone={r.deltaDays > 0 ? 'crit' : r.deltaDays < 0 ? 'good' : 'neutral'}>{fmtD(r.deltaDays)}</Chip>} />
            {r.notes.length === 0 && <p className="small muted" style={{ margin: 0 }}>Baseline: current forecast finish 5 Sep, +2 days against the 3 Sep contractual end because CP1 is slipping (CPA-003 internals inspection, CPA-008 tie-in). Change an input on the left.</p>}
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.7 }}>
              {r.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Saved scenarios" />
            <div className="row" style={{ marginBottom: 10 }}>
              <input type="text" placeholder="Scenario name" value={name} onChange={(e) => setName(e.target.value)} style={{ flex: 1 }} />
              <ActionButton variant="primary" small={false} disabled={!dirty} onClick={save}>Save scenario</ActionButton>
            </div>
            {saved.length === 0 ? (
              <p className="small muted" style={{ margin: 0 }}>Save a scenario to compare it with others.</p>
            ) : (
              <DataTable
                dense
                rowKey={(x: SavedScenario) => x.id}
                rows={saved}
                columns={[
                  { key: 'name', header: 'Scenario' },
                  { key: 'finish', header: 'Finish', mono: true, render: (x) => shortDate(x.result.finish), sortValue: (x) => x.result.finish },
                  { key: 'delta', header: 'Vs baseline', render: (x) => <Chip tone={x.result.deltaDays > 0 ? 'crit' : x.result.deltaDays < 0 ? 'good' : 'neutral'}>{fmtD(x.result.deltaDays)}</Chip>, sortValue: (x) => x.result.deltaDays },
                  { key: 'cost', header: 'Cost', mono: true, align: 'right', render: (x) => <CostGuard>{`OMR ${(x.result.costOMR / 1e6).toFixed(2)}M`}</CostGuard>, sortValue: (x) => x.result.costOMR },
                  { key: 'a', header: '', nosort: true, render: (x) => <span className="row"><button className="btn btn-sm" onClick={() => setS(x.scenario)}>Load</button><button className="btn btn-sm" onClick={async () => { await deleteSaved(x.id); refresh(); }}>Delete</button></span> },
                ]}
              />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
