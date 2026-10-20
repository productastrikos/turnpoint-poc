import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { ActionButton } from '../../components/ui/ActionButton';
import { DataTable } from '../../components/ui/DataTable';
import { Drawer } from '../../components/ui/Drawer';
import { StatusChip } from '../../components/ui/StatusChip';
import { LoadingState } from '../../components/ui/EmptyState';
import { SAP_APIS, SAP_MAPPINGS, SAP_SAMPLE_REQUEST, SAP_SAMPLE_RESPONSE } from '../../mocks/integrationMock';
import { getSapPending, importFromSap } from '../../services/sapService';
import type { SapItem } from '../../types/execution';
import { useToast } from '../../app/ToastContext';
import { useHub } from './useHub';
import { fmtOMR } from '../../mocks/_gen';
import { checkSapItems, type PairScore } from '../../services/duplicateService';
import { DupCheckChip } from '../scope/DuplicatePanel';
import { SapSandboxCard } from './SapSandboxCard';

const PRIORITY = { 1: 'Very high', 2: 'High', 3: 'Medium', 4: 'Low' } as const;

/** Reusable "Pull from SAP" drawer, also opened from Scope > Create from SAP (checklist S3). */
export function SapPullDrawer({ open, onClose, onImported }: { open: boolean; onClose: () => void; onImported?: (n: number) => void }) {
  const { showToast } = useToast();
  const [items, setItems] = useState<SapItem[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checks, setChecks] = useState<Record<string, PairScore | undefined>>({});

  useEffect(() => {
    if (!open || items) return;
    let live = true;
    setLoading(true);
    getSapPending().then(async (r) => {
      // every inbound notification / order is screened against the live worklist before anyone imports it (S9)
      const c = await checkSapItems(r.filter((i) => !i.imported));
      if (live) {
        setItems(r);
        setChecks(c);
        setLoading(false);
      }
    });
    return () => {
      live = false;
    };
  }, [open, items]);

  const available = (items ?? []).filter((i) => !i.imported);
  const toggle = (n: string) => setSelected((s) => (s.includes(n) ? s.filter((x) => x !== n) : [...s, n]));

  async function doImport() {
    setBusy(true);
    const jobs = await importFromSap(selected);
    setItems(await getSapPending());
    setSelected([]);
    setBusy(false);
    const flagged = selected.filter((n) => checks[n]?.kind === 'duplicate').map((n) => checks[n]!.b.id);
    showToast(
      `${jobs.length} SAP item${jobs.length === 1 ? '' : 's'} added to the Scope worklist at Gate 1 (${jobs.map((j) => j.id).join(', ')})${flagged.length ? `. ${flagged.length} flagged as possible duplicate${flagged.length === 1 ? '' : 's'} of ${flagged.join(', ')}: review in the worklist` : ''}`,
      flagged.length ? 'warn' : 'good'
    );
    onImported?.(jobs.length);
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={1080}
      title={<span>Pull from SAP S/4HANA <span className="sim-badge sim-simulated">Simulated</span></span>}
      subtitle="Open maintenance notifications and work orders (PM). Simulated OData read: no live system."
      footer={
        <>
          <span className="small muted" style={{ marginRight: 'auto' }}>{selected.length} selected</span>
          <button className="btn" onClick={onClose}>Close</button>
          <ActionButton variant="primary" small={false} busy={busy} disabled={selected.length === 0} onClick={doImport}>
            Import {selected.length || ''} as scope items
          </ActionButton>
        </>
      }
    >
      {loading || !items ? (
        <LoadingState label="Reading open notifications and work orders from SAP (simulated OData call)…" />
      ) : (
        <>
          <div className="toolbar">
            <button className="btn btn-sm" onClick={() => setSelected(available.map((i) => i.number))}>Select all ({available.length})</button>
            <button className="btn btn-sm" onClick={() => setSelected([])}>Clear</button>
          </div>
          <DataTable
            dense
            rowKey={(i) => i.number}
            rows={items}
            columns={[
              { key: 'sel', header: '', nosort: true, width: 30, render: (i) => <input type="checkbox" disabled={i.imported} checked={selected.includes(i.number)} onChange={() => toggle(i.number)} aria-label={`Select ${i.number}`} /> },
              { key: 'number', header: 'SAP number', mono: true, render: (i) => <span className="tag-chip sap">{i.number}</span> },
              { key: 'kind', header: 'Type', render: (i) => <span className="small">{i.kind}</span> },
              { key: 'description', header: 'Description', render: (i) => <span>{i.description}{i.imported && <> <Chip tone="good">Imported</Chip></>}</span> },
              { key: 'funcLoc', header: 'Functional location', mono: true, render: (i) => <span className="small">{i.funcLoc}</span> },
              { key: 'priority', header: 'Priority', render: (i) => <Chip tone={i.priority === 1 ? 'crit' : i.priority === 2 ? 'warn' : 'neutral'}>{PRIORITY[i.priority]}</Chip> },
              { key: 'plannerGroup', header: 'Planner group', render: (i) => <span className="small">{i.plannerGroup}</span> },
              { key: 'estCostOMR', header: 'Est. cost', mono: true, align: 'right', render: (i) => fmtOMR(i.estCostOMR) },
              { key: 'dup', header: 'AI duplicate check', nosort: true, render: (i) => (i.imported ? <span className="small muted">imported</span> : <DupCheckChip match={checks[i.number]} />) },
            ]}
          />
        </>
      )}
    </Drawer>
  );
}

