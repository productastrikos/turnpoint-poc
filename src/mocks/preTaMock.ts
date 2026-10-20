// Seed rows for the eleven Pre-TA trackers (R1, R2, R5-R13). Seeded, so numbers are stable. Tags and areas match the shared master data.
import { CONTRACTORS, KEY_EQUIPMENT, PEOPLE } from './master';
import { chance, float, int, pad, pick, rng, type Rng } from './_gen';

export type PreTaSlug = 'scaffold' | 'isolation' | 'insulation' | 'weld' | 'rigging' | 'tools' | 'bagging-tagging' | 'heavy-equipment' | 'prefab' | 'waste' | 'equipment-inspection';

export interface PreTaRow {
  id: string;
  slug: PreTaSlug;
  ref: string;
  title: string;
  area: string;
  contractor: string;
  stage: number; // index into the tracker's stage list
  plannedDay: number; // TA day the stage-completion is planned for
  owner: string;
  metrics: Record<string, number | string>;
}

const contractor = (r: Rng, ...pool: string[]) => pick(r, pool.length ? pool : CONTRACTORS.map((c) => c.name));
const equip = (r: Rng) => pick(r, KEY_EQUIPMENT);
const stageFor = (r: Rng, n: number, bias: number) => Math.min(n - 1, Math.max(0, Math.round(bias * (n - 1) + (r() - 0.5) * 2)));

function make(slug: PreTaSlug, i: number, p: Omit<PreTaRow, 'id' | 'slug'>): PreTaRow {
  return { id: `${slug.slice(0, 3).toUpperCase()}-${pad(i + 1)}`, slug, ...p };
}

// ---------- R1 scaffold: stages Requested, Erected, Inspected & tagged, In use, Dismantled
function scaffold(): PreTaRow[] {
  const r = rng(101);
  return Array.from({ length: 38 }, (_, i) => {
    const e = equip(r);
    const type = pick(r, ['Tube and clamp', 'System scaffold', 'Hanging scaffold', 'Mobile tower']);
    const h = int(r, 3, 38);
    const stage = stageFor(r, 5, 0.55);
    return make('scaffold', i, {
      ref: `SC-${2100 + i}`,
      title: `${type} · ${e.tag} ${e.desc}`,
      area: e.area,
      contractor: 'Sohar Industrial Services',
      stage,
      plannedDay: int(r, 1, 28),
      owner: PEOPLE.planner,
      metrics: { type, height: h, volume: Math.round(h * int(r, 12, 60)), tag: stage >= 2 ? 'Green' : stage === 1 ? 'Red (not inspected)' : '—', load: pick(r, ['Light duty', 'General', 'Heavy duty']) },
    });
  });
}

// ---------- R2 isolation: Planned, Points identified, Isolated and locked, Verified zero energy, De-isolated
function isolation(): PreTaRow[] {
  const r = rng(202);
  return Array.from({ length: 34 }, (_, i) => {
    const e = equip(r);
    const kind = pick(r, ['Blind / spade', 'Valve lock-out', 'Electrical LOTO', 'Double block and bleed']);
    return make('isolation', i, {
      ref: `ISO-${3300 + i}`,
      title: `${kind} · ${e.tag} ${e.desc}`,
      area: e.area,
      contractor: contractor(r, 'Galfar', 'Zubair E&M'),
      stage: stageFor(r, 5, 0.6),
      plannedDay: int(r, 1, 26),
      owner: pick(r, [PEOPLE.process, PEOPLE.electrical, PEOPLE.instr]),
      metrics: { kind, points: int(r, 2, 14), permit: `PTW-${5000 + int(r, 100, 900)}`, certificate: `IC-${7000 + i}` },
    });
  });
}

