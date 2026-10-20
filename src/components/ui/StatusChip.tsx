import type { Tone } from '../../types';
import { Chip } from './Chip';

const GOOD = /(approved|complete|completed|closed|done|passed|pass|ready|installed|signed|verified|on-track|on track|accepted|received|delivered|issued|released|resolved|synced|connected|merged|cleared|handed|certified|valid|in stock|good|met|healthy|mitigated|de-blinded|removed|normal|dismantled)/i;
const BAD = /(reject|fail|overdue|delayed|blocked|critical|late|expired|breach|error|stopped|missed|stock-out|over budget|violation|disconnected|restricted)/i;
const WARN = /(pending|at-risk|at risk|watch|partial|transit|review|hold|retry|retrying|awaiting|evaluating|expedite|conditional|requested|warning|shortfall|due|rework|in repair|waiting|queued|draft)/i;
const ACCENT = /(progress|active|started|running|in use|ongoing|mitigating|submitted|raised|identified|erected|fabricat|scheduled|planned)/i;

export function toneForStatus(status: string): Tone {
  if (BAD.test(status)) return 'crit';
  if (WARN.test(status)) return 'warn';
  if (GOOD.test(status)) return 'good';
  if (ACCENT.test(status)) return 'accent';
  return 'neutral';
}

export function StatusChip({ status, tone, label }: { status: string; tone?: Tone; label?: string }) {
  return <Chip tone={tone ?? toneForStatus(status)}>{label ?? status.replace(/-/g, ' ')}</Chip>;
}
