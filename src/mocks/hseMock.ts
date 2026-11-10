// Contractor daily HSE entries (PBC 03 #9, "Contractor KPI digitization"): toolbox talk, housekeeping inspection,
// permit-to-work compliance, PPE compliance and HSE observations. Entered by each contractor's supervisor in the mobile app.
// SIMULATED, deterministic seed for TA days 1 to 14 (Day 14 = 16 Aug 2026, the status date).
import { CONTRACTOR_NAMES } from './master';
import { rng, int, pick } from './_gen';

export const HSE_ELAPSED_DAYS = 14;

export interface TbtEntry {
  topic: string;
  hazards: string[];
  controls: string[];
  attendees: number;
  expected: number;
  time: string;
  signSheetPhoto: boolean;
  signedBy: string;
}
export interface HkEntry {
  checks: boolean[];
  score: number; // 0..100
  inspector: string;
}
export interface PermitEntry {
  checked: number;
  nonCompliant: number;
}
export interface PpeEntry {
  sampled: number;
  nonCompliant: number;
}
export interface ObsEntry {
  raised: number;
  closed: number;
}
export type HseSource = 'seed' | 'mobile' | 'simulated';

export interface HseDay {
  id: string; // `${contractor}|${day}`
  contractor: string;
  day: number;
  tbt?: TbtEntry;
  hk?: HkEntry;
  permit?: PermitEntry;
  ppe?: PpeEntry;
  obs?: ObsEntry;
  lastBy?: string;
  lastAt?: string; // scenario ISO timestamp
  lastSource?: HseSource;
}

export const TBT_TOPICS: { topic: string; hazards: string[]; controls: string[] }[] = [
  { topic: 'Working at height', hazards: ['Fall from scaffold', 'Dropped objects', 'Unprotected edges'], controls: ['Full-body harness, 100% tie-off', 'Scaffold tag green and checked', 'Tool lanyards and toe boards'] },
  { topic: 'Hot work and fire watch', hazards: ['Sparks reaching hydrocarbons', 'Flammable gas in the area', 'Burns'], controls: ['Gas test before and during work', 'Fire watch with extinguisher', 'Fire blankets on open drains'] },
  { topic: 'Confined space entry', hazards: ['Oxygen deficiency', 'Toxic gas (H2S)', 'Difficult rescue'], controls: ['Continuous gas monitoring', 'Standby man at the entry', 'Rescue plan and tripod in place'] },
  { topic: 'Lifting and rigging', hazards: ['Dropped load', 'Line of fire', 'Overloaded sling'], controls: ['Lift plan and certified slings', 'Exclusion zone barricaded', 'Banksman with radio'] },
  { topic: 'Hand and finger injuries', hazards: ['Pinch points on flanges', 'Cuts from sharp edges', 'Hammer strikes'], controls: ['Right gloves for the task', 'Hands-off-the-flange rule', 'Tools in good condition'] },
  { topic: 'Heat stress and hydration', hazards: ['Heat exhaustion', 'Dehydration', 'Long shifts in direct sun'], controls: ['Water points every 50 m', 'Rest breaks in shade', 'Buddy check every hour'] },
  { topic: 'Isolation and LOTO', hazards: ['Release of stored energy', 'Wrong valve operated', 'Isolation removed early'], controls: ['Personal lock on every isolation', 'Zero-energy verification', 'Isolation walkdown with operations'] },
  { topic: 'Housekeeping and slips', hazards: ['Trailing hoses and cables', 'Oil on walkways', 'Waste in work area'], controls: ['Cables off the floor', 'Spill kit at hand', 'Clean-as-you-go at shift end'] },
];

export const HK_ITEMS = [
  'Walkways and access routes clear',
  'Waste segregated, bins emptied',
  'Tools and materials stored off the ground',
  'Hoses and cables elevated or covered',
  'Gas cylinders secured and capped',
  'Fire extinguishers and spill kits accessible',
];

interface Profile {
  expected: number;
  missed: number[]; // days without a toolbox talk
  hkBase: number;
  hkMissed: number[]; // days without a housekeeping inspection
  permitsPerDay: number;
  permitNon: number; // per 100 permits
  ppeNon: number; // per 100 workers sampled
  obsRaise: number; // average raised per day x10
  obsCloseRate: number; // fraction closed
  pendingToday: boolean; // the supervisor has not entered Day 14 yet
  supervisor: string;
}

