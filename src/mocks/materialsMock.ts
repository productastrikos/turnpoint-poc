import type { LeadTime, MaterialItem } from '../types';
import { ACTIVE_TA_ID } from './master';

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

// STO-2026 (active turnaround) MTO lines
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

// Other turnarounds in the 10-year plan, so every MTO line is tied to the event it is bought for.
// [taId, ...Row]. Job refs for future events are placeholders until their scope is frozen.
const otherRows: [string, ...Row][] = [
  // STO-2024 (completed minor TA, CDU/VDU): everything received
  ['STO-2024', 'MTO-101', 'Spiral wound gaskets, 10" 300#, set of 60', 3, 'delivered', '2024-02-20', 'Unit 200', 'J-2401', 60, 'EA', 5_400],
  ['STO-2024', 'MTO-102', 'E-201 tube bundle retube kit', 18, 'delivered', '2024-02-26', 'Unit 200', 'J-2402', 1, 'KIT', 96_000],
  ['STO-2024', 'MTO-103', 'VDU T-251 packing top-up (Mellapak 250Y)', 14, 'delivered', '2024-02-28', 'Unit 250', 'J-2403', 24, 'M3', 38_000],
  ['STO-2024', 'MTO-104', 'P-201 mechanical seals (API 682)', 12, 'delivered', '2024-02-22', 'Unit 200', 'J-2404', 4, 'EA', 21_500],
  ['STO-2024', 'MTO-105', 'Pressure relief valves, CDU overhead (8 off)', 16, 'delivered', '2024-02-25', 'Unit 200', 'J-2405', 8, 'EA', 44_000],
  ['STO-2024', 'MTO-106', 'Insulation and cladding, VDU transfer line (600 m2)', 6, 'delivered', '2024-02-29', 'Unit 250', 'J-2406', 600, 'M2', 13_800],
  // TA-2027 (planned minor TA, FCC & SRU): long leads already on order, the rest in the pipeline
  ['TA-2027', 'MTO-201', 'FCC main air blower K-301 rotor assembly (spare)', 34, 'po-issued', '2027-08-16', 'Unit 300', 'J-2701', 1, 'EA', 620_000],
  ['TA-2027', 'MTO-202', 'R-301 regenerator cyclone set (2-stage)', 31, 'po-issued', '2027-08-30', 'Unit 300', 'J-2702', 1, 'SET', 380_000],
  ['TA-2027', 'MTO-203', 'Claus reactor catalyst charge (T-221 / T-222)', 22, 'raised', '2027-09-06', 'Unit 220', 'J-2703', 80, 'MT', 150_000],
  ['TA-2027', 'MTO-204', 'FCC slide valve actuator and positioner kit', 20, 'raised', '2027-09-10', 'Unit 300', 'J-2704', 2, 'KIT', 72_000],
  ['TA-2027', 'MTO-205', 'SRU incinerator burner refractory (castable)', 12, 'not-raised', '2027-09-14', 'Unit 220', 'J-2705', 60, 'MT', 46_000],
  ['TA-2027', 'MTO-206', 'Process gaskets and stud bolt sets, FCC and SRU', 5, 'not-raised', '2027-09-20', 'Unit 300', 'J-2706', 2400, 'EA', 18_500],
  ['TA-2027', 'MTO-207', 'Scaffold tube and fittings top-up', 3, 'not-raised', '2027-09-22', 'Unit 300', 'J-2707', 1, 'LOT', 9_200],
  // STO-2028 (planned major STO, CDU / VDU / HCU)
  ['STO-2028', 'MTO-301', 'HCU reactor R-101 quench internals (replacement)', 40, 'raised', '2028-06-12', 'Unit 100', 'J-2801', 1, 'SET', 980_000],
  ['STO-2028', 'MTO-302', 'CDU heater F-201 convection tubes', 38, 'not-raised', '2028-06-26', 'Unit 200', 'J-2802', 1, 'SET', 740_000],
  ['STO-2028', 'MTO-303', 'VDU wash zone grid and distributor', 30, 'not-raised', '2028-07-10', 'Unit 250', 'J-2803', 1, 'SET', 410_000],
  ['STO-2028', 'MTO-304', 'HCU recycle gas compressor seal system', 27, 'not-raised', '2028-07-24', 'Unit 100', 'J-2804', 1, 'KIT', 285_000],
  ['STO-2028', 'MTO-305', 'Crude desalter internals and electrodes', 22, 'not-raised', '2028-07-31', 'Unit 200', 'J-2805', 1, 'SET', 168_000],
  ['STO-2028', 'MTO-306', 'Control valves, severe service (18 off)', 19, 'not-raised', '2028-08-07', 'Unit 100', 'J-2806', 18, 'EA', 224_000],
  ['STO-2028', 'MTO-307', 'Piping spools and fittings, CDU overhead', 10, 'not-raised', '2028-08-14', 'Unit 200', 'J-2807', 1, 'LOT', 61_000],
  // TA-2029 (planned catalyst change, HCU)
  ['TA-2029', 'MTO-401', 'Hydrocracking catalyst charge (HC-26)', 38, 'not-raised', '2029-01-12', 'Unit 100', 'J-2901', 125, 'MT', 1_380_000],
  ['TA-2029', 'MTO-402', 'Reactor inert ceramic balls and support media', 14, 'not-raised', '2029-02-20', 'Unit 100', 'J-2902', 18, 'MT', 74_000],
  ['TA-2029', 'MTO-403', 'Catalyst loading sock and bed thermocouples', 8, 'not-raised', '2029-03-05', 'Unit 100', 'J-2903', 1, 'LOT', 33_000],
];

const toItem = (taId: string, r: Row): MaterialItem => ({
  id: r[0],
  taId,
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
});

export const materialItems: MaterialItem[] = [
  ...rows.map((r) => toItem(ACTIVE_TA_ID, r)),
  ...otherRows.map(([taId, ...r]) => toItem(taId, r as Row)),
];
