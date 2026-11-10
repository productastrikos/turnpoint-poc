import { Chip } from '../../components/ui/Chip';
import type { ScopePhase } from './useScope';

/** Which side of the freeze an item or variation sits on. */
export function PhaseChip({ phase }: { phase: ScopePhase }) {
  if (phase === 'Post-freeze') return <span title="Entered the scope after the freeze, through an approved variation"><Chip tone="warn">Post-freeze</Chip></span>;
  if (phase === 'Baseline') return <span title="Approved before the freeze and part of the frozen baseline (certificate Rev A)"><Chip tone="accent">Pre-freeze · baseline</Chip></span>;
  return <span title="The scope is still open: nothing is frozen yet"><Chip tone="neutral">Pre-freeze</Chip></span>;
}