export function SapTab() {
  const hub = useHub();
  const [open, setOpen] = useState(false);
  const pushes = hub.messages.filter((m) => m.system === 'SAP' && m.direction === 'Outbound').slice(0, 8);

  return (
    <div className="stack" style={{ gap: 16 }}>
      <Card>
        <CardHeader
          title="Object mapping: STO platform ↔ SAP S/4HANA"
          action={<ActionButton variant="primary" small={false} onClick={() => setOpen(true)}>Pull from SAP</ActionButton>}
        />
        <DataTable
          rowKey={(m) => m.sto}
          rows={SAP_MAPPINGS}
          columns={[
            { key: 'sto', header: 'STO object', render: (m) => <strong>{m.sto}</strong> },
            { key: 'sap', header: 'SAP object' },
            { key: 'iface', header: 'Interface', render: (m) => <span className="mono small">{m.iface}</span> },
            { key: 'direction', header: 'Direction', render: (m) => <Chip tone={m.direction.includes('Bi') ? 'accent' : m.direction.startsWith('Read') ? 'neutral' : 'warn'}>{m.direction}</Chip> },
            { key: 'trigger', header: 'Trigger', render: (m) => <span className="small">{m.trigger}</span> },
          ]}
        />
      </Card>

      <SapSandboxCard />

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <Card>
          <CardHeader title="Push to SAP: outbound status log" action={<Link className="btn btn-sm" to="/integrations?tab=monitoring">Open monitoring →</Link>} />
          <p className="small muted" style={{ margin: '-6px 0 8px' }}>When a scope item is approved, a work pack is released or an MC certificate is issued, a status message is queued for SAP. Approve an item in Scope and watch it appear here.</p>
          {pushes.map((m) => (
            <div key={m.id} className="list-row">
              <div>
                <span className="tag-chip sap">{m.key}</span> <span className="small">{m.object}</span>
                {m.note && <div className="small muted">{m.note}</div>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <StatusChip status={m.status} />
                <div className="mono small muted">{m.at.slice(11, 19)}</div>
              </div>
            </div>
          ))}
        </Card>
        <Card>
          <CardHeader title="Material availability (MM)" />
          <p className="small muted" style={{ margin: '-6px 0 8px' }}>Shown on work packs and BOM rows so planners see stock before they raise a requisition.</p>
          {[
            { m: 'Spiral wound gasket 8" 300#', stock: 12, res: 8, pr: '10012345' },
            { m: 'Stud bolt set B7/2H M24', stock: 220, res: 140, pr: null },
            { m: 'Mechanical seal API 682 (P-205)', stock: 0, res: 0, pr: '10012390' },
          ].map((r) => (
            <div key={r.m} className="list-row">
              <strong style={{ fontWeight: 600 }}>{r.m}</strong>
              <span className="row-wrap">
                <Chip tone={r.stock > 0 ? 'good' : 'crit'}>In stock {r.stock}</Chip>
                <Chip tone="neutral">Reserved {r.res}</Chip>
                {r.pr && <Chip tone="warn">PR {r.pr} open</Chip>}
              </span>
            </div>
          ))}
        </Card>
      </div>

      <Card>
        <CardHeader title="APIs consumed" />
        <div className="grid grid-2" style={{ alignItems: 'start' }}>
          <div>
            {SAP_APIS.map((a) => (
              <div key={a.name} className="list-row" style={{ alignItems: 'flex-start' }}>
                <span className="mono" style={{ fontWeight: 600, minWidth: 220 }}>{a.name}</span>
                <span className="small muted">{a.desc}</span>
              </div>
            ))}
            <p className="small muted" style={{ marginTop: 10 }}>Reference catalogue: SAP Business Accelerator Hub (api.sap.com). Service names are illustrative until verified against the client's S/4HANA 2025 landscape; each service must also be activated in the gateway.</p>
          </div>
          <div className="stack">
            <pre className="code">{SAP_SAMPLE_REQUEST}</pre>
            <pre className="code">{SAP_SAMPLE_RESPONSE}</pre>
          </div>
        </div>
      </Card>

      <SapPullDrawer open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
