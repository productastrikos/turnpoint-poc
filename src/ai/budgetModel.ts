// Budgetary estimate for a scope item, computed on this device. Two methods are blended, the way a cost engineer does it:
//   1. bottom-up: man-hours x the discipline's blended contractor rate, plus a material allowance that depends on the
//      type of work and the equipment class, plus access (scaffold, permits) and a risk-based contingency;
//   2. analogy: the nearest completed jobs from earlier turnarounds (same kind of work on the same kind of equipment),
//      scaled to the man-hours of this job.
// The range comes from how close the analogies are and how much of the input was typed in rather than assumed.
//
// Rates, allowances and the job history are illustrative: OQ's SAP PM actuals are not loaded in this proof of concept.
// Replace PAST_JOBS and RATE with the actuals export and nothing else changes. No language model is called.
import { analyze, cosine, Vectorizer } from './text';
import { equipClassOf, workTypeOf, type EquipClass, type WorkType } from './durationModel';

export interface EstimateInput {
  desc: string;
  discipline: string;
  tag?: string;
  area?: string;
  manhours?: number;
  likelihood?: number;
  consequence?: number;
}

export interface PastJobDoc {
  id: string;
  ta: string;
  desc: string;
  tag: string;
  discipline: string;
  costOMR: number;
  manhours: number;
}

export interface Analogy {
  job: PastJobDoc;
  similarity: number; // 0..1
  scaledOMR: number; // its cost scaled to this job's man-hours
}

export interface Estimate {
  estimateOMR: number;
  lowOMR: number;
  highOMR: number;
  /** 0..100 */
  confidence: number;
  workType: WorkType;
  equipClass: EquipClass;
  manhours: number;
  manhoursSource: 'entered' | 'estimated';
  bottomUp: { labourOMR: number; ratePerHour: number; materialOMR: number; accessOMR: number; contingencyOMR: number; totalOMR: number; contingencyPct: number };
  analogies: Analogy[];
  analogyOMR?: number;
  basis: string[];
}

/** Blended contractor rate in OMR per man-hour (labour, supervision, tools, overhead and margin). */
const RATE: Record<string, number> = { Inspection: 17.5, 'Rotating Equipment': 21, Process: 19, Instrumentation: 18.5, Civil: 14, Electrical: 17 };

/** Man-hours for a typical single job of this type, before the equipment class and size are applied. */
const BASE_MH: Record<WorkType, number> = { inspect: 220, replace: 320, repair: 380, clean: 260, overhaul: 520, test: 120, calibrate: 150, recertify: 200, install: 340, remove: 300, paint: 280, general: 200 };
const CLASS_MH: Record<EquipClass, number> = { Reactor: 3.5, Column: 3, Exchanger: 2.4, Heater: 2.2, Compressor: 2.6, Vessel: 1.8, Pump: 1.2, Piping: 1.3, Valve: 0.9, Instrument: 0.8, Electrical: 0.9, General: 1 };

/** Material allowance as a share of labour cost. */
const MATERIAL: Record<WorkType, number> = { inspect: 0.1, replace: 1.4, repair: 0.6, clean: 0.15, overhaul: 0.9, test: 0.1, calibrate: 0.08, recertify: 0.25, install: 1.2, remove: 0.2, paint: 0.5, general: 0.3 };
const CLASS_MATERIAL: Record<EquipClass, number> = { Reactor: 1.2, Column: 1.2, Exchanger: 1.15, Heater: 1.2, Compressor: 1.25, Vessel: 1.1, Pump: 1, Piping: 0.9, Valve: 1.3, Instrument: 1.1, Electrical: 1, General: 1 };
const HEAVY_ACCESS: EquipClass[] = ['Reactor', 'Column', 'Vessel', 'Heater', 'Exchanger'];

const round = (v: number) => (v >= 50_000 ? Math.round(v / 1000) * 1000 : v >= 5_000 ? Math.round(v / 100) * 100 : Math.round(v / 10) * 10);

/** The biggest quantity in the text ("24 valves", "2,400 m2", "12 burners"), ignoring equipment tags. */
function quantityOf(desc: string): number {
  const cleaned = desc.replace(/[A-Za-z]{1,4}-?\d{2,5}[A-Za-z]?\b/g, ' ');
  const nums = [...cleaned.matchAll(/(\d[\d,]*)\s*(?:m2|m²|valves?|burners?|tubes?|supports?|cvs?|psvs?|transmitters?|units?|beams?|gearboxes|fans?|rows?|points?)/gi)].map((m) => Number(m[1].replace(/,/g, '')));
  return nums.length ? Math.max(...nums) : 0;
}

const content = (terms: string[]) => terms.filter((t) => !t.startsWith('tag:'));

