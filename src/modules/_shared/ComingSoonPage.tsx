import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';

export function ComingSoonPage({ title, note }: { title: string; note: string }) {
  return (
    <div>
      <PageHeader title={title} />
      <Card>
        <div className="empty-state">
          <div className="eyebrow" style={{ marginBottom: 8 }}>Planned — not built yet</div>
          <p style={{ maxWidth: 480, margin: '0 auto' }}>{note}</p>
        </div>
      </Card>
    </div>
  );
}
