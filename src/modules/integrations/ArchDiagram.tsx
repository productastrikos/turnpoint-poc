import { useChartWidth } from '../../components/charts/chartKit';

/** Architecture diagram: P6 <-> TURNPOINT <-> SAP Integration Suite <-> S/4HANA. Pulse dots run along the links while a sync is running. */
export function ArchDiagram({ running }: { running: boolean }) {
  const [wrap, width] = useChartWidth(1000, 640);
  const GAP = 64;
  const W = (width - 3 * GAP) / 4;
  const boxes = [
    { title: 'Primavera P6', sub: 'v24.21 (UAT)', note: 'Schedule: logic, calendars, resources', color: 'var(--s4)' },
    { title: 'TURNPOINT', sub: 'STO Platform', note: 'Field-facing single source', color: 'var(--accent)' },
    { title: 'SAP Integration Suite', sub: '(CPI)', note: 'Mapping, monitoring, retry', color: 'var(--s7)' },
    { title: 'SAP S/4HANA 2025', sub: 'PM · MM · PS', note: 'Orders, materials, cost', color: 'var(--s8)' },
  ].map((b, i) => ({ ...b, x: i * (W + GAP) }));
  const maxNote = Math.floor((W - 16) / 5.6);
  const H = 110;
  const y = 12;
  const ym = y + H / 2;
  const legend = ['.XER file / P6 REST API', 'REST / OData V2', 'OData V2 / REST, OAuth 2.0 + mTLS'];

  return (
    <div ref={wrap}>
      <svg viewBox={`0 0 ${width} 136`} width="100%" height={136} role="img" aria-label="Integration architecture: Primavera P6, TURNPOINT, SAP Integration Suite, SAP S/4HANA">
        {boxes.slice(0, 3).map((b, i) => {
          const x1 = b.x + W;
          const x2 = boxes[i + 1].x;
          return (
            <g key={i}>
              <line x1={x1} y1={ym} x2={x2} y2={ym} stroke="var(--ink-3)" strokeWidth={2.5} />
              <path d={`M ${x2 - 9} ${ym - 6} L ${x2} ${ym} L ${x2 - 9} ${ym + 6}`} fill="none" stroke="var(--ink-3)" strokeWidth={2.5} />
              <path d={`M ${x1 + 9} ${ym - 6} L ${x1} ${ym} L ${x1 + 9} ${ym + 6}`} fill="none" stroke="var(--ink-3)" strokeWidth={2.5} />
              <circle cx={(x1 + x2) / 2} cy={ym - 18} r={11} fill="var(--accent-soft)" stroke="var(--accent)" />
              <text x={(x1 + x2) / 2} y={ym - 14} textAnchor="middle" fontSize={13} fontWeight={700} fill="var(--accent-strong)">{i + 1}</text>
              {running && (
                <>
                  <circle r={6} fill="var(--accent)">
                    <animateMotion dur="1.2s" repeatCount="indefinite" path={`M ${x1} ${ym} L ${x2} ${ym}`} />
                  </circle>
                  <circle r={6} fill="var(--warn)">
                    <animateMotion dur="1.2s" begin="0.6s" repeatCount="indefinite" path={`M ${x2} ${ym} L ${x1} ${ym}`} />
                  </circle>
                </>
              )}
            </g>
          );
        })}
        {boxes.map((b) => (
          <g key={b.title}>
            <rect x={b.x} y={y} width={W} height={H} rx={12} fill="var(--surface)" stroke={b.color} strokeWidth={2.5} />
            <rect x={b.x} y={y} width={W} height={9} rx={4} fill={b.color} />
            <text x={b.x + W / 2} y={y + 46} textAnchor="middle" fontSize={b.title.length > 16 ? 15 : 17} fontWeight={700} fill="var(--ink)" fontFamily="var(--font-display)">{b.title}</text>
            <text x={b.x + W / 2} y={y + 68} textAnchor="middle" fontSize={12.5} fill="var(--ink-2)">{b.sub}</text>
            <text x={b.x + W / 2} y={y + 92} textAnchor="middle" fontSize={11} fill="var(--ink-3)">{b.note.length > maxNote ? `${b.note.slice(0, maxNote - 1)}…` : b.note}<title>{b.note}</title></text>
          </g>
        ))}
      </svg>
      <div className="row-wrap small" style={{ marginTop: 6, justifyContent: 'center', gap: 18 }}>
        {legend.map((l, i) => (
          <span key={l}>
            <span className="mono" style={{ color: 'var(--accent-strong)', fontWeight: 700 }}>{i + 1}</span> {l}
          </span>
        ))}
      </div>
      <p className="small muted" style={{ textAlign: 'center', margin: '8px 0 0' }}>
        Simulated architecture, no live connection. Client target: S/4HANA 2025, clean core, side-by-side extension (SOW 19.16).
      </p>
    </div>
  );
}
