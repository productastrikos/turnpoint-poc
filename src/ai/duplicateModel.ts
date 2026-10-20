// Duplicate scope detection (checklist S9). A pairwise classifier: for two scope items it measures text similarity
// (TF-IDF and character trigrams) and agreement on equipment, component, work type, damage mechanism, discipline,
// area, time window and estimate size, and a logistic model trained on labelled pairs turns that into the
// probability that both items describe the same work.
//
// Training data: OQ's historical turnaround worklists are not digitised yet (the SOW asks for that), so the model is
// trained on a generated history of labelled pairs (paraphrased duplicates, same-equipment-different-work pairs,
// same-work-different-equipment pairs and random pairs, with 3 % label noise). Planner decisions made in the app
// ("merge", "not a duplicate") are added with a higher weight and the model retrains in milliseconds.
import { agree, analyze, common, cosine, Vectorizer, type Analysis } from './text';
import { evaluate, explain, predict, rawWeights, split, train, type LogRegModel, type Metrics } from './logreg';
import { rng } from './rng';

export interface ScopeDoc {
  id: string;
  desc: string;
  tag: string;
  area: string;
  discipline: string;
  startDay?: number;
  durationDays?: number;
  costOMR?: number;
  manhours?: number;
  source?: string;
}

export const DUP_FEATURES = ['text', 'wording', 'equipment', 'component', 'workType', 'mechanism', 'discipline', 'area', 'window', 'estimate'] as const;

export const DUP_FEATURE_LABEL: Record<(typeof DUP_FEATURES)[number], string> = {
  text: 'Description similarity (TF-IDF)',
  wording: 'Wording similarity (character trigrams)',
  equipment: 'Same equipment tag',
  component: 'Same component',
  workType: 'Same work type',
  mechanism: 'Same damage mechanism',
  discipline: 'Same discipline',
  area: 'Same area / unit',
  window: 'Planned time windows',
  estimate: 'Estimate size',
};

/** Above this probability a pair is reported as a duplicate. */
export const DUP_THRESHOLD = 0.6;

interface Analysed {
  doc: ScopeDoc;
  a: Analysis;
  v: Map<string, number>;
}

function windowScore(a: ScopeDoc, b: ScopeDoc): { score: number; gap: number | null } {
  if (a.startDay === undefined || b.startDay === undefined) return { score: 0.5, gap: null };
  const aEnd = a.startDay + (a.durationDays ?? 1) - 1;
  const bEnd = b.startDay + (b.durationDays ?? 1) - 1;
  const gap = Math.max(a.startDay, b.startDay) - Math.min(aEnd, bEnd);
  return { score: gap <= 0 ? 1 : Math.max(0, 1 - gap / 7), gap: Math.max(0, gap) };
}

function features(x: Analysed, y: Analysed): number[] {
  const { doc: a } = x;
  const { doc: b } = y;
  const costs = [a.costOMR ?? 0, b.costOMR ?? 0];
  return [
    cosine(x.v, y.v),
    cosine(x.a.grams, y.a.grams),
    common(x.a.tags, y.a.tags).length ? 1 : 0,
    agree(x.a.components, y.a.components),
    agree(x.a.actions, y.a.actions),
    agree(x.a.mechanisms, y.a.mechanisms),
    a.discipline === b.discipline ? 1 : 0,
    a.area === b.area ? 1 : 0,
    windowScore(a, b).score,
    costs[0] && costs[1] ? Math.min(...costs) / Math.max(...costs) : 0.5,
  ];
}

// ------------------------------------------------------------------------------------------------ synthetic history

interface Kind {
  cls: string;
  prefix: string;
  discipline: string;
  works: [string, string][]; // [work type, component]
  mechs: string[];
}

