export function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div className="card card-pad" style={style}>{children}</div>;
}

export function CardHeader({ title, action }: { title: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="card-header">
      <h3>{title}</h3>
      {action}
    </div>
  );
}
