// Simulated condition-monitoring readings and prior work history per equipment tag. Stands in for the plant
// historian / vibration system, the inspection database (thickness readings) and SAP PM order history, which the
// AI duration check reads in production. Tags are in canonical form (R-101 -> R101).

export interface AssetSignals {
  tag: string;
  label: string;
  /** Rotating equipment: overall vibration velocity, mm/s RMS (ISO 10816 class II zones B/C/D at about 2.8 / 4.5 / 7.1). */
  vibrationMmS?: number;
  /** Static equipment: wall lost against nominal, % (latest UT survey). */
  wallLossPct?: number;
  corrosionRateMmY?: number;
  /** Exchangers and heaters: pressure-drop rise over the clean case, %. */
  foulingDpPct?: number;
  /** Open inspection findings against the asset. */
  openFindings: number;
  /** Where the reading comes from. 'class-average' = no tag-level data, so the model falls back to the asset class. */
  source: 'tag-data' | 'class-average';
  sourceNote: string;
}

type SignalRow = Omit<AssetSignals, 'tag' | 'label' | 'source'>;

const TAG_DATA: Record<string, SignalRow & { label: string }> = {
  P205: { label: 'P-205', vibrationMmS: 5.6, openFindings: 1, sourceNote: 'Vibration system, 30-day trend, drive-end bearing' },
  P305: { label: 'P-305', vibrationMmS: 4.1, openFindings: 1, sourceNote: 'Vibration system, 30-day trend' },
  P201: { label: 'P-201', vibrationMmS: 2.2, openFindings: 0, sourceNote: 'Vibration system, 30-day trend' },
  K301: { label: 'K-301', vibrationMmS: 6.2, openFindings: 2, sourceNote: 'Bently Nevada proximity probes, 30-day trend' },
  C301: { label: 'C-301', vibrationMmS: 5.4, openFindings: 1, sourceNote: 'Bently Nevada proximity probes, 30-day trend' },
  R101: { label: 'R-101', wallLossPct: 15, corrosionRateMmY: 0.42, openFindings: 2, sourceNote: 'UT thickness survey, outlet nozzle and shell course 2' },
  T201: { label: 'T-201', wallLossPct: 21, corrosionRateMmY: 0.31, openFindings: 3, sourceNote: 'UT thickness survey; CUI found on overhead line' },
  V102: { label: 'V-102', wallLossPct: 14, corrosionRateMmY: 0.18, openFindings: 1, sourceNote: 'UT thickness survey, nozzle band' },
  E204: { label: 'E-204', foulingDpPct: 40, wallLossPct: 9, corrosionRateMmY: 0.12, openFindings: 1, sourceNote: 'Process historian: shell-side dP vs clean case, 90 days' },
  F101: { label: 'F-101', foulingDpPct: 38, wallLossPct: 12, corrosionRateMmY: 0.2, openFindings: 2, sourceNote: 'Process historian: tube-skin and pass dP trend' },
  QC2201: { label: 'QC-2201', openFindings: 0, sourceNote: 'Loop check history, no drift reported' },
  PV3021: { label: 'PV-3021', openFindings: 0, sourceNote: 'Valve signature test, last campaign' },
};

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}

/** Readings for a tag. Unknown tags get a mild, deterministic class-average profile and are flagged as such. */
export function signalsFor(canonicalTag: string, label: string, cls: string): AssetSignals {
  const known = TAG_DATA[canonicalTag];
  if (known) return { tag: canonicalTag, source: 'tag-data', ...known };
  const u = hash(canonicalTag);
  const rotating = cls === 'Pump' || cls === 'Compressor';
  const staticEq = ['Reactor', 'Column', 'Vessel', 'Piping', 'Exchanger', 'Heater'].includes(cls);
  return {
    tag: canonicalTag,
    label: label || canonicalTag,
    vibrationMmS: rotating ? Math.round((1.6 + u * 1.8) * 10) / 10 : undefined,
    wallLossPct: staticEq ? Math.round(3 + u * 8) : undefined,
    foulingDpPct: cls === 'Exchanger' || cls === 'Heater' ? Math.round(8 + u * 14) : undefined,
    openFindings: u > 0.8 ? 1 : 0,
    source: 'class-average',
    sourceNote: 'No tag-level data loaded, so the asset-class average is used',
  };
}

export interface TagHistory {
  tag: string;
  event: string;
  work: string;
  plannedHours: number;
  actualHours: number;
  note: string;
}

/** Previous turnaround and shutdown jobs on the same equipment (SAP PM order history, planned vs actual confirmations). */
export const TAG_HISTORY: TagHistory[] = [
  { tag: 'P205', event: 'STO-2024', work: 'Mechanical seal and bearing change', plannedHours: 8, actualHours: 12.5, note: 'Seal housing scored, re-machined on site' },
  { tag: 'P205', event: 'Shutdown 2022', work: 'Coupling alignment', plannedHours: 4, actualHours: 5.5, note: 'Soft foot found' },
  { tag: 'K301', event: 'STO-2021', work: 'Rotor removal and bearing inspection', plannedHours: 36, actualHours: 58, note: 'Bearing babbitt damage, spare fitted' },
  { tag: 'C301', event: 'STO-2021', work: 'Lube-oil console flushing', plannedHours: 10, actualHours: 15, note: 'Second flush needed, particle count' },
  { tag: 'R101', event: 'STO-2021', work: 'Outlet nozzle weld repair', plannedHours: 14, actualHours: 26, note: 'Wall thinning wider than UT mapped, extra preheat cycles' },
  { tag: 'R101', event: 'STO-2021', work: 'Internal inspection', plannedHours: 30, actualHours: 34, note: '' },
  { tag: 'E204', event: 'STO-2024', work: 'Bundle pull and hydro-jetting', plannedHours: 10, actualHours: 16.5, note: 'Hard deposit, two blasting passes' },
  { tag: 'T201', event: 'STO-2024', work: 'Tray inspection and repair', plannedHours: 40, actualHours: 52, note: 'Corroded tray supports found' },
  { tag: 'F101', event: 'STO-2021', work: 'Tube decoking', plannedHours: 24, actualHours: 33, note: 'Steam-air decoke repeated on pass 3' },
  { tag: 'QC2201', event: 'STO-2024', work: 'Loop recalibration', plannedHours: 4, actualHours: 3.5, note: '' },
];