const KINDS: Kind[] = [
  { cls: 'reactor', prefix: 'R', discipline: 'Inspection', works: [['inspect', 'internals'], ['repair', 'nozzle'], ['inspect', 'nozzle'], ['replace', 'thermowell'], ['remove', 'catalyst'], ['install', 'internals']], mechs: ['thinning', 'crack', 'pitting'] },
  { cls: 'column', prefix: 'T', discipline: 'Inspection', works: [['inspect', 'tray'], ['repair', 'tray'], ['replace', 'packing'], ['inspect', 'packing'], ['replace', 'spool'], ['replace', 'insulation']], mechs: ['cui', 'corrosion', 'fouling'] },
  { cls: 'exchanger', prefix: 'E', discipline: 'Rotating Equipment', works: [['remove', 'bundle'], ['clean', 'bundle'], ['replace', 'tube'], ['replace', 'gasket'], ['test', 'bundle'], ['inspect', 'shell']], mechs: ['leak', 'fouling', 'corrosion'] },
  { cls: 'vessel', prefix: 'V', discipline: 'Inspection', works: [['inspect', 'nozzle'], ['install', 'platform'], ['inspect', 'internals'], ['repair', 'lining'], ['replace', 'gasket']], mechs: ['thinning', 'corrosion'] },
  { cls: 'heater', prefix: 'F', discipline: 'Process', works: [['inspect', 'tube'], ['clean', 'tube'], ['replace', 'burner'], ['overhaul', 'damper'], ['repair', 'refractory']], mechs: ['crack', 'erosion'] },
  { cls: 'pump', prefix: 'P', discipline: 'Rotating Equipment', works: [['overhaul', 'pump'], ['replace', 'seal'], ['inspect', 'bearing'], ['replace', 'coupling']], mechs: ['vibration', 'leak', 'wear'] },
  { cls: 'compressor', prefix: 'C', discipline: 'Rotating Equipment', works: [['remove', 'rotor'], ['inspect', 'bearing'], ['clean', 'lubeoil'], ['replace', 'seal'], ['inspect', 'casing']], mechs: ['vibration', 'wear'] },
  { cls: 'relief valve', prefix: 'RV', discipline: 'Instrumentation', works: [['recertify', 'psv'], ['replace', 'psv']], mechs: ['leak'] },
  { cls: 'control valve', prefix: 'PV', discipline: 'Instrumentation', works: [['overhaul', 'valve'], ['calibrate', 'actuator']], mechs: ['leak', 'wear'] },
  { cls: 'transmitter', prefix: 'LT', discipline: 'Instrumentation', works: [['calibrate', 'transmitter'], ['replace', 'transmitter']], mechs: ['drift'] },
  { cls: 'MCC', prefix: 'MCC', discipline: 'Electrical', works: [['replace', 'relay'], ['inspect', 'cable'], ['repair', 'cable']], mechs: ['overheat'] },
];

const AREAS = ['Unit 100', 'Unit 200', 'Unit 220', 'Unit 250', 'Unit 300', 'Flare System', 'Pipe Rack 4'];
const DISCIPLINES = ['Inspection', 'Rotating Equipment', 'Process', 'Instrumentation', 'Civil', 'Electrical'];

const VERB: Record<string, string[]> = {
  inspect: ['Inspect', 'Inspection of', 'Visual and NDT inspection of', 'Check', 'Survey'],
  replace: ['Replace', 'Renew', 'Change out', 'Replacement of'],
  repair: ['Repair', 'Weld overlay repair of', 'Weld build-up on', 'Weld repair of'],
  clean: ['Clean', 'Hydrojet', 'Flush', 'Cleaning of'],
  overhaul: ['Overhaul', 'Refurbish', 'Overhaul of'],
  test: ['Leak test', 'Hydrotest', 'Pressure test'],
  calibrate: ['Calibrate', 'Recalibrate', 'Calibration of'],
  recertify: ['Recertify', 'Recertification of', 'Bench test and recertify'],
  install: ['Install', 'Add', 'Provide', 'Install new'],
  remove: ['Remove', 'Pull', 'Unload', 'Removal of'],
};
const NOUN: Record<string, string[]> = {
  inspect: ['inspection', 'NDT inspection', 'check'],
  replace: ['replacement', 'renewal', 'change-out'],
  repair: ['repair', 'weld overlay', 'build-up repair'],
  clean: ['cleaning', 'hydrojetting', 'flushing'],
  overhaul: ['overhaul', 'refurbishment'],
  test: ['leak test', 'hydrotest'],
  calibrate: ['calibration', 'recalibration'],
  recertify: ['recertification', 'bench test and recertification'],
  install: ['installation', 'addition'],
  remove: ['removal', 'pull'],
};
const CMP: Record<string, string[]> = {
  nozzle: ['nozzle', 'nozzles', 'outlet nozzle', 'inlet nozzle N1'], tray: ['trays', 'tray deck', 'trays section B'], packing: ['packing', 'structured packing'],
  bundle: ['bundle', 'tube bundle'], tube: ['tubes', 'tube'], spool: ['spool', 'line spool', 'overhead spool'], gasket: ['gasket', 'gaskets', 'channel gasket'],
  seal: ['mechanical seal', 'seal'], bearing: ['bearings', 'bearing'], rotor: ['rotor'], lubeoil: ['lube oil console', 'lube oil system'],
  refractory: ['refractory', 'refractory lining'], lining: ['lining', 'internal lining'], burner: ['burners', 'burner'], damper: ['damper', 'flue gas damper'],
  thermowell: ['thermowell'], transmitter: ['transmitter', 'level transmitter'], valve: ['valve', 'valves'], psv: ['PSVs', 'relief valves', 'safety valves'],
  insulation: ['insulation', 'lagging'], platform: ['access platform', 'platform'], internals: ['internals'], catalyst: ['catalyst'], relay: ['protection relays', 'relays'],
  cable: ['cables', 'cable'], coupling: ['coupling'], shell: ['shell'], casing: ['casing'], actuator: ['actuator'], pump: ['pump'],
};
const MECH: Record<string, string[]> = {
  thinning: ['wall loss', 'wall thinning', 'thinning'], cui: ['CUI', 'corrosion under insulation'], corrosion: ['corrosion', 'corroded'], leak: ['leak', 'leaking'],
  crack: ['crack', 'cracking'], vibration: ['high vibration', 'vibration'], fouling: ['fouling', 'heavy fouling'], erosion: ['erosion'], wear: ['wear', 'worn'],
  pitting: ['pitting'], drift: ['drift', 'drifting'], overheat: ['hot spot', 'overheating'],
};

