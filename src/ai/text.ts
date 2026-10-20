// Domain text analysis for turnaround scope descriptions: equipment tags, components, work types and damage
// mechanisms, plus TF-IDF and character-trigram similarity. Plain code, no model download, so it runs offline
// and every match can be explained in the planner's own words.

export interface Analysis {
  /** Canonical equipment / line tags (R-101 -> R101, 14"-P-2201 -> P2201). */
  tags: string[];
  /** Display form of the tags as written. */
  tagLabels: string[];
  actions: string[];
  components: string[];
  mechanisms: string[];
  /** Tokens used for TF-IDF: stems plus concept tokens (act:, cmp:, mech:, tag:). */
  terms: string[];
  grams: Map<string, number>;
}

// Multi-word phrases first, so "leak test" is a test (not a leak) and "build-up" is a weld repair.
const PHRASES: [RegExp, string][] = [
  [/corrosion under insulation/g, ' cui '],
  [/wall[ -]?loss|wall thinning|\bthinn(?:ing|ed)\b/g, ' mech_thinning '],
  [/(?:leak|hydro|pressure)[ -]?test(?:ing)?/g, ' act_test '],
  [/weld(?:ed|ing)?[ -]?(?:overlay|build[ -]?up)|build[ -]?up|\boverlay\b/g, ' act_repair '],
  [/(?:relief|safety) valves?|\bpsvs?\b|\bprvs?\b/g, ' cmp_psv '],
  [/control valves?/g, ' cmp_valve '],
  [/lube[ -]?oil(?: console| system| cooler)?/g, ' cmp_lubeoil '],
  [/mechanical seals?|seal gas/g, ' cmp_seal '],
  [/hydro[ -]?jet(?:ting)?/g, ' act_clean '],
  [/change[ -]?out|swap out/g, ' act_replace '],
  [/\bre[ -]?tub(?:e|ed|ing)\b/g, ' act_replace cmp_tube '],
  [/bundle pull(?:ed)?|pull(?:ed)? (?:the )?bundle/g, ' act_remove cmp_bundle '],
  [/(?:heat|steam) tracing/g, ' cmp_tracing '],
  [/access platform/g, ' cmp_platform '],
  [/expansion joint|bellows/g, ' cmp_bellows '],
  [/flame scanner/g, ' cmp_scanner '],
  [/i\/o cards?/g, ' cmp_card '],
  [/hot ?spot|overheat(?:ing)?/g, ' mech_overheat '],
];

const ACTIONS: Record<string, string> = {
  inspect: 'inspect', inspection: 'inspect', examine: 'inspect', examination: 'inspect', check: 'inspect', survey: 'inspect', ndt: 'inspect',
  assess: 'inspect', assessment: 'inspect', analysi: 'inspect', analysis: 'inspect', trend: 'inspect', visual: 'inspect', thermography: 'inspect',
  replace: 'replace', replacement: 'replace', renew: 'replace', renewal: 'replace', swap: 'replace', upgrade: 'replace', upsize: 'replace', migration: 'replace',
  repair: 'repair', weld: 'repair', patch: 'repair', restore: 'repair', rectify: 'repair', fix: 'repair', rework: 'repair',
  clean: 'clean', flush: 'clean', decoke: 'clean', blast: 'clean', wash: 'clean',
  overhaul: 'overhaul', refurbish: 'overhaul', rebuild: 'overhaul', recondition: 'overhaul',
  test: 'test', hydrotest: 'test',
  calibrate: 'calibrate', calibration: 'calibrate', recalibrate: 'calibrate', recalibration: 'calibrate',
  recertify: 'recertify', recertification: 'recertify', recert: 'recertify',
  install: 'install', installation: 'install', add: 'install', addition: 'install', new: 'install', provide: 'install', erect: 'install', fit: 'install',
  remove: 'remove', removal: 'remove', pull: 'remove', unload: 'remove', dismantle: 'remove', extract: 'remove',
  paint: 'paint', coat: 'paint', coating: 'paint',
};

