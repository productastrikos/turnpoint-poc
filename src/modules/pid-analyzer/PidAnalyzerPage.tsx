import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { StatTile } from '../../components/ui/StatTile';
import { DataTable } from '../../components/ui/DataTable';
import { FilterChips } from '../../components/ui/FilterChips';
import { ActionButton } from '../../components/ui/ActionButton';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { DRAWINGS, EXTRACTION, type DrawingId, type Extracted } from '../../mocks/pidMock';
import { addMaterials } from '../../services/materialsService';
import { useToast } from '../../app/ToastContext';

const INK = 'var(--ink-2)';
const lineProps = { stroke: INK, strokeWidth: 2, fill: 'none' } as const;

function Pid() {
  return (
    <g {...lineProps}>
      <rect x={70} y={30} width={90} height={290} rx={40} />
      {[70, 110, 150, 190, 230, 270].map((y) => <line key={y} x1={70} x2={160} y1={y} y2={y} strokeWidth={1} stroke="var(--ink-3)" />)}
      <path d="M160 60 H300" />
      <rect x={300} y={50} width={120} height={50} rx={8} />
      {[62, 75, 88].map((y) => <line key={y} x1={308} x2={412} y1={y} y2={y} strokeWidth={1} />)}
      <path d="M420 75 H500 V125" />
      <rect x={480} y={125} width={180} height={70} rx={35} />
      <path d="M570 125 V90 H590 M570 90 V70" />
      <path d="M580 70 l10 -14 l10 14 z" />
      <path d="M570 195 V300" />
      <circle cx={535} cy={335} r={26} />
      <path d="M535 300 V309 M561 335 H600" />
      <path d="M600 335 H660 V250 M570 255 H660" />
      <path d="M570 255 l12 -9 v18 z M594 255 l-12 -9 v18 z" />
      <path d="M160 300 H265 M330 300 H375" />
      <path d="M265 300 l15 -12 v24 z M310 300 l-15 -12 v24 z" />
      <path d="M375 300 H380 V335 H561" />
      <circle cx={228} cy={355} r={16} />
      <path d="M228 300 V339" />
      <circle cx={700} cy={170} r={16} />
      <path d="M660 160 H684" />
      <text x={78} y={180} fill={INK} stroke="none" fontSize={14} fontFamily="var(--font-mono)">T-201</text>
      <text x={330} y={44} fill={INK} stroke="none" fontSize={13} fontFamily="var(--font-mono)">E-204</text>
      <text x={540} y={165} fill={INK} stroke="none" fontSize={13} fontFamily="var(--font-mono)">V-102</text>
      <text x={525} y={340} fill={INK} stroke="none" fontSize={11} fontFamily="var(--font-mono)">P-205</text>
      <text x={180} y={52} fill={INK} stroke="none" fontSize={11} fontFamily="var(--font-mono)">14"-P-2201</text>
      <text x={304} y={394} fill={INK} stroke="none" fontSize={11} fontFamily="var(--font-mono)">PV-3021</text>
      <text x={205} y={384} fill={INK} stroke="none" fontSize={10} fontFamily="var(--font-mono)">FT-2210</text>
      <text x={540} y={55} fill={INK} stroke="none" fontSize={10} fontFamily="var(--font-mono)">RV-1104</text>
      <text x={684} y={205} fill={INK} stroke="none" fontSize={10} fontFamily="var(--font-mono)">LT-4012</text>
      <text x={590} y={248} fill={INK} stroke="none" fontSize={10} fontFamily="var(--font-mono)">XV-2210</text>
    </g>
  );
}

function Iso() {
  return (
    <g {...lineProps}>
      <path d="M90 300 L90 210 L230 130 L360 205 L360 285 L520 195 L720 310" strokeWidth={4} stroke="var(--ink-2)" />
      {[[90, 300], [230, 130], [360, 205], [360, 285], [720, 310]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={5} fill="var(--surface)" />)}
      <path d="M440 238 l20 -12 v24 z M480 216 l-20 -12 v24 z" strokeWidth={2} />
      <path d="M85 300 h10 M95 300 v-6" />
      <path d="M570 255 l10 8 M620 281 l10 8 M670 297 l10 8" />
      <text x={110} y={330} fill={INK} stroke="none" fontSize={12} fontFamily="var(--font-mono)">6,420 mm</text>
      <text x={235} y={120} fill={INK} stroke="none" fontSize={12} fontFamily="var(--font-mono)">3,150 mm</text>
      <text x={400} y={250} fill={INK} stroke="none" fontSize={12} fontFamily="var(--font-mono)">GV-2201</text>
      <text x={560} y={240} fill={INK} stroke="none" fontSize={12} fontFamily="var(--font-mono)">14"-P-2201 → E-204</text>
      <text x={650} y={340} fill={INK} stroke="none" fontSize={11} fontFamily="var(--font-mono)">PS-S2</text>
    </g>
  );
}