interface Item {
  kind: Kind;
  tag: string;
  area: string;
  work: [string, string];
  mech?: string;
}

function render(r: ReturnType<typeof rng>, it: Item, template: number, withMech: boolean): string {
  const [act, cmp] = it.work;
  const verb = r.pick(VERB[act]);
  const noun = r.pick(NOUN[act]);
  const c = r.pick(CMP[cmp] ?? [cmp]);
  const m = withMech && it.mech ? r.pick(MECH[it.mech]) : '';
  switch (template) {
    case 0: return `${verb} ${c} on ${it.tag}${m ? ` (${m})` : ''}`;
    case 1: return `${it.tag} ${c} ${noun}${m ? `, ${m} found` : ''}`;
    case 2: return `${it.tag} ${it.kind.cls} ${c} ${noun}${m ? ` (${m})` : ''}`;
    case 3: return `${verb} ${it.tag} ${c}${m ? `, ${m}` : ''}`;
    case 4: return `${c[0].toUpperCase()}${c.slice(1)} ${noun} — ${it.tag}${m ? `, ${m}` : ''}`;
    default: return `${it.tag} ${c} ${m || noun}`; // SAP-style short text, often without a work verb
  }
}

function makeItem(r: ReturnType<typeof rng>, kind?: Kind, tagNo?: number): Item {
  const k = kind ?? r.pick(KINDS);
  const n = tagNo ?? r.int(1, 9) * 100 + r.int(1, 12);
  return { kind: k, tag: `${k.prefix}-${n}`, area: r.pick(AREAS), work: r.pick(k.works), mech: r.chance(0.6) ? r.pick(k.mechs) : undefined };
}

function doc(r: ReturnType<typeof rng>, it: Item, id: string, template: number, base?: ScopeDoc): ScopeDoc {
  // a quarter of requests arrive unscheduled (SAP notifications, field requests) and some carry no estimate yet
  const scheduled = r.chance(0.75);
  const start = base?.startDay !== undefined ? base.startDay + r.int(-2, 2) : r.int(1, 28);
  const cost = base?.costOMR ? Math.round(base.costOMR * (0.75 + r.next() * 0.5)) : r.int(4, 220) * 1000;
  return {
    id,
    desc: render(r, it, template, r.chance(0.7)),
    tag: r.chance(0.85) ? it.tag : '', // the tag field is sometimes left empty on the second copy
    area: it.area,
    discipline: base && r.chance(0.8) ? base.discipline : r.chance(0.75) ? it.kind.discipline : r.pick(DISCIPLINES),
    startDay: scheduled ? Math.max(1, start) : undefined,
    durationDays: scheduled ? (base?.durationDays ? Math.max(1, base.durationDays + r.int(-1, 1)) : r.int(1, 10)) : undefined,
    costOMR: r.chance(0.9) ? cost : undefined,
  };
}