// ---------- R5 insulation: Planned, Removal in progress, Removed, Reinstalling, Complete
function insulation(): PreTaRow[] {
  const r = rng(505);
  return Array.from({ length: 30 }, (_, i) => {
    const e = equip(r);
    const total = int(r, 40, 520);
    const stage = stageFor(r, 5, 0.5);
    const removed = stage >= 2 ? total : stage === 1 ? Math.round(total * float(r, 0.2, 0.8)) : 0;
    const back = stage === 4 ? total : stage === 3 ? Math.round(total * float(r, 0.2, 0.8)) : 0;
    return make('insulation', i, {
      ref: `INS-${4100 + i}`,
      title: `${pick(r, ['Hot service', 'Cold service', 'Personnel protection', 'Acoustic'])} insulation · ${e.tag}`,
      area: e.area,
      contractor: 'Sohar Industrial Services',
      stage,
      plannedDay: int(r, 4, 28),
      owner: PEOPLE.planner,
      metrics: { total, removed, reinstalled: back, asbestos: chance(r, 0.08) ? 'Sample pending' : 'Clear' },
    });
  });
}

// ---------- R6 weld: Planned, Fit-up, Welded, NDT done, Accepted
function weld(): PreTaRow[] {
  const r = rng(606);
  return Array.from({ length: 32 }, (_, i) => {
    const e = equip(r);
    const stage = stageFor(r, 5, 0.5);
    const joints = int(r, 6, 64);
    const welded = stage >= 2 ? joints : stage === 1 ? Math.round(joints * float(r, 0.3, 0.9)) : 0;
    const ndt = stage >= 3 ? welded : stage === 2 ? Math.round(welded * float(r, 0, 0.6)) : 0;
    const repairs = ndt > 0 ? Math.round(ndt * float(r, 0, 0.09)) : 0;
    return make('weld', i, {
      ref: `WLD-${6100 + i}`,
      title: `${pick(r, ['Tie-in', 'Spool installation', 'Nozzle repair', 'Support attachment', 'Pipe replacement'])} · ${e.tag} ${e.desc}`,
      area: e.area,
      contractor: contractor(r, 'Galfar', 'Larsen & Toubro'),
      stage,
      plannedDay: int(r, 5, 27),
      owner: PEOPLE.inspection,
      metrics: { wps: `WPS-${pick(r, ['CS-01', 'CS-04', 'SS-02', 'P91-01', 'CR-05'])}`, joints, welded, ndtPassed: ndt - repairs, repairs },
    });
  });
}

// ---------- R7 rigging & lift: Plan drafted, Plan approved, Crane mobilised, Lift complete
function rigging(): PreTaRow[] {
  const r = rng(707);
  const lifts = [
    ['E-204 tube bundle pull', 'Unit 200', 42, '250 t crawler', 'Critical lift'],
    ['C-301 rotor removal', 'Unit 300', 18, '80 t mobile', 'Critical lift'],
    ['R-101 reactor head removal', 'Unit 100', 56, '250 t crawler', 'Critical lift'],
    ['T-201 tray sections to grade', 'Unit 200', 4, '50 t mobile', 'Ordinary lift'],
    ['P-205 pump casing', 'Unit 200', 3, '50 t mobile', 'Ordinary lift'],
    ['F-101 burner assemblies (12)', 'Unit 100', 2, '50 t mobile', 'Ordinary lift'],
    ['K-301 blower rotor', 'Unit 300', 22, '80 t mobile', 'Critical lift'],
    ['T-251 packing baskets', 'Unit 250', 6, '80 t mobile', 'Ordinary lift'],
    ['FL-401 spool, 14 inch', 'Flare System', 5, '50 t mobile', 'Ordinary lift'],
    ['Catalyst drums to R-101 platform', 'Unit 100', 3, '80 t mobile', 'Ordinary lift'],
  ];
  return Array.from({ length: 26 }, (_, i) => {
    const l = lifts[i % lifts.length];
    return make('rigging', i, {
      ref: `LP-${8100 + i}`,
      title: `${l[0]}${i >= lifts.length ? ` (${i < 20 ? 'second' : 'third'} lift)` : ''}`,
      area: l[1] as string,
      contractor: 'Galfar',
      stage: stageFor(r, 4, 0.5),
      plannedDay: int(r, 3, 27),
      owner: PEOPLE.rotating,
      metrics: { load: l[2] as number, crane: l[3] as string, radius: int(r, 8, 36), class: l[4] as string, rigger: pick(r, ['Level 3 rigger', 'Appointed person']) },
    });
  });
}

