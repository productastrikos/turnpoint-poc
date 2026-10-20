import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { PageHeader } from '../ui/PageHeader';
import { Card } from '../ui/Card';
import { StatTile } from '../ui/StatTile';
import { DataTable, type Column } from '../ui/DataTable';
import { FilterChips } from '../ui/FilterChips';
import { ActionButton } from '../ui/ActionButton';
import { Drawer } from '../ui/Drawer';
import { FormDialog, type FieldDef, type FormValues } from '../ui/FormDialog';
import { LoadingState } from '../ui/EmptyState';
import type { BadgeKind } from '../ui/SimBadge';
import { useToast, type ToastTone } from '../../app/ToastContext';
import type { KPI } from '../../types';

export interface TrackerFilter<T> {
  label: string;
  get: (row: T) => string;
  options?: string[];
}

export interface TrackerConfig<T extends { id: string }> {
  title: string;
  subtitle: string;
  badges?: BadgeKind[];
  checklist?: string;
  load: () => Promise<T[]>;
  kpis: (rows: T[]) => KPI[];
  columns: Column<T>[];
  filters?: TrackerFilter<T>[];
  search?: (row: T) => string;
  rowAction?: {
    label: (row: T) => string | null;
    run: (row: T) => Promise<unknown>;
    toast: (row: T) => string;
    tone?: ToastTone;
    variant?: 'default' | 'primary' | 'danger';
  };
  create?: {
    label: string;
    title: string;
    fields: FieldDef[];
    submit: (values: FormValues) => Promise<T>;
    toast: (created: T) => string;
  };
  detail?: { title: (row: T) => ReactNode; subtitle?: (row: T) => ReactNode; render: (row: T) => ReactNode };
  top?: (rows: T[]) => ReactNode;
  pageSize?: number;
  initialSort?: { key: string; dir: 'asc' | 'desc' };
  kpiColumns?: 3 | 4 | 5 | 6;
  extraAction?: ReactNode;
  /** Render without the page header (when the tracker lives inside a tab of a bigger page). */
  embedded?: boolean;
}

/** Config-driven tracker page: KPI tiles, chart slot, filter chips, sortable table, detail drawer, row action and "add" form. */
export function TrackerPage<T extends { id: string }>({ config }: { config: TrackerConfig<T> }) {
  const { showToast } = useToast();
  const [rows, setRows] = useState<T[] | null>(null);
  const [q, setQ] = useState('');
  const [filterValues, setFilterValues] = useState<Record<number, string>>({});
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const { load } = config;
  const reload = useCallback(() => load().then(setRows), [load]);

  useEffect(() => {
    let live = true;
    load().then((r) => live && setRows(r));
    return () => {
      live = false;
    };
  }, [load]);

  const all = useMemo(() => rows ?? [], [rows]);
  const visible = useMemo(
    () =>
      all.filter((r) => {
        if (q && config.search && !config.search(r).toLowerCase().includes(q.toLowerCase())) return false;
        return (config.filters ?? []).every((f, i) => !filterValues[i] || filterValues[i] === 'all' || f.get(r) === filterValues[i]);
      }),
    [all, q, filterValues, config]
  );

  const current = selected ? all.find((r) => r.id === selected) ?? null : null;

  async function act(row: T) {
    if (!config.rowAction) return;
    setBusy(row.id);
    await config.rowAction.run(row);
    await reload();
    setBusy(null);
    showToast(config.rowAction.toast(row), config.rowAction.tone ?? 'good');
  }

  async function create(values: FormValues) {
    if (!config.create) return;
    const created = await config.create.submit(values);
    await reload();
    setOpen(false);
    showToast(config.create.toast(created), 'good');
  }

  const ra = config.rowAction;
  const columns: Column<T>[] = ra
    ? [
        ...config.columns,
        {
          key: '_action',
          header: '',
          nosort: true,
          render: (r: T) => {
            const label = ra.label(r);
            return label ? (
              <ActionButton
                variant={ra.variant ?? 'default'}
                busy={busy === r.id}
                onClick={(e) => {
                  e.stopPropagation();
                  void act(r);
                }}
              >
                {label}
              </ActionButton>
            ) : (
              <span className="small muted">—</span>
            );
          },
        },
      ]
    : config.columns;

  if (!rows) {
    return (
      <div>
        {!config.embedded && <PageHeader title={config.title} subtitle={config.subtitle} badges={config.badges} checklist={config.checklist} />}
        <LoadingState />
      </div>
    );
  }

  const kpis = config.kpis(all);
  const cols = config.kpiColumns ?? (kpis.length >= 6 ? 6 : kpis.length === 5 ? 5 : kpis.length === 3 ? 3 : 4);

  return (
    <div>
      {config.embedded ? (
        (config.extraAction || config.create) && (
          <div className="row" style={{ justifyContent: 'flex-end', marginBottom: 12 }}>
            {config.extraAction}
            {config.create && <ActionButton variant="primary" small={false} onClick={() => setOpen(true)}>{config.create.label}</ActionButton>}
          </div>
        )
      ) : (
        <PageHeader
          title={config.title}
          subtitle={config.subtitle}
          badges={config.badges}
          checklist={config.checklist}
          action={
            <div className="row">
              {config.extraAction}
              {config.create && <ActionButton variant="primary" small={false} onClick={() => setOpen(true)}>{config.create.label}</ActionButton>}
            </div>
          }
        />
      )}

      <div className={`grid grid-${cols}`} style={{ marginBottom: 16, gap: 12 }}>
        {kpis.map((k) => (
          <StatTile key={k.label} {...k} />
        ))}
      </div>

      {config.top && <div style={{ marginBottom: 16 }}>{config.top(all)}</div>}

      <Card>
        {(config.search || (config.filters && config.filters.length > 0)) && (
          <div className="toolbar">
            {config.search && <input type="text" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />}
            {(config.filters ?? []).map((f, i) => {
              const options = f.options ?? Array.from(new Set(all.map(f.get))).sort();
              return <FilterChips key={f.label} options={options.map((o) => ({ value: o, count: all.filter((r) => f.get(r) === o).length }))} value={filterValues[i] ?? 'all'} onChange={(v) => setFilterValues((s) => ({ ...s, [i]: v }))} allLabel={`All ${f.label}`} />;
            })}
            <span className="small muted" style={{ marginLeft: 'auto' }}>{visible.length} of {all.length}</span>
          </div>
        )}
        <DataTable
          columns={columns}
          rows={visible}
          rowKey={(r) => r.id}
          onRowClick={config.detail ? (r) => setSelected(r.id) : undefined}
          activeKey={selected}
          pageSize={config.pageSize ?? 12}
          initialSort={config.initialSort}
          dense
        />
      </Card>

      {config.create && <FormDialog open={open} onClose={() => setOpen(false)} title={config.create.title} fields={config.create.fields} submitLabel={config.create.label} onSubmit={create} />}

      {config.detail && (
        <Drawer
          open={Boolean(current)}
          onClose={() => setSelected(null)}
          title={current ? config.detail.title(current) : ''}
          subtitle={current && config.detail.subtitle ? config.detail.subtitle(current) : undefined}
          footer={
            current && config.rowAction && config.rowAction.label(current) ? (
              <ActionButton variant="primary" small={false} busy={busy === current.id} onClick={() => act(current)}>
                {config.rowAction.label(current)}
              </ActionButton>
            ) : undefined
          }
        >
          {current && config.detail.render(current)}
        </Drawer>
      )}
    </div>
  );
}