function Ga() {
  return (
    <g {...lineProps}>
      <rect x={160} y={130} width={460} height={140} rx={6} />
      <rect x={90} y={140} width={70} height={120} rx={4} />
      <path d="M620 150 h50 v100 h-50 M620 140 v120" />
      {[160, 180, 200, 220, 240].map((y) => <line key={y} x1={170} x2={610} y1={y} y2={y} strokeWidth={1} stroke="var(--ink-3)" />)}
      {[210, 260, 460, 520].map((x) => <path key={x} d={`M${x} 130 V92 h20 V130`} />)}
      <path d="M255 270 l-20 50 h60 l-20 -50 M505 270 l-20 50 h60 l-20 -50" />
      <path d="M90 360 H670 M90 352 v16 M670 352 v16" strokeWidth={1} />
      <text x={330} y={382} fill={INK} stroke="none" fontSize={12} fontFamily="var(--font-mono)">6,096 mm tube length</text>
      <text x={110} y={118} fill={INK} stroke="none" fontSize={12} fontFamily="var(--font-mono)">E-204</text>
      <text x={216} y={85} fill={INK} stroke="none" fontSize={11} fontFamily="var(--font-mono)">N1</text>
      <text x={268} y={85} fill={INK} stroke="none" fontSize={11} fontFamily="var(--font-mono)">N2</text>
      <text x={468} y={85} fill={INK} stroke="none" fontSize={11} fontFamily="var(--font-mono)">N3</text>
      <text x={528} y={85} fill={INK} stroke="none" fontSize={11} fontFamily="var(--font-mono)">N4</text>
    </g>
  );
}

const STEPS = ['Reading drawing', 'Detecting symbols and lines', 'Reading tags and text', 'Matching to specifications', 'Building take-off'];