// ---------- R8 tools: Requested, Available, Issued, Returned
function tools(): PreTaRow[] {
  const r = rng(808);
  const list = ['Hydraulic torque wrench 3000 Nm', 'Bolt tensioner set M48', 'Hydrotest pump 1000 bar', 'Laser alignment kit', 'Portable hardness tester', 'ECT tube probe set', 'Pneumatic grinder', 'Welding machine 400 A', 'Gas detector 4-gas', 'Magnetic drill', 'Pipe bevelling machine', 'Pull-lift 3 t', 'Torque multiplier 1:25', 'Thickness gauge (UT)'];
  return Array.from({ length: 34 }, (_, i) => {
    const t = list[i % list.length];
    return make('tools', i, {
      ref: `TL-${9100 + i}`,
      title: t,
      area: pick(r, ['Unit 100', 'Unit 200', 'Unit 300', 'Unit 220', 'Unit 250']),
      contractor: contractor(r),
      stage: stageFor(r, 4, 0.55),
      plannedDay: int(r, 1, 24),
      owner: 'Tool crib',
      metrics: { qty: int(r, 1, 12), calibrationDue: int(r, 2, 120), crib: pick(r, ['Crib A', 'Crib B', 'Workshop']), serial: `SN-${int(r, 10000, 99999)}` },
    });
  });
}

// ---------- R9 bagging & tagging: Not started, Bagged, Tagged, Verified
function bagging(): PreTaRow[] {
  const r = rng(909);
  return Array.from({ length: 28 }, (_, i) => {
    const e = equip(r);
    const items = int(r, 12, 180);
    const stage = stageFor(r, 4, 0.55);
    const bagged = stage >= 2 ? items : stage === 1 ? Math.round(items * float(r, 0.3, 0.95)) : 0;
    const tagged = stage >= 3 ? items : stage === 2 ? Math.round(items * float(r, 0.2, 0.9)) : 0;
    return make('bagging-tagging', i, {
      ref: `BT-${1100 + i}`,
      title: `${pick(r, ['Instruments', 'Valves', 'Motor terminals', 'Cable glands', 'Analysers'])} · ${e.tag} ${e.desc}`,
      area: e.area,
      contractor: 'Zubair E&M',
      stage,
      plannedDay: int(r, 1, 8),
      owner: PEOPLE.instr,
      metrics: { items, bagged, tagged },
    });
  });
}

// ---------- R10 heavy equipment: Requested, Mobilised, In use, Demobilised
function heavy(): PreTaRow[] {
  const r = rng(1010);
  const kinds: [string, number][] = [['Crawler crane 250 t', 310], ['Mobile crane 80 t', 140], ['Mobile crane 50 t', 95], ['Manlift 32 m', 38], ['Forklift 5 t', 22], ['Hydrojet unit 1000 bar', 120], ['Vacuum truck', 65], ['Telehandler', 48], ['Air compressor 750 cfm', 55], ['Generator 250 kVA', 48]];
  return Array.from({ length: 30 }, (_, i) => {
    const [kind, rate] = kinds[i % kinds.length];
    return make('heavy-equipment', i, {
      ref: `HE-${1200 + i}`,
      title: `${kind} #${Math.floor(i / kinds.length) + 1}`,
      area: pick(r, ['Unit 100', 'Unit 200', 'Unit 300', 'Pipe Rack 4', 'Flare System']),
      contractor: contractor(r, 'Galfar', 'Larsen & Toubro', 'Sohar Industrial Services'),
      stage: stageFor(r, 4, 0.6),
      plannedDay: int(r, 1, 26),
      owner: PEOPLE.rotating,
      metrics: { plate: `OM ${int(r, 10000, 99999)}`, hours: int(r, 0, 220), certDays: int(r, 10, 340), rate },
    });
  });
}

