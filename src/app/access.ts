// Role-based access control model (checklist G4). A persona is a named user type; each module belongs to an
// access group; the matrix below says what each persona can do in each group.
import type { ViewRole } from './roleTypes';

export type AccessLevel = 'full' | 'view' | 'none';
export type AccessGroup = 'strategic' | 'commercial' | 'governance' | 'field' | 'admin';

export interface Persona {
  id: string;
  label: string;
  org: string;
  kind: ViewRole; // legacy two-way split used for cost visibility / approval rights
  person: string;
  blurb: string;
  access: Record<AccessGroup, AccessLevel>;
}

export const GROUP_LABEL: Record<AccessGroup, string> = {
  strategic: 'Strategic (portfolio, strategy, executive)',
  commercial: 'Commercial (budget, procurement, contractor KPIs)',
  governance: 'Governance (scope, SCF, MOC, risk)',
  field: 'Field & execution',
  admin: 'Administration & integrations',
};

export const PERSONAS: Persona[] = [
  {
    id: 'ta-manager',
    label: 'TA Event Manager',
    org: 'OQ RPI',
    kind: 'oq-staff',
    person: 'S. Al-Harthy',
    blurb: 'Runs the turnaround. Full rights everywhere.',
    access: { strategic: 'full', commercial: 'full', governance: 'full', field: 'full', admin: 'full' },
  },
  {
    id: 'steerco',
    label: 'Steering Committee',
    org: 'OQ RPI',
    kind: 'oq-staff',
    person: 'N. Al-Busaidi',
    blurb: 'Executive oversight. Read-only dashboards, approvals only on strategic items.',
    access: { strategic: 'full', commercial: 'view', governance: 'view', field: 'view', admin: 'none' },
  },
  {
    id: 'planner',
    label: 'Planner / Scheduler',
    org: 'OQ RPI',
    kind: 'oq-staff',
    person: 'M. Al-Balushi',
    blurb: 'Owns schedule, work packs and scope. No portfolio or admin rights.',
    access: { strategic: 'view', commercial: 'view', governance: 'full', field: 'full', admin: 'none' },
  },
  {
    id: 'inspection',
    label: 'Inspection Engineer',
    org: 'OQ RPI',
    kind: 'oq-staff',
    person: 'A. Hinai',
    blurb: 'Raises discovery jobs, runs QA/QC and NCRs. No commercial data.',
    access: { strategic: 'view', commercial: 'none', governance: 'view', field: 'full', admin: 'none' },
  },
  {
    id: 'hse',
    label: 'HSE Officer',
    org: 'OQ RPI',
    kind: 'oq-staff',
    person: 'L. D’Souza',
    blurb: 'Safety, permits, issues, PSSR. No commercial data.',
    access: { strategic: 'view', commercial: 'none', governance: 'view', field: 'full', admin: 'none' },
  },
  {
    id: 'contractor',
    label: 'Contractor Supervisor',
    org: 'Galfar (MMC)',
    kind: 'contractor',
    person: 'Galfar site supervisor',
    blurb: 'Raises SCFs and discovery jobs, updates progress, captures field data. No cost, strategy or approval rights.',
    access: { strategic: 'none', commercial: 'none', governance: 'full', field: 'full', admin: 'none' },
  },
];

export const DEFAULT_PERSONA = PERSONAS[0];

export function personaById(id: string): Persona {
  return PERSONAS.find((p) => p.id === id) ?? DEFAULT_PERSONA;
}