/** Writing style: one in five requests is an SAP-style short text, often with no work verb. */
const template = (r: ReturnType<typeof rng>) => (r.chance(0.2) ? 5 : r.int(0, 4));

/** Labelled pairs standing in for six previous turnarounds' merge decisions. Deterministic (seeded). */
export function syntheticHistory(seed = 2026, n = 1800): { a: ScopeDoc; b: ScopeDoc; label: number; type: string }[] {
  const r = rng(seed);
  const out: { a: ScopeDoc; b: ScopeDoc; label: number; type: string }[] = [];
  for (let i = 0; i < n; i++) {
    const u = r.next();
    let a: ScopeDoc, b: ScopeDoc, label: number, type: string;
    if (u < 0.3) {
      // the same work raised twice, by different people or channels, in different words
      const it = makeItem(r);
      const t1 = template(r);
      let t2 = template(r);
      if (t2 === t1) t2 = (t1 + r.int(1, 5)) % 6;
      a = doc(r, it, `H${i}a`, t1);
      b = doc(r, it, `H${i}b`, t2, a);
      label = 1;
      type = 'duplicate';
    } else if (u < 0.5) {
      // same equipment, different work (inspection vs access platform, trays vs spool): not a duplicate
      const it = makeItem(r);
      const other = it.kind.works.filter((w) => w[0] !== it.work[0] || w[1] !== it.work[1]);
      a = doc(r, it, `H${i}a`, template(r));
      b = doc(r, { ...it, work: r.pick(other), mech: r.chance(0.5) ? it.mech : r.pick(it.kind.mechs) }, `H${i}b`, template(r), r.chance(0.6) ? a : undefined);
      label = 0;
      type = 'same equipment, different work';
    } else if (u < 0.67) {
      // same work on a sister unit (R-131 vs R-132): not a duplicate
      const it = makeItem(r);
      const n2 = Number(it.tag.split('-')[1]) + r.int(1, 3);
      a = doc(r, it, `H${i}a`, template(r));
      b = doc(r, { ...it, tag: `${it.kind.prefix}-${n2}`, area: r.chance(0.6) ? it.area : r.pick(AREAS) }, `H${i}b`, template(r), r.chance(0.5) ? a : undefined);
      label = 0;
      type = 'same work, different equipment';
    } else if (u < 0.78) {
      // same equipment and component, different work type (inspect the nozzle vs repair the nozzle): related, not the same
      const it = makeItem(r);
      const acts = Object.keys(VERB).filter((x) => x !== it.work[0]);
      a = doc(r, it, `H${i}a`, r.int(0, 4));
      b = doc(r, { ...it, work: [r.pick(acts), it.work[1]] }, `H${i}b`, r.int(0, 4), r.chance(0.6) ? a : undefined);
      label = 0;
      type = 'same component, different work type';
    } else {
      a = doc(r, makeItem(r), `H${i}a`, template(r));
      b = doc(r, makeItem(r), `H${i}b`, template(r));
      label = 0;
      type = 'unrelated';
    }
    if (r.chance(0.03)) label = 1 - label; // label noise: planners do not always agree
    out.push({ a, b, label, type });
  }
  return out;
}

// ------------------------------------------------------------------------------------------------ the model

export interface Decision {
  a: ScopeDoc;
  b: ScopeDoc;
  label: 0 | 1;
}

export interface DupModelCard {
  trainedOn: number;
  historyPairs: number;
  decisions: number;
  holdout: Metrics;
  weights: { feature: string; label: string; weight: number }[];
  threshold: number;
  trainMs: number;
}

export interface DupModel {
  model: LogRegModel;
  vectorizer: Vectorizer;
  card: DupModelCard;
}

const HISTORY_WEIGHT = 1;
const DECISION_WEIGHT = 8;