// ---------- R11 fabricated material & pre-fab: Drawing issued, Cutting, Fabricated, NDT and tested, Delivered
function prefab(): PreTaRow[] {
  const r = rng(1111);
  return Array.from({ length: 36 }, (_, i) => {
    const size = pick(r, ['6"', '8"', '10"', '12"', '14"', '16"']);
    const spools = int(r, 2, 18);
    return make('prefab', i, {
      ref: `SP-${1300 + i}`,
      title: `Spool set ${size} ${pick(r, ['CS A106', 'SS 316L', 'CrMo P22', 'CS A333'])} · line ${pick(r, ['14"-P-2201', '8"-P-1104', '12"-P-3120', '10"-P-2277', '6"-P-3305'])}`,
      area: pick(r, ['Unit 100', 'Unit 200', 'Unit 300', 'Pipe Rack 4', 'Flare System']),
      contractor: 'Sohar Industrial Services',
      stage: stageFor(r, 5, 0.6),
      plannedDay: int(r, -20, 12),
      owner: PEOPLE.planner,
      metrics: { spools, weightKg: spools * int(r, 180, 900), diaInch: spools * int(r, 24, 90), shop: pick(r, ['Fab shop 1', 'Fab shop 2']) },
    });
  });
}

// ---------- R12 waste: Generated, Segregated, Manifested, Transported, Disposed
function waste(): PreTaRow[] {
  const r = rng(1212);
  const streams: [string, string, string][] = [
    ['Spent hydrocracking catalyst', 'Hazardous', 'Catalyst reclaimer'],
    ['Hydrocarbon sludge', 'Hazardous', 'Licensed treatment'],
    ['Scrap carbon steel', 'Non-hazardous', 'Recycler'],
    ['Used insulation (mineral wool)', 'Non-hazardous', 'Landfill, Sohar'],
    ['Chemical cleaning effluent', 'Hazardous', 'Licensed treatment'],
    ['Refractory debris', 'Non-hazardous', 'Landfill, Sohar'],
    ['Contaminated PPE and rags', 'Hazardous', 'Incineration'],
    ['General site waste', 'Non-hazardous', 'Municipal'],
  ];
  return Array.from({ length: 30 }, (_, i) => {
    const s = streams[i % streams.length];
    return make('waste', i, {
      ref: `WM-${1400 + i}`,
      title: s[0],
      area: pick(r, ['Unit 100', 'Unit 200', 'Unit 300', 'Unit 220', 'Pipe Rack 4']),
      contractor: 'Sohar Industrial Services',
      stage: stageFor(r, 5, 0.55),
      plannedDay: int(r, 2, 30),
      owner: PEOPLE.hse,
      metrics: { stream: s[0], tonnes: float(r, 0.4, 24, 1), hazard: s[1], manifest: `WCM-${int(r, 10000, 99999)}`, disposer: s[2] },
    });
  });
}

// ---------- R13 inspection of equipment and tools: Due, Inspected, Certified
function eqInspect(): PreTaRow[] {
  const r = rng(1313);
  const items = ['Crawler crane 250 t', 'Mobile crane 80 t', 'Lifting slings (set of 40)', 'Shackles and hooks (set)', 'Full-body harnesses (60)', 'Hydrotest pump', 'Gas detectors (24)', 'Scaffold tube and fittings', 'Pressure gauges (calibration)', 'Welding machines (18)', 'Fire extinguishers (45)', 'Manlift 32 m'];
  return Array.from({ length: 32 }, (_, i) => {
    const stage = stageFor(r, 3, 0.6);
    const failed = stage === 1 && chance(r, 0.25);
    return make('equipment-inspection', i, {
      ref: `EI-${1500 + i}`,
      title: items[i % items.length],
      area: pick(r, ['Unit 100', 'Unit 200', 'Unit 300', 'Laydown 2']),
      contractor: contractor(r),
      stage,
      plannedDay: int(r, -4, 4),
      owner: PEOPLE.qaqc,
      metrics: { cert: stage === 2 ? `CRT-${int(r, 20000, 99999)}` : '—', inspector: pick(r, ['Third party: Bureau Veritas', 'Third party: TUV', 'Site inspector']), result: failed ? 'Failed: quarantined' : stage === 2 ? 'Passed' : 'Pending', validDays: stage === 2 ? int(r, 30, 365) : 0 },
    });
  });
}

export const preTaSeed: PreTaRow[] = [...scaffold(), ...isolation(), ...insulation(), ...weld(), ...rigging(), ...tools(), ...bagging(), ...heavy(), ...prefab(), ...waste(), ...eqInspect()];

