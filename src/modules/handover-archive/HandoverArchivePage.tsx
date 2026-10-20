import { TrackerPage, type TrackerConfig } from '../../components/tracker/TrackerPage';
import { Card, CardHeader } from '../../components/ui/Card';
import { StatusChip } from '../../components/ui/StatusChip';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { advanceDoc, docActionLabel, listDocs } from '../../services/closeoutService';
import type { HandoverDoc } from '../../mocks/closeoutMock';
import { Icon } from '../../app/icons';

const pct = (rows: HandoverDoc[]) => Math.round((rows.reduce((s, r) => s + r.received, 0) / Math.max(1, rows.reduce((s, r) => s + r.expected, 0))) * 100);

const config: TrackerConfig<HandoverDoc> = {
  title: 'End-to-End Documents Handover & Archive',
  subtitle: 'The handover dossier by discipline and asset: what is expected, what has been received, review and acceptance, and archiving to the permanent record. Completeness is tracked until every document is archived.',
  checklist: 'C6',
  load: listDocs,
  kpis: (rows) => [
    { label: 'Document sets', value: String(rows.length) },
    { label: 'Completeness', value: `${pct(rows)}%`, tone: pct(rows) >= 90 ? 'good' : 'warn', delta: 'received vs expected' },
    { label: 'Missing', value: String(rows.filter((r) => r.status === 'Missing').length), tone: 'crit' },
    { label: 'Awaiting review', value: String(rows.filter((r) => r.status === 'Submitted').length), tone: 'warn' },
    { label: 'Archived', value: String(rows.filter((r) => r.status === 'Archived').length), tone: 'good' },
  ],
  top: (rows) => {
    const discs = Array.from(new Set(rows.map((r) => r.discipline)));
    const folders = Array.from(new Set(rows.map((r) => r.archivePath.split('/')[3])));
    return (
      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <Card>
          <CardHeader title="Completeness by discipline" />
          {discs.map((d) => <div key={d} className="list-row"><span>{d}</span><span style={{ width: 200 }}><ProgressBar value={pct(rows.filter((r) => r.discipline === d))} /></span></div>)}
        </Card>
        <Card>
          <CardHeader title="Archive structure" />
          <div className="mono small" style={{ lineHeight: 1.9 }}>
            <div><Icon name="folder" size={14} /> /Archive/STO-2026</div>
            {folders.map((f) => (
              <div key={f} style={{ paddingLeft: 18 }}><Icon name="folder" size={14} /> {f} <span className="muted">({rows.filter((r) => r.archivePath.includes(`/${f}/`) && r.status === 'Archived').length}/{rows.filter((r) => r.archivePath.includes(`/${f}/`)).length} archived)</span></div>
            ))}
          </div>
        </Card>
      </div>
    );
  },
  columns: [
    { key: 'id', header: 'ID', mono: true },
    { key: 'type', header: 'Document set', render: (r) => <div><strong>{r.type}</strong><div className="small muted">{r.asset} · {r.discipline}</div></div> },
    { key: 'rec', header: 'Received', render: (r) => <span className="row" style={{ minWidth: 160 }}><ProgressBar value={r.received} max={r.expected} /><span className="mono small">{r.received}/{r.expected}</span></span>, sortValue: (r) => r.received / r.expected },
    { key: 'status', header: 'Status', render: (r) => <StatusChip status={r.status} tone={r.status === 'Missing' ? 'crit' : r.status === 'Archived' ? 'good' : r.status === 'Accepted' ? 'accent' : 'warn'} />, sortValue: (r) => r.status },
    { key: 'path', header: 'Archive path', render: (r) => <span className="mono small muted">{r.archivePath}</span> },
  ],
  filters: [{ label: 'disciplines', get: (r) => r.discipline }, { label: 'status', get: (r) => r.status, options: ['Missing', 'Submitted', 'Reviewed', 'Accepted', 'Archived'] }],
  search: (r) => `${r.id} ${r.type} ${r.asset}`,
  rowAction: { label: (r) => docActionLabel(r.status), run: (r) => advanceDoc(r.id), toast: (r) => `${r.id} moved forward` },
  initialSort: { key: 'status', dir: 'asc' },
};

export default function HandoverArchivePage() {
  return <TrackerPage config={config} />;
}
