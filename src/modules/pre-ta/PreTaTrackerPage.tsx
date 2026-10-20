import { useMemo } from 'react';
import { TrackerPage, type TrackerConfig } from '../../components/tracker/TrackerPage';
import { Chip } from '../../components/ui/Chip';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { PRETA_DEFS, type PreTaDef } from './preTaDefs';
import { advancePreTa, createPreTa, preTaLoaders } from '../../services/preTaService';
import type { PreTaRow, PreTaSlug } from '../../mocks/preTaMock';
import { areaLabel } from '../../mocks/master';
import { useRole } from '../../app/RoleContext';

const cache = new Map<string, TrackerConfig<PreTaRow>>();

function build(def: PreTaDef, hideCost: boolean): TrackerConfig<PreTaRow> {
  const last = def.stages.length - 1;
  const tone = (r: PreTaRow) => (r.stage === last ? 'good' : r.stage === 0 ? 'neutral' : 'accent');
  const blocked = (r: PreTaRow) => def.slug === 'equipment-inspection' && r.stage === 1 && String(r.metrics.result).startsWith('Failed');
  return {
    title: def.title,
    subtitle: def.subtitle,
    checklist: def.checklist,
    load: preTaLoaders[def.slug],
    kpis: hideCost && def.costKpis ? (rows) => def.kpis(rows).filter((k) => !def.costKpis!.includes(k.label)) : def.kpis,
    top: def.chart ? (rows) => def.chart!(rows, def.stages) : undefined,
    columns: [
      { key: 'ref', header: 'Ref', mono: true },
      { key: 'title', header: 'Item', render: (r) => <div style={{ maxWidth: 300 }}>{r.title}<div className="small muted">{areaLabel(r.area)} · {r.contractor}</div></div> },
      // metric columns read from row.metrics unless the definition supplies its own renderer
      ...def.metricCols.filter((c) => !(hideCost && def.costKeys?.includes(c.key))).map((c) => ({
        ...c,
        render: c.render ?? ((r: PreTaRow) => { const v = r.metrics[c.key]; return typeof v === 'number' ? v.toLocaleString() : String(v ?? ''); }),
        sortValue: c.sortValue ?? ((r: PreTaRow) => { const v = r.metrics[c.key]; return typeof v === 'number' ? v : String(v ?? ''); }),
      })),
      { key: 'stage', header: 'Stage', render: (r) => <div style={{ minWidth: 140 }}><Chip tone={tone(r)}>{def.stages[r.stage]}</Chip><div style={{ marginTop: 4 }}><ProgressBar value={r.stage} max={last} showLabel={false} height={5} /></div></div>, sortValue: (r) => r.stage },
      { key: 'plannedDay', header: 'Planned', mono: true, align: 'right', render: (r) => (r.plannedDay < 1 ? `T${r.plannedDay - 1}` : `D${r.plannedDay}`), sortValue: (r) => r.plannedDay },
    ],
    filters: [
      { label: 'stages', get: (r) => def.stages[r.stage], options: def.stages },
      { label: 'areas', get: (r) => r.area },
    ],
    search: (r) => `${r.ref} ${r.title} ${r.contractor} ${Object.values(r.metrics).join(' ')}`,
    rowAction: {
      label: (r) => (blocked(r) ? null : r.stage < last ? def.verbs[r.stage] : null),
      run: (r) => advancePreTa(r.id, last),
      toast: (r) => `${r.ref}: ${def.verbs[r.stage].toLowerCase()} done`,
    },
    create: {
      label: 'Add item',
      title: `Add to ${def.title}`,
      fields: def.fields,
      submit: (v) => createPreTa({ ...def.build(v), slug: def.slug }),
      toast: (r) => `${r.ref} added at stage "${def.stages[0]}"`,
    },
    detail: {
      title: (r) => `${r.ref} · ${def.stages[r.stage]}`,
      subtitle: (r) => `${areaLabel(r.area)} · ${r.contractor} · owner ${r.owner}`,
      render: (r) => (
        <div className="stack">
          <p style={{ margin: 0, fontWeight: 600 }}>{r.title}</p>
          <div className="eyebrow">Progress</div>
          {def.stages.map((s, i) => (
            <div key={s} className="list-row"><span style={{ opacity: i <= r.stage ? 1 : 0.5 }}>{i + 1}. {s}</span><Chip tone={i < r.stage ? 'good' : i === r.stage ? 'accent' : 'neutral'}>{i < r.stage ? 'done' : i === r.stage ? 'current' : 'pending'}</Chip></div>
          ))}
          <dl className="kv">
            {Object.entries(r.metrics).map(([k, v]) => (
              <div key={k} style={{ display: 'contents' }}><dt style={{ textTransform: 'capitalize' }}>{k.replace(/([A-Z])/g, ' $1')}</dt><dd>{String(v)}</dd></div>
            ))}
            <dt>Planned</dt><dd className="mono">{r.plannedDay < 1 ? `T${r.plannedDay - 1} days` : `TA day ${r.plannedDay}`}</dd>
          </dl>
        </div>
      ),
    },
    initialSort: { key: 'plannedDay', dir: 'asc' },
    pageSize: 12,
  };
}

export default function PreTaTrackerPage({ slug }: { slug: PreTaSlug }) {
  const { role } = useRole();
  const hideCost = role === 'contractor';
  const config = useMemo(() => {
    const key = `${slug}:${hideCost}`;
    let c = cache.get(key);
    if (!c) {
      c = build(PRETA_DEFS[slug], hideCost);
      cache.set(key, c);
    }
    return c;
  }, [slug, hideCost]);
  return <TrackerPage key={slug} config={config} />;
}
