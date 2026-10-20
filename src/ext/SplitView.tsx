import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { publish, type DemoAction } from '../integration/bus';
import './ext.css';

const LEFT_PAGES = [
  { path: '/', label: 'TURNPOINT · Command Dashboard' },
  { path: '/scope', label: 'TURNPOINT · Scope & Worklist' },
  { path: '/critical-path', label: 'TURNPOINT · Critical Path' },
  { path: '/ai-panel?tab=risk', label: 'TURNPOINT · AI risk prediction' },
  { path: '/mobile-capture', label: 'TURNPOINT · Mobile field app' },
  { path: '/integrations?tab=live', label: 'TURNPOINT · Integration Hub (live)' },
  { path: '/scf', label: 'TURNPOINT · SCF' },
];
const RIGHT = { sap: { path: '/ext/sap', label: 'SAP S/4HANA (stand-in)' }, p6: { path: '/ext/p6', label: 'Primavera P6 (stand-in)' } } as const;
const VIRTUAL_WIDTH = 1280; // each side renders at laptop width and is scaled into its half

const DEMO_BUTTONS: { system: 'sap' | 'p6'; action: DemoAction; label: string; hint: string }[] = [
  { system: 'sap', action: 'sap.notification.0', label: 'SAP notification: V-102 (AI flags duplicate)', hint: 'lands in Scope at Gate 1; the AI check flags a possible duplicate of existing scope' },
  { system: 'sap', action: 'sap.notification.1', label: 'SAP notification: E-204 gasket (same work front)', hint: 'lands in Scope at Gate 1; the AI check finds the same work front as an existing item' },
  { system: 'sap', action: 'sap.notification.2', label: 'SAP notification: P-305 strainer', hint: 'lands in Scope at Gate 1 with an AI duplicate check' },
  { system: 'sap', action: 'sap.cost.up', label: 'SAP: raise an order cost +20%', hint: 'estimate and budget update in TURNPOINT' },
  { system: 'p6', action: 'p6.extend', label: 'P6: extend E-204 Retube +3 days, Schedule (F9)', hint: 'TA end moves, critical path and AI forecast change' },
  { system: 'p6', action: 'p6.recover', label: 'P6: recover 3 days (night crew), Schedule (F9)', hint: 'finish and forecast improve' },
];

function Pane({ src, title, hidden }: { src: string; title: string; hidden?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 900, h: 900 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const scale = box.w > 0 ? box.w / VIRTUAL_WIDTH : 1; // a hidden pane measures 0 wide
  return (
    <div className="splitx-pane" ref={ref} style={hidden ? { display: 'none' } : undefined}>
      <iframe src={src} title={title} style={{ width: VIRTUAL_WIDTH, height: box.h / scale, transform: `scale(${scale})` }} />
    </div>
  );
}

/** TURNPOINT and one stand-in system side by side in one window, for presenting and recording the two-way sync. */
export default function SplitView() {
  const [params, setParams] = useSearchParams();
  const left = params.get('left') ?? '/';
  const [leftKey, setLeftKey] = useState(0);
  const [last, setLast] = useState('');
  const right = (params.get('right') === 'p6' ? 'p6' : 'sap') as keyof typeof RIGHT;
  useEffect(() => {
    document.title = 'TURNPOINT · integration split view';
  }, []);
  const run = (b: (typeof DEMO_BUTTONS)[number]) => {
    publish('TURNPOINT', { type: 'demo.run', action: b.action });
    setLast(`Sent: ${b.label}`);
  };
  const resetAll = () => {
    publish('TURNPOINT', { type: 'reset' }); // SAP and P6 stand-ins start clean
    setLeftKey((k) => k + 1); // reloading TURNPOINT restores its seed data
    setLast('Demo reset: TURNPOINT, SAP and P6 are back to the start');
  };
  return (
    <div className="splitx">
      <div className="splitx-bar">
        <span>Two-way sync, side by side</span>
        <select value={left} onChange={(e) => setParams({ left: e.target.value, right })} aria-label="TURNPOINT page">
          {LEFT_PAGES.map((p) => <option key={p.path} value={p.path}>{p.label}</option>)}
        </select>
        <span>⇄</span>
        <select value={right} onChange={(e) => setParams({ left, right: e.target.value })} aria-label="Other system">
          {Object.entries(RIGHT).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <span style={{ marginLeft: 'auto', fontWeight: 500, opacity: 0.75 }}>Both panes are live; messages travel over the local integration bus.</span>
      </div>
      <div className="splitx-demo" aria-label="Demo actions">
        <span className="splitx-demo-title">Demo actions</span>
        {DEMO_BUTTONS.map((b) => (
          <button key={b.action} className={`splitx-btn ${b.system}`} title={b.hint} onClick={() => run(b)}>{b.label}</button>
        ))}
        <button className="splitx-btn reset" title="Restore every screen to the starting numbers" onClick={resetAll}>Reset demo</button>
        {last && <span className="splitx-last">{last}</span>}
      </div>
      <div className="splitx-panes">
        <Pane key={`${left}-${leftKey}`} src={left} title="TURNPOINT" />
        {/* both consoles stay mounted so each keeps its state (and keeps listening) while the other is shown */}
        <Pane src={RIGHT.sap.path} title={RIGHT.sap.label} hidden={right !== 'sap'} />
        <Pane src={RIGHT.p6.path} title={RIGHT.p6.label} hidden={right !== 'p6'} />
      </div>
    </div>
  );
}
