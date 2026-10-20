import { useEffect, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { StatTile } from '../../components/ui/StatTile';
import { Chip } from '../../components/ui/Chip';
import { DataTable } from '../../components/ui/DataTable';
import { FilterChips } from '../../components/ui/FilterChips';
import { LoadingState } from '../../components/ui/EmptyState';
import { Radar } from '../../components/charts/Radar';
import { BarChart } from '../../components/charts/BarChart';
import { listContractorKpis } from '../../services/executionService';
import { listNcrs } from '../../services/qualityService';
import type { ContractorKpi } from '../../mocks/executionMock';

interface Scored extends ContractorKpi {
  score: number;
  scores: Record<string, number>;
}

const AXES = ['Safety', 'Schedule', 'Quality', 'Productivity', 'Attendance', 'HSE closure'];

function score(k: ContractorKpi, ncr: number): Scored {
  const scores = {
    Safety: Math.max(0, Math.round(100 - k.trif * 100)),
    Schedule: Math.min(100, Math.round(k.spi * 100)),
    Quality: Math.max(0, Math.round(k.ftr - ncr * 1.5)),
    Productivity: Math.min(100, Math.round(k.productivity * 100)),
    Attendance: Math.round(k.attendance),
    'HSE closure': Math.round(k.hseObs),
  };
  const w = { Safety: 0.25, Schedule: 0.2, Quality: 0.2, Productivity: 0.15, Attendance: 0.1, 'HSE closure': 0.1 };
  const total = (Object.keys(w) as (keyof typeof w)[]).reduce((s, key) => s + scores[key] * w[key], 0);
  return { ...k, ncrOpen: ncr, score: Math.round(total), scores };
}

export default function ContractorKpiPage() {
  const [rows, setRows] = useState<Scored[] | null>(null);
  const [pick, setPick] = useState('all');

  useEffect(() => {
    Promise.all([listContractorKpis(), listNcrs()]).then(([k, n]) =>
      setRows(k.map((c) => score(c, n.filter((x) => x.contractor === c.contractor && x.status !== 'Closed').length)))
    );
  }, []);

  if (!rows) return <div><PageHeader title="Contractor KPIs" subtitle="" checklist="X29" /><LoadingState /></div>;

  const shown = pick === 'all' ? rows : rows.filter((r) => r.contractor === pick);
  const ranked = [...rows].sort((a, b) => b.score - a.score);

  return (
    <div>
      <PageHeader
        title="Contractor KPIs"
        subtitle="A scorecard per contractor, digitised from the daily data: safety, schedule, quality (first-time-right and open NCRs), productivity, attendance and HSE observation closure, combined into a weighted score."
        checklist="X29"
      />
      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <StatTile label="Best overall" value={ranked[0].contractor.split(' ')[0]} delta={`score ${ranked[0].score}`} tone="good" />
        <StatTile label="Needs attention" value={ranked[ranked.length - 1].contractor.split(' ')[0]} delta={`score ${ranked[ranked.length - 1].score}`} tone="warn" />
        <StatTile label="Average score" value={String(Math.round(rows.reduce((s, r) => s + r.score, 0) / rows.length))} />
        <StatTile label="Contractors" value={String(rows.length)} />
      </div>
      <div className="toolbar"><FilterChips options={rows.map((r) => ({ value: r.contractor }))} value={pick} onChange={setPick} allLabel="All contractors" /></div>
      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <Card>
          <CardHeader title="Scorecard radar" />
          <Radar axes={AXES} series={shown.map((r, i) => ({ name: r.contractor, values: AXES.map((a) => r.scores[a]), color: `var(--s${(i % 4) + 1})` }))} max={100} size={300} />
        </Card>
        <Card>
          <CardHeader title="Overall weighted score" />
          <BarChart height={290} labels={rows.map((r) => r.contractor.split(' ')[0])} series={[{ name: 'Score', color: 'var(--accent)', data: rows.map((r) => r.score) }]} yMax={100} refLine={{ value: 90, label: 'target 90' }} />
        </Card>
      </div>
      <Card style={{ marginTop: 16 }}>
        <CardHeader title="KPI detail" />
        <DataTable
          dense
          rowKey={(r: Scored) => r.contractor}
          rows={rows}
          columns={[
            { key: 'contractor', header: 'Contractor', render: (r) => <strong>{r.contractor}</strong> },
            { key: 'trif', header: 'TRIF', mono: true, align: 'right', render: (r) => r.trif.toFixed(2) },
            { key: 'spi', header: 'SPI', mono: true, align: 'right', render: (r) => <span style={{ color: r.spi < 0.95 ? 'var(--warn)' : undefined }}>{r.spi.toFixed(2)}</span> },
            { key: 'ncrOpen', header: 'Open NCRs', mono: true, align: 'right' },
            { key: 'ftr', header: 'First-time-right', mono: true, align: 'right', render: (r) => `${r.ftr}%` },
            { key: 'productivity', header: 'Productivity', mono: true, align: 'right', render: (r) => r.productivity.toFixed(2) },
            { key: 'attendance', header: 'Attendance', mono: true, align: 'right', render: (r) => `${r.attendance.toFixed(1)}%` },
            { key: 'rework', header: 'Rework', mono: true, align: 'right', render: (r) => `${r.rework.toFixed(2)}%` },
            { key: 'hseObs', header: 'HSE closure', mono: true, align: 'right', render: (r) => `${r.hseObs}%` },
            { key: 'score', header: 'Score', render: (r) => <Chip tone={r.score >= 90 ? 'good' : r.score >= 82 ? 'warn' : 'crit'}>{r.score}</Chip>, sortValue: (r) => r.score },
          ]}
        />
        <p className="small muted" style={{ margin: '10px 0 0' }}>Weights: safety 25%, schedule 20%, quality 20%, productivity 15%, attendance 10%, HSE closure 10%. Open NCRs come from the NCR register, attendance from the Attendance page.</p>
      </Card>
    </div>
  );
}