export function buildDupModel(extraCorpus: ScopeDoc[] = [], decisions: Decision[] = []): DupModel {
  const t0 = performance.now();
  const history = syntheticHistory();
  const allDocs = [...history.flatMap((p) => [p.a, p.b]), ...extraCorpus, ...decisions.flatMap((d) => [d.a, d.b])];
  const analyses = new Map<string, Analysis>();
  const an = (d: ScopeDoc) => {
    const k = `${d.desc}|${d.tag}`;
    let x = analyses.get(k);
    if (!x) { x = analyze(d.desc, d.tag); analyses.set(k, x); }
    return x;
  };
  const vectorizer = new Vectorizer(allDocs.map((d) => an(d).terms));
  const prep = (d: ScopeDoc): Analysed => ({ doc: d, a: an(d), v: vectorizer.vector(an(d).terms) });
  const rows = history.map((p) => ({ x: features(prep(p.a), prep(p.b)), y: p.label, w: HISTORY_WEIGHT }));
  const { trainRows, testRows } = split(rows);
  const decided = decisions.map((d) => ({ x: features(prep(d.a), prep(d.b)), y: d.label, w: DECISION_WEIGHT }));
  const fit = [...trainRows, ...decided];
  const model = train([...DUP_FEATURES], fit.map((r) => r.x), fit.map((r) => r.y), { sampleWeight: fit.map((r) => r.w) });
  const holdout = evaluate(model, testRows.map((r) => r.x), testRows.map((r) => r.y), DUP_THRESHOLD);
  return {
    model,
    vectorizer,
    card: {
      trainedOn: fit.length,
      historyPairs: history.length,
      decisions: decisions.length,
      holdout,
      weights: rawWeights(model).map((w) => ({ ...w, label: DUP_FEATURE_LABEL[w.feature as (typeof DUP_FEATURES)[number]] })),
      threshold: DUP_THRESHOLD,
      trainMs: Math.round(performance.now() - t0),
    },
  };
}

// ------------------------------------------------------------------------------------------------ scoring

export interface PairScore {
  a: ScopeDoc;
  b: ScopeDoc;
  probability: number;
  kind: 'duplicate' | 'bundle' | 'unrelated';
  x: number[];
  reasons: string[];
  /** Equipment both items act on, as written. */
  sharedTags: string[];
  gap: number | null;
}

const ACT_LABEL: Record<string, string> = { inspect: 'inspection', replace: 'replacement', repair: 'repair', clean: 'cleaning', overhaul: 'overhaul', test: 'testing', calibrate: 'calibration', recertify: 'recertification', install: 'installation', remove: 'removal', paint: 'painting' };
const MECH_LABEL: Record<string, string> = { cui: 'CUI', thinning: 'wall thinning', corrosion: 'corrosion', leak: 'leak', crack: 'cracking', vibration: 'vibration', fouling: 'fouling', erosion: 'erosion', wear: 'wear', pitting: 'pitting', drift: 'drift', overheat: 'overheating', damage: 'damage', failure: 'failure' };
const omr = (v: number) => (v >= 1000 ? `OMR ${Math.round(v / 1000)}K` : `OMR ${v}`);

export function scorePair(m: DupModel, a: ScopeDoc, b: ScopeDoc): PairScore {
  const pa: Analysed = { doc: a, a: analyze(a.desc, a.tag), v: new Map() };
  const pb: Analysed = { doc: b, a: analyze(b.desc, b.tag), v: new Map() };
  pa.v = m.vectorizer.vector(pa.a.terms);
  pb.v = m.vectorizer.vector(pb.a.terms);
  const x = features(pa, pb);
  const probability = predict(m.model, x);
  const sharedTags = pa.a.tagLabels.filter((_, i) => pb.a.tags.includes(pa.a.tags[i]));
  const { gap } = windowScore(a, b);
  const near = gap === null || gap <= 3;
  const kind = probability >= DUP_THRESHOLD ? 'duplicate' : sharedTags.length && near ? 'bundle' : 'unrelated';

  const reasons: string[] = [];
  if (sharedTags.length) reasons.push(`Same equipment ${sharedTags.join(', ')}`);
  const comps = common(pa.a.components, pb.a.components);
  const acts = common(pa.a.actions, pb.a.actions);
  const mechs = common(pa.a.mechanisms, pb.a.mechanisms);
  if (kind === 'bundle') {
    const what = (x: Analysis) => [x.actions.map((k) => ACT_LABEL[k] ?? k)[0], x.components[0]].filter(Boolean).join(' of ') || 'other work';
    reasons.push(`Different work: ${what(pa.a)} / ${what(pb.a)}`);
    reasons.push(gap === null ? 'Window not planned yet' : gap === 0 ? 'Windows overlap: one access, isolation and permit' : `Windows ${gap} day${gap === 1 ? '' : 's'} apart: keep the scaffold up`);
  } else {
    if (comps.length) reasons.push(`Same component: ${comps.join(', ')}`);
    if (acts.length) reasons.push(`Same work type: ${acts.map((k) => ACT_LABEL[k] ?? k).join(', ')}`);
    if (mechs.length) reasons.push(`Same damage mechanism: ${mechs.map((k) => MECH_LABEL[k] ?? k).join(', ')}`);
    const textPct = Math.round(x[0] * 100);
    // synonyms (overlay = build-up, PSV = relief valve) make different wording count as the same meaning
    reasons.push(x[0] >= 0.85 && x[1] < 0.75 ? `Different wording, same meaning (${textPct}% after synonyms)` : `Descriptions ${textPct}% alike`);
    if (gap === 0) reasons.push('Planned in the same window');
    if (a.costOMR && b.costOMR && x[9] >= 0.7) reasons.push(`Similar estimate (${omr(a.costOMR)} / ${omr(b.costOMR)})`);
    if (a.discipline && b.discipline && a.discipline !== b.discipline) reasons.push(`Raised by different disciplines (${a.discipline} / ${b.discipline})`);
    if (a.source && b.source && a.source !== b.source) reasons.push(`Came in through different channels (${a.source} / ${b.source})`);
  }
  return { a, b, probability, kind, x, reasons, sharedTags, gap };
}

