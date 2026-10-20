// TA Office organisation (G3, I1), execution organogram (X1) and contractor twin organisation (X2).
import { PEOPLE } from './master';

export interface OrgRole {
  id: string;
  parent: string | null;
  role: string;
  person: string | null; // null = vacant
  team: 'office' | 'execution';
  org: 'oq' | 'contractor';
  responsibilities: string[];
  raci?: Record<string, 'R' | 'A' | 'C' | 'I' | ''>;
}

export const RACI_COLUMNS = ['TA Manager', 'Planning', 'Execution', 'Procurement', 'HSE', 'QA/QC'];

const r = (id: string, parent: string | null, role: string, person: string | null, team: OrgRole['team'], responsibilities: string[], raci?: OrgRole['raci']): OrgRole => ({ id, parent, role, person, team, org: 'oq', responsibilities, raci });

export const orgRoles: OrgRole[] = [
  r('ta-mgr', null, 'TA Event Manager', PEOPLE.taManager, 'office', ['Accountable for safe, on-time, on-budget delivery', 'Chairs the TA steering and daily coordination meetings', 'Approves SCFs below OMR 75K / USD 75K within the mechanical window']),
  r('plan-lead', 'ta-mgr', 'Planning & Scheduling Lead', PEOPLE.planner, 'office', ['Owns the P6 schedule, baseline and look-ahead', 'Maintains work packs and critical path reporting', 'Runs the scope freeze process'], { 'TA Manager': 'A', Planning: 'R', Execution: 'C', Procurement: 'C', HSE: 'I', 'QA/QC': 'I' }),
  r('sched', 'plan-lead', 'Scheduler (P6)', 'D. Pereira', 'office', ['P6 updates and XER import / export', 'Delay and gain analysis']),
  r('planner', 'plan-lead', 'Senior Planner', 'R. Nair', 'office', ['Work pack preparation', 'Man-hour estimates and productivity analysis']),
  r('exec-lead', 'ta-mgr', 'Execution Manager', 'Eng. K. Al-Siyabi', 'office', ['Manages day-to-day execution across all units', 'Chairs shift handover', 'Escalates critical path risks'], { 'TA Manager': 'A', Planning: 'C', Execution: 'R', Procurement: 'I', HSE: 'C', 'QA/QC': 'C' }),
  r('proc-lead', 'ta-mgr', 'Procurement & Contracts Lead', PEOPLE.procurement, 'office', ['Long-lead material and contract call-offs', 'Expediting and vendor performance', 'SCF commercial evaluation'], { 'TA Manager': 'A', Planning: 'C', Execution: 'I', Procurement: 'R', HSE: 'I', 'QA/QC': 'C' }),
  r('hse-lead', 'ta-mgr', 'HSE Lead', PEOPLE.hse, 'office', ['TA HSE plan, permits and isolation oversight', 'Incident investigation and reporting', 'Waste management compliance'], { 'TA Manager': 'A', Planning: 'C', Execution: 'C', Procurement: 'I', HSE: 'R', 'QA/QC': 'I' }),
  r('qaqc-lead', 'ta-mgr', 'QA/QC & Integrity Lead', PEOPLE.qaqc, 'office', ['Inspection test plans and acceptance workflows', 'NCR management and closure', 'Equipment and tool inspection'], { 'TA Manager': 'A', Planning: 'I', Execution: 'C', Procurement: 'C', HSE: 'I', 'QA/QC': 'R' }),
  r('cost-lead', 'ta-mgr', 'Cost Control Lead', 'F. Al-Mamari', 'office', ['Budget, committed and actual cost control', 'Variation and forecast reporting']),
  r('pmo', 'ta-mgr', 'Digital / PMO Lead', 'Y. Al-Farsi', 'office', ['Platform administration and user access', 'Reporting and KPI governance']),
  r('doc', 'pmo', 'Document Controller', null, 'office', ['Handover documentation and archive', 'Document register upkeep']),

  r('x-day', 'exec-lead', 'Day Shift Manager', 'A. Al-Ghafri', 'execution', ['Leads the 06:00-18:00 shift', 'Takes over from night shift against the handover log', 'Approves permit-to-work escalations']),
  r('x-night', 'exec-lead', 'Night Shift Manager', 'Z. Al-Hajri', 'execution', ['Leads the 18:00-06:00 shift', 'Hands over open items and carry-over work']),
  r('x-u100', 'x-day', 'Area Coordinator, Unit 100 HCU', PEOPLE.process, 'execution', ['Single point of contact for HCU work fronts', 'Reactor R-101 critical path watch']),
  r('x-u200', 'x-day', 'Area Coordinator, Unit 200 CDU / VDU', PEOPLE.rotating, 'execution', ['CDU and VDU work fronts', 'E-204 bundle logistics']),
  r('x-u300', 'x-day', 'Area Coordinator, Unit 300 FCC', PEOPLE.electrical, 'execution', ['FCC work fronts', 'C-301 and K-301 rotating equipment']),
  r('x-u220', 'x-day', 'Area Coordinator, SRU / Flare', PEOPLE.instr, 'execution', ['SRU, flare and pipe rack work fronts']),
  r('x-insp', 'exec-lead', 'Inspection Discipline Lead', PEOPLE.inspection, 'execution', ['Discovery job identification and evaluation', 'Inspection hold and witness points']),
  r('x-permit', 'exec-lead', 'Permit Office Supervisor', PEOPLE.permit, 'execution', ['Permit issue, renewal and closure', 'Isolation certificate control']),
  r('x-pssr', 'exec-lead', 'PSSR / Commissioning Lead', 'Eng. B. Al-Habsi', 'execution', ['Pre-startup safety review coordination', 'Start-up readiness and handover from the main contractor']),
];

