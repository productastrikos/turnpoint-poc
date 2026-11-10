import { Chip } from '../../components/ui/Chip';
import type { ItpStatus, OwnerKind, PointType, PoRec } from '../../mocks/qaqcMock';
import type { AcceptanceStatus } from '../../services/qaqcService';
import type { Tone } from '../../types';

export const ITP_TONE: Record<ItpStatus, Tone> = { 'Not submitted': 'neutral', Submitted: 'accent', 'Under review': 'warn', Approved: 'good', Rejected: 'crit' };
export const ACCEPT_TONE: Record<AcceptanceStatus, Tone> = {
  Certified: 'good',
  'Blocked by NCR': 'crit',
  'Ready for certificate': 'accent',
  'Site inspection pending': 'warn',
  'Awaiting receipt': 'neutral',
  'In vendor inspection': 'accent',
  'Not started': 'neutral',
};
export const OWNER_CLASS: Record<OwnerKind, string> = { proc: 'qa-own-proc', vendor: 'qa-own-vendor', oq: 'qa-own-oq', insp: 'qa-own-insp', site: 'qa-own-site', plan: 'qa-own-plan' };
export const POINT_WORD: Record<PointType, string> = { H: 'Hold', W: 'Witness', R: 'Review', S: 'Surveillance' };

export function PointBadge({ type }: { type: PointType }) {
  return <span className={`pt-chip pt-${type}`} title={POINT_WORD[type]}>{type}</span>;
}

export function ItpChip({ p }: { p: PoRec }) {
  return <Chip tone={ITP_TONE[p.itpStatus]}>{p.itpStatus}{p.itpStatus !== 'Not submitted' ? ` · Rev ${p.itpRev}` : ''}</Chip>;
}

export const fmtDate = (iso?: string) => (iso ? iso.slice(0, 10) : '—');
export const fmtStamp = (iso: string) => iso.slice(5, 16).replace('T', ' ');
export const shortDate = (iso?: string) => {
  if (!iso) return '—';
  const m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${Number(iso.slice(8, 10))} ${m[Number(iso.slice(5, 7)) - 1]}`;
};
