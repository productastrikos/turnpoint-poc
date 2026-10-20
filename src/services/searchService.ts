import { MODULE_LIST } from '../app/moduleRegistry';
import { getJobs } from './jobsService';
import { getRisks } from './riskService';
import { getSCFs } from './scfService';
import { getDiscoveryJobs } from './discoveryService';
import { getEquipment } from './equipmentService';
import { getMaterials } from './materialsService';
import { getChangeRequests } from './changeService';
import { getCriticalPathActivities } from './criticalPathService';

export interface SearchHit {
  kind: 'Page' | 'Scope' | 'Risk' | 'SCF' | 'Discovery' | 'Equipment' | 'Material' | 'MOC' | 'Activity';
  title: string;
  sub: string;
  to: string;
}

const match = (q: string, ...fields: (string | undefined)[]) => fields.some((f) => f && f.toLowerCase().includes(q));

/** Global search (checklist G14): routes first, then records from the shared service layer. */
export async function search(query: string): Promise<SearchHit[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const pages: SearchHit[] = MODULE_LIST.filter((m) => match(q, m.label, m.keywords, m.path)).map((m) => ({
    kind: 'Page',
    title: m.label,
    sub: m.path,
    to: m.path,
  }));

  const [jobs, risks, scfs, djs, eq, mats, mocs, cps] = await Promise.all([
    getJobs(),
    getRisks(),
    getSCFs(),
    getDiscoveryJobs(),
    getEquipment(),
    getMaterials(),
    getChangeRequests(),
    getCriticalPathActivities(),
  ]);

  const records: SearchHit[] = [
    ...jobs.filter((j) => match(q, j.id, j.desc, j.tag, j.sapRef, j.area)).map<SearchHit>((j) => ({ kind: 'Scope', title: `${j.id} ${j.desc}`, sub: `${j.area} · ${j.status}`, to: '/scope' })),
    ...cps.filter((a) => match(q, a.id, a.name)).map<SearchHit>((a) => ({ kind: 'Activity', title: `${a.id} ${a.name}`, sub: `${a.path} · ${a.status}`, to: '/critical-path' })),
    ...risks.filter((r) => match(q, r.id, r.description, r.category)).map<SearchHit>((r) => ({ kind: 'Risk', title: `${r.id} ${r.description}`, sub: `${r.severity} · ${r.status}`, to: '/risk-register' })),
    ...scfs.filter((s) => match(q, s.id, s.title)).map<SearchHit>((s) => ({ kind: 'SCF', title: `${s.id} ${s.title}`, sub: s.status, to: '/scf' })),
    ...djs.filter((d) => match(q, d.id, d.desc)).map<SearchHit>((d) => ({ kind: 'Discovery', title: `${d.id} ${d.desc}`, sub: d.state, to: '/discovery-jobs' })),
    ...mocs.filter((c) => match(q, c.id, c.title)).map<SearchHit>((c) => ({ kind: 'MOC', title: `${c.id} ${c.title}`, sub: c.state, to: '/change-moc' })),
    ...eq.filter((e) => match(q, e.id, e.tagNo, e.description)).map<SearchHit>((e) => ({ kind: 'Equipment', title: `${e.tagNo} ${e.description}`, sub: e.status, to: '/equipment-tracking' })),
    ...mats.filter((m) => match(q, m.id, m.description)).map<SearchHit>((m) => ({ kind: 'Material', title: `${m.id} ${m.description}`, sub: `${m.leadTime} lead · ${m.prStatus}`, to: '/materials' })),
  ];

  return [...pages.slice(0, 6), ...records.slice(0, 14)];
}