/** Estimate a budget for a scope item. `history` is the completed-jobs corpus used for the analogy. */
export function estimateBudget(input: EstimateInput, history: PastJobDoc[]): Estimate {
  const workType = workTypeOf(input.desc, input.tag ?? '');
  const { cls: equipClass } = equipClassOf(input.tag ?? '', input.desc);
  const rate = RATE[input.discipline] ?? 18;

  // ---- man-hours: use what was typed, otherwise derive from the type of work, the equipment and the quantity
  const entered = Number(input.manhours) > 0;
  const qty = quantityOf(input.desc);
  const sizeFactor = qty > 1 ? 1 + 0.35 * Math.log(qty) : 1;
  const manhours = entered ? Number(input.manhours) : Math.round((BASE_MH[workType] * CLASS_MH[equipClass] * sizeFactor) / 10) * 10;

  // ---- 1. bottom-up
  const labourOMR = manhours * rate;
  const materialOMR = labourOMR * MATERIAL[workType] * CLASS_MATERIAL[equipClass];
  const accessOMR = labourOMR * (HEAVY_ACCESS.includes(equipClass) ? 0.08 : 0.04);
  const risk = (input.likelihood ?? 3) * (input.consequence ?? 3);
  const contingencyPct = risk >= 17 ? 15 : risk >= 10 ? 12 : risk >= 5 ? 8 : 5;
  const contingencyOMR = (labourOMR + materialOMR + accessOMR) * (contingencyPct / 100);
  const bottomTotal = labourOMR + materialOMR + accessOMR + contingencyOMR;

  // ---- 2. analogy: TF-IDF over the work description, plus whether the work type, equipment class and discipline agree
  const targetA = analyze(input.desc, input.tag ?? '');
  const docs = history.map((h) => ({ h, a: analyze(h.desc, h.tag) }));
  const vec = new Vectorizer([content(targetA.terms), ...docs.map((d) => content(d.a.terms))]);
  const tv = vec.vector(content(targetA.terms));
  const analogies: Analogy[] = docs
    .map(({ h, a }) => {
      const sameType = workTypeOf(h.desc, h.tag) === workType ? 1 : 0;
      const sameClass = equipClassOf(h.tag, h.desc).cls === equipClass ? 1 : 0;
      const sameDisc = h.discipline === input.discipline ? 1 : 0;
      const text = cosine(tv, vec.vector(content(a.terms)));
      const similarity = Math.min(1, 0.5 * text + 0.2 * sameType + 0.15 * sameClass + 0.15 * sameDisc);
      const scale = h.manhours > 0 ? Math.pow(manhours / h.manhours, 0.85) : 1;
      return { job: h, similarity, scaledOMR: h.costOMR * scale };
    })
    .filter((x) => x.similarity >= 0.42)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 3);

  const wSum = analogies.reduce((s, a) => s + a.similarity, 0);
  const analogyOMR = analogies.length ? analogies.reduce((s, a) => s + a.scaledOMR * a.similarity, 0) / wSum : undefined;
  const topSim = analogies[0]?.similarity ?? 0;
  // the closer the analogies, the more weight they get against the parametric build-up
  const wAnalogy = analogyOMR === undefined ? 0 : Math.min(0.6, 0.25 + topSim * 0.5);
  const raw = analogyOMR === undefined ? bottomTotal : bottomTotal * (1 - wAnalogy) + analogyOMR * wAnalogy;

  // ---- confidence and range
  let confidence = 42 + (analogies.length ? 10 + 14 * topSim + 4 * (analogies.length - 1) : 0) + (entered ? 8 : -4) + (input.tag ? 3 : 0);
  // when the two methods disagree strongly, say so
  if (analogyOMR !== undefined) confidence -= Math.min(14, Math.abs(Math.log(analogyOMR / bottomTotal)) * 14);
  confidence = Math.max(38, Math.min(92, Math.round(confidence)));
  const spread = 0.07 + ((100 - confidence) / 100) * 0.5;
  const estimateOMR = round(raw);
  const lowOMR = round(raw * (1 - spread * 0.85));
  const highOMR = round(raw * (1 + spread * 1.15)); // estimates overrun more often than they underrun

  const basis = [
    `Man-hours: ${manhours.toLocaleString()} h ${entered ? 'as entered' : `estimated from ${workType} work on a ${equipClass.toLowerCase()}${qty > 1 ? ` (quantity ${qty.toLocaleString()})` : ''}`}.`,
    `Labour: ${manhours.toLocaleString()} h x OMR ${rate.toFixed(1)} per hour (${input.discipline || 'blended'} contractor rate) = OMR ${round(labourOMR).toLocaleString()}.`,
    `Materials and consumables: OMR ${round(materialOMR).toLocaleString()} (typical for ${workType} on a ${equipClass.toLowerCase()}). Access and permits: OMR ${round(accessOMR).toLocaleString()}.`,
    `Contingency ${contingencyPct}% for risk score ${risk}: OMR ${round(contingencyOMR).toLocaleString()}. Bottom-up total OMR ${round(bottomTotal).toLocaleString()}.`,
    analogies.length
      ? `${analogies.length} similar completed job${analogies.length > 1 ? 's' : ''}, scaled to ${manhours.toLocaleString()} h, point to OMR ${round(analogyOMR!).toLocaleString()}; blended ${Math.round(wAnalogy * 100)}% analogy / ${Math.round((1 - wAnalogy) * 100)}% bottom-up.`
      : 'No close analogy in the job history, so the estimate is bottom-up only and the range is wider.',
  ];

  return {
    estimateOMR,
    lowOMR,
    highOMR,
    confidence,
    workType,
    equipClass,
    manhours,
    manhoursSource: entered ? 'entered' : 'estimated',
    bottomUp: { labourOMR: round(labourOMR), ratePerHour: rate, materialOMR: round(materialOMR), accessOMR: round(accessOMR), contingencyOMR: round(contingencyOMR), totalOMR: round(bottomTotal), contingencyPct },
    analogies,
    analogyOMR: analogyOMR === undefined ? undefined : round(analogyOMR),
    basis,
  };
}