const COMPONENTS: Record<string, string> = {
  nozzle: 'nozzle', tray: 'tray', packing: 'packing', bundle: 'bundle', tube: 'tube', spool: 'spool', line: 'pipe', pipe: 'pipe', piping: 'pipe',
  gasket: 'gasket', flange: 'flange', seal: 'seal', bearing: 'bearing', rotor: 'rotor', impeller: 'impeller', coupling: 'coupling',
  refractory: 'refractory', lining: 'refractory', burner: 'burner', damper: 'damper', actuator: 'actuator', thermowell: 'thermowell',
  transmitter: 'transmitter', valve: 'valve', insulation: 'insulation', lagging: 'insulation', scaffold: 'scaffold', platform: 'platform',
  handrail: 'handrail', grating: 'grating', catalyst: 'catalyst', internal: 'internals', internals: 'internals', head: 'head', manway: 'manway',
  casing: 'casing', shell: 'shell', channel: 'channel', support: 'support', relay: 'relay', card: 'card', controller: 'controller',
  motor: 'motor', cable: 'cable', ladder: 'cable', lighting: 'lighting', battery: 'battery', filter: 'filter', cooler: 'cooler',
  console: 'lubeoil', gearbox: 'gearbox', stack: 'stack', header: 'header', grid: 'grid', screen: 'grid', ejector: 'ejector',
};

const MECHANISMS: Record<string, string> = {
  cui: 'cui', corrosion: 'corrosion', corroded: 'corrosion', corrode: 'corrosion', erosion: 'erosion', eroded: 'erosion',
  crack: 'crack', cracking: 'crack', cracked: 'crack', pitting: 'pitting', pit: 'pitting', leak: 'leak', leaking: 'leak', leakage: 'leak',
  vibration: 'vibration', fouling: 'fouling', fouled: 'fouling', drift: 'drift', drifting: 'drift', worn: 'wear', wear: 'wear',
  damage: 'damage', damaged: 'damage', failure: 'failure', fail: 'failure',
};

const STOP = new Set(
  'the a an of on at in to for and or with from by per all full unit area side level found reported required including incl etc no nos set sets package campaign phase batch main existing as is be this that it its into after before during x plus'.split(' ')
);

