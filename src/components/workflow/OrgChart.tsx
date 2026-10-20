import { useEffect, useRef, useState } from 'react';

export interface OrgNode {
  role: string;
  name: string;
  org?: string;
  tone?: 'oq' | 'contractor' | 'neutral';
  children?: OrgNode[];
}

function Node({ n }: { n: OrgNode }) {
  return (
    <li>
      <div className={`org-card org-${n.tone ?? 'neutral'}`}>
        <div className="org-role">{n.role}</div>
        <div className="org-name">{n.name}</div>
        {n.org && <div className="org-org">{n.org}</div>}
      </div>
      {n.children && n.children.length > 0 && (
        <ul>
          {n.children.map((c) => (
            <Node key={c.role + c.name} n={c} />
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * Organogram. A wide tree is shrunk (down to 72%) to fit its card; if it is still wider it scrolls,
 * starting centred on the root so the top of the chart is always on screen.
 */
export function OrgChart({ root }: { root: OrgNode }) {
  const box = useRef<HTMLDivElement>(null);
  const tree = useRef<HTMLUListElement>(null);
  const [scrolls, setScrolls] = useState(false);

  useEffect(() => {
    const el = box.current;
    const t = tree.current;
    if (!el || !t) return;
    const fit = () => {
      t.style.zoom = '1';
      const natural = t.scrollWidth;
      const scale = natural > el.clientWidth ? Math.max(0.72, el.clientWidth / natural) : 1;
      t.style.zoom = String(scale);
      el.scrollLeft = Math.max(0, (el.scrollWidth - el.clientWidth) / 2);
      setScrolls(el.scrollWidth > el.clientWidth + 2);
    };
    fit();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [root]);

  return (
    <>
      <div className="org-scroll" ref={box}>
        <ul className="org-tree" ref={tree}>
          <Node n={root} />
        </ul>
      </div>
      {scrolls && <div className="small muted" style={{ marginTop: 6 }}>Scroll sideways to see the whole organogram.</div>}
    </>
  );
}
