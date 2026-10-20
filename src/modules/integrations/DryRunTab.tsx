import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { StatTile } from '../../components/ui/StatTile';
import { ActionButton } from '../../components/ui/ActionButton';
import { DataTable } from '../../components/ui/DataTable';
import { FilterChips } from '../../components/ui/FilterChips';
import { DRY_RUN, type DryRunScenario, type DryRunStatus } from '../../mocks/dryRunMock';
import { useToast } from '../../app/ToastContext';

const TONE: Record<DryRunStatus, 'good' | 'accent' | 'neutral'> = { Pass: 'good', Simulated: 'accent', Planned: 'neutral' };

export function DryRunTab() {
  const { showToast } = useToast();
  const [ran, setRan] = useState(0); // how many scenarios have been "run"
  const [running, setRunning] = useState(false);
  const [filter, setFilter] = useState('all');

  const counts = (s: DryRunStatus) => DRY_RUN.filter((d) => d.status === s).length;

  async function runAll() {
    setRunning(true);
    setRan(0);
    for (let i = 1; i <= DRY_RUN.length; i++) {
      await new Promise((r) => setTimeout(r, 70));
      setRan(i);
    }
    setRunning(false);
    showToast(`Dry run complete: ${counts('Pass')} pass, ${counts('Simulated')} simulated, ${counts('Planned')} planned (not demonstrated)`, 'accent');
  }

  const rows = DRY_RUN.filter((d) => filter === 'all' || d.status === filter);

  return (
    <div className="stack" style={{ gap: 16 }}>
      <Card>
        <div className="spread">
          <div>
            <h3 style={{ fontSize: 17 }}>SOW section 16: Dry Run readiness</h3>
            <p className="small muted" style={{ margin: '4px 0 0', maxWidth: 780 }}>
              The 34 minimum test scenarios from the client's SOW (pp. 45-48). Each row links to the screen that demonstrates it. Statuses are honest: <strong>Pass</strong> means the behaviour really runs in this app on mock data, <strong>Simulated</strong> means shown end to end with generated files or systems, <strong>Planned</strong> means not demonstrated in this POC.
            </p>
          </div>
          <ActionButton variant="primary" small={false} busy={running} onClick={runAll}>Run all 34</ActionButton>
        </div>
      </Card>

      <div className="grid grid-4" style={{ gap: 12 }}>
        <StatTile label="Scenarios" value={String(DRY_RUN.length)} />
        <StatTile label="Pass" value={String(counts('Pass'))} tone="good" />
        <StatTile label="Simulated" value={String(counts('Simulated'))} tone="accent" />
        <StatTile label="Planned (not shown)" value={String(counts('Planned'))} tone="warn" />
      </div>

      <Card>
        <div className="toolbar">
          <FilterChips options={[{ value: 'Pass' }, { value: 'Simulated' }, { value: 'Planned' }]} value={filter} onChange={setFilter} />
        </div>
        <DataTable
          dense
          rowKey={(d) => String(d.sr)}
          rows={rows}
          initialSort={{ key: 'sr', dir: 'asc' }}
          columns={[
            { key: 'sr', header: 'SR#', mono: true, width: 48, align: 'right' },
            { key: 'category', header: 'Category', render: (d) => <span className="small">{d.category}</span> },
            { key: 'scenario', header: 'Test scenario', render: (d) => d.scenario },
            { key: 'where', header: 'Where it is shown', render: (d: DryRunScenario) => <Link to={d.to} className="small" style={{ color: 'var(--accent-strong)' }}>{d.where} →</Link>, sortValue: (d) => d.where },
            {
              key: 'status',
              header: 'Result',
              render: (d) => (d.sr <= ran ? <Chip tone={TONE[d.status]}>{d.status}</Chip> : <Chip tone="neutral">{running ? '…' : 'Not run'}</Chip>),
              sortValue: (d) => d.status,
            },
          ]}
        />
      </Card>
    </div>
  );
}
