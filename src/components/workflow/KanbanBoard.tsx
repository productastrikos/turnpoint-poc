export interface KanbanColumn<T> {
  key: string;
  title: string;
  items: T[];
}

export function KanbanBoard<T>({
  columns,
  renderCard,
}: {
  columns: KanbanColumn<T>[];
  renderCard: (item: T) => React.ReactNode;
}) {
  return (
    <div className="kanban" style={{ gridTemplateColumns: `repeat(${columns.length}, 1fr)` }}>
      {columns.map((col) => (
        <div className="kanban-col" key={col.key}>
          <h4>
            {col.title}
            <span className="mono">{col.items.length}</span>
          </h4>
          {col.items.length === 0 && <div style={{ fontSize: 12, color: 'var(--ink-3)', padding: '8px 2px' }}>No items</div>}
          {col.items.map((item, i) => (
            <div key={i}>{renderCard(item)}</div>
          ))}
        </div>
      ))}
    </div>
  );
}
