import type { AlertItem } from '../types';

export const alertItems: AlertItem[] = [
  { id: 'ALT-01', type: 'scf-approval', message: 'SCF-201 (USD 24,000, 2 days) awaiting TA Event Manager approval: below the USD 75K rule, so it does not go to the Head of Turnaround Services', severity: 'warn', raisedAt: '2026-08-16T08:12:00', read: false, link: '/scf' },
  { id: 'ALT-02', type: 'permit-overdue', message: '9 hot-work permits overdue for renewal — Unit 200', severity: 'crit', raisedAt: '2026-08-16T07:40:00', read: false, link: '/alerts' },
  { id: 'ALT-03', type: 'boxup-certificate', message: 'Box-up certificate pending sign-off — R-101 manway 2', severity: 'warn', raisedAt: '2026-08-16T06:55:00', read: false },
  { id: 'ALT-04', type: 'pssr-approval', message: 'PSSR checklist submitted for Train B — awaiting Process Safety review', severity: 'info', raisedAt: '2026-08-15T19:20:00', read: true },
  { id: 'ALT-05', type: 'scf-approval', message: 'SCF-203 approved by Head of Turnaround Services (61.5K, exceeds mechanical window)', severity: 'info', raisedAt: '2026-08-15T14:05:00', read: true, link: '/scf' },
  { id: 'ALT-06', type: 'permit-overdue', message: '3 confined space entry permits expiring within 2 hours — Unit 300', severity: 'crit', raisedAt: '2026-08-16T09:02:00', read: false },
  { id: 'ALT-07', type: 'boxup-certificate', message: 'Box-up certificate approved — E-204 channel cover', severity: 'info', raisedAt: '2026-08-14T16:30:00', read: true },
  { id: 'ALT-08', type: 'pssr-approval', message: 'PSSR overdue — Compressor C-301 restart package', severity: 'warn', raisedAt: '2026-08-15T11:00:00', read: false },
  { id: 'ALT-09', type: 'integration', message: 'P6 import complete: 2,486 activities, 5,912 relationships, 38 resources (simulated)', severity: 'info', raisedAt: '2026-08-16T08:02:00', read: false, link: '/integrations?tab=p6' },
  { id: 'ALT-10', type: 'integration', message: 'SAP work order 4000033201 status pushed: REL, 3 operations confirmed (simulated)', severity: 'info', raisedAt: '2026-08-16T08:02:00', read: false, link: '/integrations?tab=monitoring' },
  { id: 'ALT-11', type: 'integration', message: 'SAP push failed: order 4000033215 locked by another user. Retrying, then escalating to the planner group', severity: 'warn', raisedAt: '2026-08-16T07:55:00', read: false, link: '/integrations?tab=monitoring' },
  { id: 'ALT-12', type: 'integration', message: 'P6 rejected a progress update on HCU-1030: start constraint conflict. Planner notified (P6 owns dates)', severity: 'warn', raisedAt: '2026-08-16T07:36:00', read: true, link: '/integrations?tab=monitoring' },
];