export default function PidAnalyzerPage() {
  const { showToast } = useToast();
  const [drawing, setDrawing] = useState<DrawingId>('pid');
  const [phase, setPhase] = useState<'idle' | 'running' | 'done'>('idle');
  const [progress, setProgress] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [pushed, setPushed] = useState<string[]>([]);
  const timer = useRef<number | null>(null);

  const items = EXTRACTION[drawing];
  const visible = phase === 'done' ? items : phase === 'running' ? items.filter((_, i) => i / items.length < progress / 100) : [];

  useEffect(
    () => () => {
      if (timer.current) window.clearInterval(timer.current);
    },
    []
  );

  function switchDrawing(d: string) {
    if (timer.current) window.clearInterval(timer.current);
    setDrawing(d as DrawingId);
    setPhase('idle');
    setProgress(0);
    setSelected([]);
  }

  function analyze() {
    setPhase('running');
    setProgress(0);
    setSelected([]);
    let p = 0;
    timer.current = window.setInterval(() => {
      p += 4;
      setProgress(p);
      if (p >= 100) {
        if (timer.current) window.clearInterval(timer.current);
        setPhase('done');
        setSelected(EXTRACTION[drawing].filter((i) => i.mto).map((i) => i.id));
        showToast(`Extracted ${EXTRACTION[drawing].length} items from ${DRAWINGS[drawing].ref} (simulated analysis)`, 'good');
      }
    }, 90);
  }

  async function push() {
    const lines = items.filter((i) => selected.includes(i.id) && i.mto && !pushed.includes(i.id));
    if (!lines.length) return;
    setBusy(true);
    await addMaterials(lines.map((l) => ({ ...l.mto!, area: 'Unit 200', qty: l.qty, uom: l.uom })));
    setPushed((p) => [...p, ...lines.map((l) => l.id)]);
    setBusy(false);
    showToast(`${lines.length} lines pushed to the MTO as not-raised items. Lead times classify them automatically.`, 'good');
  }

  const step = Math.min(STEPS.length - 1, Math.floor((progress / 100) * STEPS.length));
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <div>
      <PageHeader
        title="P&ID & Isometric Analyzer"
        subtitle="Extract equipment, lines, valves, instruments and fittings from P&IDs, isometrics and major GA drawings (exchangers, columns, vessels, furnaces, reactors) and push the take-off straight into the MTO. The drawings and the analysis result here are mock: no drawing is actually read."
        badges={['simulated']}
        checklist="G8"
        action={<FilterChips options={(Object.keys(DRAWINGS) as DrawingId[]).map((k) => ({ value: k, label: DRAWINGS[k].label.split(':')[0] }))} value={drawing} onChange={switchDrawing} hideAll />}
      />
      <div className="grid grid-3-2" style={{ alignItems: 'start' }}>
        <Card>
          <CardHeader title={DRAWINGS[drawing].label} action={<div className="row"><span className="mono small muted">{DRAWINGS[drawing].ref}</span><ActionButton variant="primary" busy={phase === 'running'} onClick={analyze}>{phase === 'done' ? 'Re-analyze' : 'Analyze drawing'}</ActionButton></div>} />
          <div style={{ position: 'relative', background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <svg viewBox={DRAWINGS[drawing].viewBox} width="100%" role="img" aria-label="Engineering drawing (mock)">
              <rect x={4} y={4} width={892} height={422} fill="none" stroke="var(--border)" />
              {drawing === 'pid' && <Pid />}
              {drawing === 'iso' && <Iso />}
              {drawing === 'ga' && <Ga />}
              {phase === 'running' && <rect x={0} y={0} width={(progress / 100) * 900} height={430} fill="var(--accent)" opacity={0.08} />}
              {phase === 'running' && <line x1={(progress / 100) * 900} x2={(progress / 100) * 900} y1={0} y2={430} stroke="var(--accent)" strokeWidth={3} />}
              {visible.map((i) => (
                <g key={i.id}>
                  <rect x={i.box[0]} y={i.box[1]} width={i.box[2]} height={i.box[3]} fill="none" stroke={i.kind === 'Equipment' ? 'var(--s4)' : i.kind === 'Valve' ? 'var(--crit)' : i.kind === 'Line' ? 'var(--accent)' : 'var(--s2)'} strokeWidth={2} strokeDasharray="5 3" rx={4} opacity={selected.includes(i.id) || phase === 'running' ? 1 : 0.55} />
                  <text x={i.box[0] + 3} y={i.box[1] - 4} fontSize={10.5} fill="var(--accent-strong)" fontFamily="var(--font-mono)" fontWeight={600}>{i.tag}</text>
                </g>
              ))}
            </svg>
          </div>
          {phase === 'running' && (
            <div style={{ marginTop: 10 }}>
              <div className="spread small"><span>{STEPS[step]}…</span><span className="mono">{progress}%</span></div>
              <ProgressBar value={progress} tone="accent" showLabel={false} height={8} />
            </div>
          )}
          {phase === 'idle' && <p className="small muted" style={{ margin: '10px 0 0' }}>Press Analyze to run the (simulated) extraction.</p>}
        </Card>

        <div className="stack">
          <div className="grid grid-2" style={{ gap: 10 }}>
            <StatTile label="Items found" value={String(visible.length)} delta={`of ${items.length}`} tone="accent" />
            <StatTile label="Avg confidence" value={visible.length ? `${Math.round(visible.reduce((s, i) => s + i.confidence, 0) / visible.length)}%` : '—'} tone="good" />
          </div>
          <Card>
            <CardHeader title="Take-off to MTO" />
            <p className="small muted" style={{ margin: '-6px 0 10px' }}>{selected.length} material lines selected. Each becomes an MTO line with an estimated delivery time, and is classified long / medium / short lead automatically.</p>
            <ActionButton variant="primary" small={false} busy={busy} disabled={phase !== 'done' || selected.filter((s) => !pushed.includes(s)).length === 0} onClick={push}>Push to MTO</ActionButton>
            {pushed.length > 0 && <div className="callout callout-good" style={{ marginTop: 10 }}>{pushed.length} lines pushed. <Link to="/materials" style={{ fontWeight: 700 }}>Open Materials / MTO →</Link></div>}
          </Card>
        </div>
      </div>

      {phase === 'done' && (
        <Card style={{ marginTop: 16 }}>
          <CardHeader title="Extracted items" />
          <DataTable
            dense
            rowKey={(i: Extracted) => i.id}
            rows={items}
            columns={[
              { key: 'sel', header: '', nosort: true, width: 30, render: (i) => (i.mto ? <input type="checkbox" checked={selected.includes(i.id)} disabled={pushed.includes(i.id)} onChange={() => toggle(i.id)} aria-label={`Select ${i.tag}`} /> : null) },
              { key: 'kind', header: 'Type', render: (i) => <Chip tone={i.kind === 'Equipment' ? 'accent' : i.kind === 'Valve' ? 'crit' : 'neutral'}>{i.kind}</Chip> },
              { key: 'tag', header: 'Tag', mono: true, render: (i) => <strong>{i.tag}</strong> },
              { key: 'desc', header: 'Description' },
              { key: 'spec', header: 'Specification', render: (i) => <span className="small">{i.spec}</span> },
              { key: 'qty', header: 'Qty', mono: true, align: 'right', render: (i) => `${i.qty} ${i.uom}` },
              { key: 'confidence', header: 'Confidence', render: (i) => <ProgressBar value={i.confidence} tone={i.confidence >= 95 ? 'good' : 'warn'} />, sortValue: (i) => i.confidence },
              { key: 'mto', header: 'In MTO', render: (i) => (pushed.includes(i.id) ? <Chip tone="good">pushed</Chip> : i.mto ? <Chip tone="neutral">ready</Chip> : <span className="muted small">reference data</span>) },
            ]}
          />
        </Card>
      )}
    </div>
  );
}
