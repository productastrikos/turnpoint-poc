import type { RiskItem } from '../types';

export const riskItems: RiskItem[] = [
  { id: 'RSK-01', description: 'Catalyst disposal contractor delayed mobilization', category: 'Logistics', severity: 'high', likelihood: 'likely', owner: 'S. Kumar', mitigation: 'Secondary contractor on standby; escalated to procurement', status: 'mitigating', raisedAt: '2026-08-10' },
  { id: 'RSK-02', description: 'Unplanned corrosion found on V-102 nozzles', category: 'Technical', severity: 'critical', likelihood: 'certain', owner: 'A. Hinai', mitigation: 'Discovery job DJ-014 raised; scope extension via MOC-101', status: 'open', raisedAt: '2026-08-14' },
  { id: 'RSK-03', description: 'Crane availability conflict — E-204 vs C-301 lifts', category: 'Resourcing', severity: 'medium', likelihood: 'possible', owner: 'R. Fernandes', mitigation: 'Revised lift schedule sequencing crane usage', status: 'mitigating', raisedAt: '2026-08-11' },
  { id: 'RSK-04', description: 'Extreme heat advisory — potential man-hour loss', category: 'HSE', severity: 'medium', likelihood: 'likely', owner: 'HSE Team', mitigation: 'Adjusted work-rest cycle, hydration stations added', status: 'mitigating', raisedAt: '2026-08-09' },
  { id: 'RSK-05', description: 'Long-lead gasket set delayed at customs', category: 'Materials', severity: 'high', likelihood: 'possible', owner: 'Procurement', mitigation: 'Expedite fee approved; air freight arranged', status: 'open', raisedAt: '2026-08-13' },
  { id: 'RSK-06', description: 'Scaffold interference with CP1 workfront access', category: 'Logistics', severity: 'medium', likelihood: 'possible', owner: 'M. Al-Balushi', mitigation: 'MOC-104 raised to extend scaffold bay', status: 'open', raisedAt: '2026-08-15' },
  { id: 'RSK-07', description: 'Permit backlog in Inspection discipline', category: 'Compliance', severity: 'high', likelihood: 'likely', owner: 'Permit Office', mitigation: 'Additional permit issuer assigned for night shift', status: 'mitigating', raisedAt: '2026-08-12' },
  { id: 'RSK-08', description: 'Contractor manpower shortfall — Rotating Equipment', category: 'Resourcing', severity: 'low', likelihood: 'rare', owner: 'R. Fernandes', mitigation: 'Cross-trained crew reassigned from Civil', status: 'closed', raisedAt: '2026-08-05' },
];
