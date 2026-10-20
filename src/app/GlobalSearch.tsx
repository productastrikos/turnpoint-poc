import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { search, type SearchHit } from '../services/searchService';

export function GlobalSearch() {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const ref = useRef<HTMLInputElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      search(q).then((h) => {
        if (live) {
          setHits(h);
          setIdx(0);
        }
      });
    }, 120);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName);
      if ((e.key === '/' && !typing) || (e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        ref.current?.focus();
        setOpen(true);
      }
    };
    const onClick = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClick);
    };
  }, []);

  function go(h: SearchHit) {
    navigate(h.to);
    setOpen(false);
    setQ('');
    ref.current?.blur();
  }

  const groups = hits.reduce<Record<string, SearchHit[]>>((acc, h) => {
    (acc[h.kind] ??= []).push(h);
    return acc;
  }, {});
  let flat = -1;

  return (
    <div className="topbar-search" ref={wrap}>
      <input
        ref={ref}
        type="search"
        placeholder="Search  ( / )"
        aria-label="Global search"
        value={q}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') setIdx((i) => Math.min(hits.length - 1, i + 1));
          if (e.key === 'ArrowUp') setIdx((i) => Math.max(0, i - 1));
          if (e.key === 'Enter' && hits[idx]) go(hits[idx]);
          if (e.key === 'Escape') {
            setOpen(false);
            ref.current?.blur();
          }
        }}
      />
      {open && q.trim().length >= 2 && (
        <div className="search-pop">
          {hits.length === 0 && <div className="search-hit muted">No pages or records match “{q}”.</div>}
          {Object.entries(groups).map(([kind, list]) => (
            <div key={kind}>
              <div className="search-group">{kind}</div>
              {list.map((h) => {
                flat += 1;
                const mine = flat;
                return (
                  <div key={h.kind + h.title} className={`search-hit ${mine === idx ? 'active' : ''}`} onMouseEnter={() => setIdx(mine)} onClick={() => go(h)}>
                    <span>{h.title}</span>
                    <small>{h.sub}</small>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