// Document numbers and words that look like tags but are not equipment.
const NOT_EQUIPMENT = new Set(['J', 'SCF', 'DJ', 'RSK', 'MOC', 'NCR', 'VAR', 'WP', 'CPA', 'ACT', 'MTO', 'ITP', 'WO', 'REC', 'LL', 'DOC', 'EV', 'ISS', 'DAY', 'TYPE', 'ZONE', 'STEP', 'GATE', 'BAY', 'NO']);
// Case-insensitive so a tag typed as "e-204" still counts. Optional line-size prefix: 14"-P-2201.
const TAG_RE = /(?:\b\d{1,2}["”]?-)?\b([A-Z]{1,4})-(\d{1,4}[A-Z]?)\b/gi;

function stem(w: string): string {
  if (w.length > 5 && w.endsWith('ing')) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith('ies')) return `${w.slice(0, -3)}y`;
  if (w.length > 4 && /(ss|x|ch|sh)es$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('is')) return w.slice(0, -1);
  if (w.length > 5 && w.endsWith('ed')) return w.slice(0, -2);
  return w;
}

export function extractTags(text: string, tagField = ''): { tags: string[]; labels: string[] } {
  const tags = new Map<string, string>();
  for (const src of [tagField, text]) {
    for (const m of src.matchAll(TAG_RE)) {
      const pre = m[1].toUpperCase();
      const num = m[2].toUpperCase();
      if (NOT_EQUIPMENT.has(pre)) continue;
      if (!tags.has(`${pre}${num}`)) tags.set(`${pre}${num}`, `${pre}-${num}`);
    }
  }
  // free-form tag field that is not in TAG-123 form (e.g. "PR4-SUP", "TL-B") still identifies the asset
  if (tagField && ![...tagField.matchAll(TAG_RE)].length) {
    const raw = tagField.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (raw) tags.set(raw, tagField);
  }
  return { tags: [...tags.keys()], labels: [...tags.values()] };
}

function trigrams(s: string): Map<string, number> {
  const t = ` ${s.replace(/\s+/g, ' ').trim()} `;
  const g = new Map<string, number>();
  for (let i = 0; i < t.length - 2; i++) {
    const k = t.slice(i, i + 3);
    g.set(k, (g.get(k) ?? 0) + 1);
  }
  return g;
}

export function analyze(text: string, tagField = ''): Analysis {
  const { tags, labels } = extractTags(text, tagField);
  let s = text.replace(/[–—]/g, ' ').replace(/[“”]/g, '"');
  // tags become single tokens so "R-101" does not split into "r" and "101" (they are added back once, below)
  s = s.replace(TAG_RE, (m, pre: string) => (NOT_EQUIPMENT.has(pre.toUpperCase()) ? m : ' tag_ ')).toLowerCase();
  for (const [re, rep] of PHRASES) s = s.replace(re, rep);
  const actions = new Set<string>();
  const components = new Set<string>();
  const mechanisms = new Set<string>();
  const terms: string[] = [];
  for (const raw of s.split(/[^a-z0-9_]+/)) {
    if (!raw || STOP.has(raw)) continue;
    if (raw.startsWith('act_')) { actions.add(raw.slice(4)); terms.push(`act:${raw.slice(4)}`); continue; }
    if (raw.startsWith('cmp_')) { components.add(raw.slice(4)); terms.push(`cmp:${raw.slice(4)}`); continue; }
    if (raw.startsWith('mech_')) { mechanisms.add(raw.slice(5)); terms.push(`mech:${raw.slice(5)}`); continue; }
    if (raw.startsWith('tag_')) continue; // tags are added once below, from extractTags
    if (/^\d+$/.test(raw)) continue; // bare counts and sizes are noise ("84 valves", "12 burners")
    const w = stem(raw);
    if (w.length < 2) continue;
    const a = ACTIONS[raw] ?? ACTIONS[w];
    const c = COMPONENTS[raw] ?? COMPONENTS[w];
    const m = MECHANISMS[raw] ?? MECHANISMS[w];
    if (a) { actions.add(a); terms.push(`act:${a}`); }
    else if (c) { components.add(c); terms.push(`cmp:${c}`); }
    else if (m) { mechanisms.add(m); terms.push(`mech:${m}`); }
    else terms.push(w);
  }
  tags.forEach((t) => terms.push(`tag:${t}`));
  const plain = s.replace(/\b(?:act|cmp|mech|tag)_/g, '').replace(/[^a-z0-9 ]+/g, ' ');
  return { tags, tagLabels: labels, actions: [...actions], components: [...components], mechanisms: [...mechanisms], terms, grams: trigrams(plain) };
}

/** TF-IDF with a fixed vocabulary, so training and live scoring weigh words the same way. */
export class Vectorizer {
  private idf = new Map<string, number>();
  private maxIdf: number;
  constructor(corpus: string[][]) {
    const df = new Map<string, number>();
    corpus.forEach((doc) => new Set(doc).forEach((t) => df.set(t, (df.get(t) ?? 0) + 1)));
    const n = corpus.length;
    df.forEach((d, t) => this.idf.set(t, Math.log((1 + n) / (1 + d)) + 1));
    this.maxIdf = Math.log(1 + n) + 1;
  }
  vector(terms: string[]): Map<string, number> {
    const tf = new Map<string, number>();
    terms.forEach((t) => tf.set(t, (tf.get(t) ?? 0) + 1));
    const v = new Map<string, number>();
    tf.forEach((f, t) => v.set(t, f * (this.idf.get(t) ?? this.maxIdf)));
    return v;
  }
}

export function cosine(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0, na = 0, nb = 0;
  a.forEach((v, k) => { na += v * v; const w = b.get(k); if (w) dot += v * w; });
  b.forEach((v) => { nb += v * v; });
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

/** 1 when the two sets share an item (scaled by overlap), 0.5 when either side says nothing, 0 when they disagree. */
export function agree(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0.5;
  const common = a.filter((x) => b.includes(x)).length;
  return common ? 0.6 + 0.4 * (common / Math.min(a.length, b.length)) : 0;
}

export const common = (a: string[], b: string[]) => a.filter((x) => b.includes(x));