export const PEOPLE_POOL = ['R. Nair', 'D. Pereira', 'Eng. K. Al-Siyabi', 'F. Al-Mamari', 'Y. Al-Farsi', 'A. Al-Ghafri', 'Z. Al-Hajri', 'N. Thomas (contract hire)', 'H. Al-Maskari', 'S. Al-Rashdi'];

export interface Twin {
  oqRole: string;
  oqPerson: string;
  contractorRole: Record<string, { role: string; person: string }>;
}

export const twins: Twin[] = [
  { oqRole: 'TA Event Manager', oqPerson: PEOPLE.taManager, contractorRole: { Galfar: { role: 'Project Director', person: 'J. Whitfield' }, 'Larsen & Toubro': { role: 'Project Manager', person: 'V. Raghunathan' }, 'Petrofac Services': { role: 'Services Manager', person: 'C. Hughes' }, 'Zubair E&M': { role: 'Project Manager', person: 'A. Al-Zubair' }, 'Sohar Industrial Services': { role: 'Operations Manager', person: 'M. Al-Wahaibi' } } },
  { oqRole: 'Execution Manager', oqPerson: 'Eng. K. Al-Siyabi', contractorRole: { Galfar: { role: 'TA Manager', person: 'Eng. S. Al-Maamari' }, 'Larsen & Toubro': { role: 'Site Manager', person: 'R. Subramanian' }, 'Petrofac Services': { role: 'Inspection Manager', person: 'D. Okafor' }, 'Zubair E&M': { role: 'Site Manager', person: 'T. Al-Busaidi' }, 'Sohar Industrial Services': { role: 'Site Manager', person: 'H. Al-Hosni' } } },
  { oqRole: 'Planning & Scheduling Lead', oqPerson: PEOPLE.planner, contractorRole: { Galfar: { role: 'Planning Manager', person: 'G. D’Costa' }, 'Larsen & Toubro': { role: 'Planning Engineer', person: 'S. Iyer' }, 'Petrofac Services': { role: 'Planner', person: 'L. Fernandes' }, 'Zubair E&M': { role: 'Planner', person: 'O. Al-Jabri' }, 'Sohar Industrial Services': { role: 'Planner', person: 'K. Al-Harthy' } } },
  { oqRole: 'HSE Lead', oqPerson: PEOPLE.hse, contractorRole: { Galfar: { role: 'HSE Manager', person: 'B. Mansour' }, 'Larsen & Toubro': { role: 'HSE Manager', person: 'P. Venkatesh' }, 'Petrofac Services': { role: 'HSE Advisor', person: 'E. Murphy' }, 'Zubair E&M': { role: 'HSE Officer', person: 'N. Al-Lamki' }, 'Sohar Industrial Services': { role: 'HSE Officer', person: 'F. Al-Rawahi' } } },
  { oqRole: 'QA/QC & Integrity Lead', oqPerson: PEOPLE.qaqc, contractorRole: { Galfar: { role: 'QA/QC Manager', person: 'T. Antony' }, 'Larsen & Toubro': { role: 'QA/QC Manager', person: 'M. Krishnan' }, 'Petrofac Services': { role: 'Lead NDT Engineer', person: 'W. Chen' }, 'Zubair E&M': { role: 'QA/QC Engineer', person: 'U. Al-Kharusi' }, 'Sohar Industrial Services': { role: 'QA/QC Inspector', person: 'I. Al-Shukaili' } } },
  { oqRole: 'Procurement & Contracts Lead', oqPerson: PEOPLE.procurement, contractorRole: { Galfar: { role: 'Procurement Manager', person: 'A. Sequeira' }, 'Larsen & Toubro': { role: 'Materials Manager', person: 'N. Pillai' }, 'Petrofac Services': { role: 'Logistics Coordinator', person: 'S. Davies' }, 'Zubair E&M': { role: 'Procurement Officer', person: 'Q. Al-Balushi' }, 'Sohar Industrial Services': { role: 'Stores Supervisor', person: 'Y. Al-Hinai' } } },
];

export const contractorTree: Record<string, { role: string; person: string; children?: { role: string; person: string }[] }> = {
  Galfar: {
    role: 'Project Director',
    person: 'J. Whitfield',
    children: [
      { role: 'TA Manager', person: 'Eng. S. Al-Maamari' },
      { role: 'Planning Manager', person: 'G. D’Costa' },
      { role: 'HSE Manager', person: 'B. Mansour' },
      { role: 'QA/QC Manager', person: 'T. Antony' },
      { role: 'Procurement Manager', person: 'A. Sequeira' },
    ],
  },
};
