import { useMemo, useState, type ReactNode } from 'react';
import { EmptyState } from './EmptyState';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  /** Value used for sorting (defaults to row[key]). */
  sortValue?: (row: T) => string | number;
  align?: 'left' | 'right' | 'center';
  width?: number | string;
  mono?: boolean;
  nosort?: boolean;
}

interface Props<T> {
  columns: readonly Column<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  activeKey?: string | null;
  pageSize?: number;
  initialSort?: { key: string; dir: 'asc' | 'desc' };
  emptyText?: string;
  dense?: boolean;
  caption?: string;
}

export function DataTable<T>({ columns, rows, rowKey, onRowClick, activeKey, pageSize = 0, initialSort, emptyText, dense, caption }: Props<T>) {
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(initialSort ?? null);
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return rows;
    const val = (r: T): string | number => {
      if (col.sortValue) return col.sortValue(r);
      const v = (r as Record<string, unknown>)[col.key];
      return typeof v === 'number' ? v : String(v ?? '');
    };
    const out = [...rows].sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      if (typeof va === 'number' && typeof vb === 'number') return va - vb;
      return String(va).localeCompare(String(vb), undefined, { numeric: true });
    });
    return sort.dir === 'desc' ? out.reverse() : out;
  }, [rows, sort, columns]);

  const pages = pageSize > 0 ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  const safePage = Math.min(page, pages - 1);
  const visible = pageSize > 0 ? sorted.slice(safePage * pageSize, safePage * pageSize + pageSize) : sorted;

  function toggle(c: Column<T>) {
    if (c.nosort) return;
    setPage(0);
    setSort((s) => (s && s.key === c.key ? (s.dir === 'asc' ? { key: c.key, dir: 'desc' } : null) : { key: c.key, dir: 'asc' }));
  }

  return (
    <div className="dt-wrap">
      <div className="dt-scroll">
        <table className={`table dt ${dense ? 'dt-dense' : ''}`}>
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  style={{ width: c.width, textAlign: c.align }}
                  className={c.nosort ? '' : 'sortable'}
                  onClick={() => toggle(c)}
                  tabIndex={c.nosort ? undefined : 0}
                  onKeyDown={c.nosort ? undefined : (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), toggle(c))}
                  aria-sort={sort?.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  {c.header}
                  {sort?.key === c.key && <span className="sort-ind">{sort.dir === 'asc' ? ' ▲' : ' ▼'}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const k = rowKey(r);
              return (
                <tr
                  key={k}
                  className={`${onRowClick ? 'clickable' : ''} ${activeKey === k ? 'row-active' : ''}`}
                  onClick={onRowClick ? () => onRowClick(r) : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onKeyDown={onRowClick ? (e) => e.key === 'Enter' && e.target === e.currentTarget && onRowClick(r) : undefined}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={c.mono ? 'mono' : ''} style={{ textAlign: c.align }}>
                      {c.render ? c.render(r) : String((r as Record<string, unknown>)[c.key] ?? '')}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {visible.length === 0 && <EmptyState title={emptyText ?? 'No records match'} hint="Adjust the filters or add a new record." />}
      {pageSize > 0 && sorted.length > pageSize && (
        <div className="dt-pager">
          <span className="mono">
            {safePage * pageSize + 1}–{Math.min(sorted.length, safePage * pageSize + pageSize)} of {sorted.length}
          </span>
          <button className="btn btn-sm" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>Prev</button>
          <button className="btn btn-sm" disabled={safePage >= pages - 1} onClick={() => setPage(safePage + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}