const PROFILES: Record<string, Profile> = {
  Galfar: { expected: 420, missed: [4, 9, 11], hkBase: 84, hkMissed: [4], permitsPerDay: 24, permitNon: 7, ppeNon: 6, obsRaise: 18, obsCloseRate: 0.86, pendingToday: true, supervisor: 'Galfar site supervisor' },
  'Larsen & Toubro': { expected: 226, missed: [6], hkBase: 89, hkMissed: [], permitsPerDay: 14, permitNon: 4, ppeNon: 3, obsRaise: 12, obsCloseRate: 0.9, pendingToday: false, supervisor: 'L&T site supervisor' },
  'Petrofac Services': { expected: 90, missed: [], hkBase: 95, hkMissed: [], permitsPerDay: 7, permitNon: 1, ppeNon: 1, obsRaise: 6, obsCloseRate: 0.97, pendingToday: false, supervisor: 'Petrofac site supervisor' },
  'Zubair E&M': { expected: 150, missed: [2, 12], hkBase: 87, hkMissed: [7], permitsPerDay: 11, permitNon: 3, ppeNon: 3, obsRaise: 9, obsCloseRate: 0.92, pendingToday: false, supervisor: 'Zubair site supervisor' },
  'Sohar Industrial Services': { expected: 210, missed: [3, 5, 8, 12, 13], hkBase: 78, hkMissed: [5, 13], permitsPerDay: 13, permitNon: 9, ppeNon: 9, obsRaise: 14, obsCloseRate: 0.72, pendingToday: true, supervisor: 'SIS site supervisor' },
};

export const hseProfile = (contractor: string) => PROFILES[contractor];
export const hseContractors = CONTRACTOR_NAMES;

function buildSeed(): HseDay[] {
  const out: HseDay[] = [];
  CONTRACTOR_NAMES.forEach((c, ci) => {
    const p = PROFILES[c];
    const r = rng(7100 + ci * 31);
    for (let day = 1; day <= HSE_ELAPSED_DAYS; day++) {
      const pending = day === HSE_ELAPSED_DAYS && p.pendingToday;
      const rec: HseDay = { id: `${c}|${day}`, contractor: c, day };
      if (!pending) {
        const date = `2026-08-${String(2 + day).padStart(2, '0')}`;
        rec.lastBy = p.supervisor;
        rec.lastAt = `${date}T${pick(r, ['17:05', '17:20', '17:42', '18:10'])}:00`;
        rec.lastSource = 'mobile';
        if (!p.missed.includes(day)) {
          const t = TBT_TOPICS[(day + ci * 3) % TBT_TOPICS.length];
          rec.tbt = {
            topic: t.topic,
            hazards: t.hazards.slice(0, 2),
            controls: t.controls.slice(0, 2),
            expected: p.expected,
            attendees: Math.round(p.expected * (0.88 + r() * 0.11)),
            time: pick(r, ['06:00', '06:15', '06:30', '06:45']),
            signSheetPhoto: true,
            signedBy: p.supervisor,
          };
        }
        if (!p.hkMissed.includes(day)) {
          const checks = HK_ITEMS.map(() => r() > (100 - p.hkBase) / 60);
          const score = Math.round(Math.min(100, Math.max(40, p.hkBase + int(r, -6, 7))));
          rec.hk = { checks, score, inspector: p.supervisor };
        }
        const checked = Math.max(2, Math.round(p.permitsPerDay * (0.8 + r() * 0.4)));
        rec.permit = { checked, nonCompliant: Math.round((checked * p.permitNon) / 100 + (r() > 0.7 ? 1 : 0)) };
        const sampled = int(r, 30, 60);
        rec.ppe = { sampled, nonCompliant: Math.round((sampled * p.ppeNon) / 100 + (r() > 0.75 ? 1 : 0)) };
        const raised = Math.max(0, Math.round(p.obsRaise / 10 + (r() - 0.5) * 2));
        rec.obs = { raised, closed: Math.round(raised * (p.obsCloseRate + (r() - 0.5) * 0.2)) };
      }
      out.push(rec);
    }
  });
  return out;
}

export const hseSeed: HseDay[] = buildSeed();
