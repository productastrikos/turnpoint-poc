import type { LeadTime, MaterialItem } from '../types';

/** P1 thresholds: Long > 6 months, Medium 4-6 months, Short < 4 months of delivery time after PO award. */
export const WEEKS_PER_MONTH = 4.345;
export function classifyLead(weeks: number): LeadTime {
  const months = weeks / WEEKS_PER_MONTH;
  if (months > 6) return 'long';
  if (months >= 4) return 'medium';
  return 'short';
}

// [id, description, weeks, prStatus, requiredBy, area, jobId, qty, uom, estCostOMR]
type Row = [string, string, number, MaterialItem['prStatus'], string, string, string, number, string, number];

const rows: Row[] = [
  ['MTO-001', 'Spiral wound gaskets, 8" 300#, set of 40', 3, 'delivered', '2026-08-18', 'Unit 200', 'J-2210', 40, 'EA', 3_200],
  ['MTO-002', 'Reactor internals tray set — R-101', 30, 'po-issued', '2026-08-20', 'Unit 100', 'J-2201', 1, 'SET', 412_000],
  ['MTO-003', 'Compressor rotor bearing kit — C-301', 22, 'po-issued', '2026-08-21', 'Unit 300', 'J-2203', 1, 'KIT', 96_000],
  ['MTO-004', 'E-204 tube bundle (40 tubes)', 19, 'raised', '2026-08-22', 'Unit 200', 'J-2202', 40, 'EA', 118_000],
  ['MTO-005', 'Instrument loop transmitters (QC-2201)', 6, 'delivered', '2026-08-19', 'Unit 220', 'J-2204', 12, 'EA', 21_600],
  ['MTO-006', 'Catalyst support grid — replacement', 28, 'po-issued', '2026-08-23', 'Unit 100', 'J-2209', 1, 'SET', 184_000],
  ['MTO-007', 'Cable tray sections — Unit 300', 4, 'not-raised', '2026-08-25', 'Unit 300', 'J-2206', 180, 'M', 9_400],
  ['MTO-008', 'Relief valve — flare header spare', 16, 'raised', '2026-08-24', 'Flare System', 'J-2219', 6, 'EA', 38_400],
  ['MTO-009', 'Hydrocracking catalyst charge (HC-24)', 36, 'po-issued', '2026-08-26', 'Unit 100', 'J-2209', 118, 'MT', 1_240_000],
  ['MTO-010', 'F-101 low-NOx burners (12 off)', 27, 'raised', '2026-08-28', 'Unit 100', 'J-2232', 12, 'EA', 164_000],
  ['MTO-011', 'T-201 valve trays (Section B, 24 trays)', 21, 'po-issued', '2026-08-18', 'Unit 200', 'J-2213', 24, 'EA', 86_000],
  ['MTO-012', 'T-251 structured packing (Mellapak 250Y)', 24, 'po-issued', '2026-08-20', 'Unit 250', 'J-2218', 96, 'M3', 142_000],
  ['MTO-013', 'Claus reactor catalyst (activated alumina)', 14, 'delivered', '2026-08-19', 'Unit 220', 'J-2217', 42, 'MT', 78_000],
  ['MTO-014', 'K-301 main air blower rotor seal kit', 18, 'po-issued', '2026-08-21', 'Unit 300', 'J-2215', 1, 'KIT', 52_000],
  ['MTO-015', 'Refractory — R-301 regenerator (castable)', 12, 'delivered', '2026-08-17', 'Unit 300', 'J-2216', 85, 'MT', 61_000],
  ['MTO-016', 'Pipe supports, Grade 316 (40 off)', 8, 'delivered', '2026-08-18', 'Pipe Rack 4', 'J-2223', 40, 'EA', 14_800],
  ['MTO-017', 'Insulation — mineral wool + cladding (2,400 m²)', 7, 'delivered', '2026-08-15', 'Unit 200', 'J-2224', 2400, 'M2', 52_000],
  ['MTO-018', 'Control valve trim sets (32 CVs)', 20, 'po-issued', '2026-08-18', 'Unit 100', 'J-2220', 32, 'SET', 74_000],
  ['MTO-019', 'DCS I/O cards (AI/AO/DI/DO)', 15, 'raised', '2026-08-22', 'Unit 100', 'J-2225', 96, 'EA', 38_000],
  ['MTO-020', 'Piping spools 14"-P-2201 (prefab, CS A106)', 9, 'delivered', '2026-08-17', 'Unit 200', 'J-2210', 14, 'EA', 23_600],
  ['MTO-021', 'Motor protection relays (MCC-3)', 10, 'delivered', '2026-08-16', 'Unit 300', 'J-2222', 18, 'EA', 19_800],
  ['MTO-022', 'P-205 mechanical seals (API 682)', 13, 'delivered', '2026-08-16', 'Unit 200', 'J-2214', 4, 'EA', 22_400],
  ['MTO-023', 'Stud bolt & nut sets (B7/2H) — assorted', 5, 'delivered', '2026-08-15', 'Unit 200', 'J-2202', 1800, 'EA', 11_200],
  ['MTO-024', 'R-101 outlet nozzle overlay consumables (Inconel 625)', 11, 'not-raised', '2026-08-30', 'Unit 100', 'J-2230', 1, 'LOT', 17_500],
  ['MTO-025', 'Burner management system modules (spare)', 29, 'not-raised', '2026-09-02', 'Unit 100', 'J-2232', 2, 'EA', 48_000],
  ['MTO-026', 'Platform grating & handrail (Unit 220)', 3, 'not-raised', '2026-08-26', 'Unit 220', 'J-2226', 220, 'M2', 8_600],
];

export const materialItems: MaterialItem[] = rows.map((r) => ({
  id: r[0],
  description: r[1],
  leadWeeks: r[2],
  leadTime: classifyLead(r[2]),
  prStatus: r[3],
  requiredBy: r[4],
  area: r[5],
  jobId: r[6],
  qty: r[7],
  uom: r[8],
  estCostOMR: r[9],
}));
