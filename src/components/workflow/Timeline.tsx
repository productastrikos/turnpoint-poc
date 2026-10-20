import type { ReactNode } from 'react';
import type { Tone } from '../../types';

export interface TimelineItem {
  at: string;
  title: ReactNode;
  sub?: ReactNode;
  tone?: Tone;
}

export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <ol className="timeline">
      {items.map((it, i) => (
        <li key={i} className={`tl-${it.tone ?? 'neutral'}`}>
          <span className="tl-dot" />
          <div className="tl-body">
            <div className="tl-title">{it.title}</div>
            {it.sub && <div className="tl-sub">{it.sub}</div>}
          </div>
          <span className="tl-at mono">{it.at}</span>
        </li>
      ))}
    </ol>
  );
}