/** TF-IDF similarity of two free texts with the model's vocabulary (e.g. a request vs an approved variation title). */
export function textSimilarity(m: DupModel, s1: string, s2: string): number {
  return cosine(m.vectorizer.vector(analyze(s1).terms), m.vectorizer.vector(analyze(s2).terms));
}

/** Why the model scored the pair the way it did, feature by feature (log-odds contributions). */
export function explainPair(m: DupModel, p: PairScore) {
  return explain(m.model, p.x).map((c) => ({ ...c, label: DUP_FEATURE_LABEL[c.feature as (typeof DUP_FEATURES)[number]] }));
}

/** All pairs worth showing, strongest first. `onlyIf` limits the scan, e.g. to pairs with at least one open item. */
export function scanDocs(m: DupModel, docs: ScopeDoc[], onlyIf: (a: ScopeDoc, b: ScopeDoc) => boolean = () => true): PairScore[] {
  const out: PairScore[] = [];
  for (let i = 0; i < docs.length; i++) {
    for (let j = i + 1; j < docs.length; j++) {
      if (!onlyIf(docs[i], docs[j])) continue;
      const s = scorePair(m, docs[i], docs[j]);
      if (s.kind !== 'unrelated') out.push(s);
    }
  }
  return out.sort((x, y) => (x.kind === y.kind ? y.probability - x.probability : x.kind === 'duplicate' ? -1 : 1));
}

// Enabling work (scaffold packages, temporary power) shares equipment tags with everything around it; it is not a bundling partner.
const isSupportWork = (d: ScopeDoc) => /scaffold|package|temporary/i.test(d.desc);

/**
 * The planner's view of a scan: every duplicate, plus one bundling suggestion per open item (its best partner:
 * overlapping window first, then closest description). Items already in a duplicate pair are left out of bundles.
 */
export function shortlist(pairs: PairScore[], isOpen: (id: string) => boolean): PairScore[] {
  const dups = pairs.filter((p) => p.kind === 'duplicate');
  const inDup = new Set(dups.flatMap((p) => [p.a.id, p.b.id]));
  const rank = (q: PairScore) => (q.gap === 0 ? 2 : q.gap === null ? 0.5 : 1) + q.x[0];
  const best = new Map<string, PairScore>();
  for (const p of pairs) {
    if (p.kind !== 'bundle' || inDup.has(p.a.id) || inDup.has(p.b.id) || isSupportWork(p.a) || isSupportWork(p.b)) continue;
    for (const id of [p.a.id, p.b.id]) {
      if (!isOpen(id)) continue;
      const cur = best.get(id);
      if (!cur || rank(p) > rank(cur)) best.set(id, p);
    }
  }
  const bundles = [...new Set(best.values())].sort((x, y) => rank(y) - rank(x));
  return [...dups, ...bundles];
}

/** Best matches for one new item against an existing list (as-you-type check, imports, SAP inbound). */
export function matchAgainst(m: DupModel, candidate: ScopeDoc, docs: ScopeDoc[], limit = 3): PairScore[] {
  return docs
    .filter((d) => d.id !== candidate.id)
    .map((d) => scorePair(m, candidate, d))
    .filter((s) => s.kind !== 'unrelated')
    .sort((x, y) => (x.kind === y.kind ? y.probability - x.probability : x.kind === 'duplicate' ? -1 : 1))
    .slice(0, limit);
}
