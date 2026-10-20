import type { AlertItem } from '../types';
import { delay } from './_util';

/** One e-mail per alert, as OQ mail would deliver it (SOW 4.75, 22.2). Simulated: nothing is sent. */
export interface MailPreview {
  from: string;
  to: string[];
  cc: string[];
  subject: string;
  greeting: string;
  paragraphs: string[];
  action?: { label: string; to: string };
  footer: string;
}

const TYPE_LABEL: Record<AlertItem['type'], string> = {
  'scf-approval': 'SCF approval',
  'boxup-certificate': 'Box-up certificate',
  'pssr-approval': 'PSSR approval',
  'permit-overdue': 'Permit overdue',
  integration: 'SAP / P6 integration',
};

interface Route {
  to: string[];
  cc: string[];
  greeting: string;
  ask: string;
}

const ROUTING: Record<AlertItem['type'], Route> = {
  'scf-approval': {
    to: ['S. Al-Harthy, TA Event Manager <s.alharthy@oqrpi.example>'],
    cc: ['TA central costing team <ta.costing@oqrpi.example>'],
    greeting: 'Dear TA Event Manager,',
    ask: 'Please review the cost, duration and material and resource availability on the request and approve, reject or return it. Approval routing follows the cost and mechanical-window rule.',
  },
  'boxup-certificate': {
    to: ['Eng. K. Al-Siyabi, Execution Manager <k.alsiyabi@oqrpi.example>'],
    cc: ['P. Menon, QA/QC Lead <p.menon@oqrpi.example>', 'L. D’Souza, HSE Lead <l.dsouza@oqrpi.example>'],
    greeting: 'Dear Execution Manager,',
    ask: 'The Operations witness and the inspection sign-off are needed before the box-up certificate can be issued.',
  },
  'pssr-approval': {
    to: ['Eng. B. Al-Habsi, PSSR / Commissioning Lead <b.alhabsi@oqrpi.example>'],
    cc: ['L. D’Souza, HSE Lead <l.dsouza@oqrpi.example>', 'S. Al-Harthy, TA Event Manager <s.alharthy@oqrpi.example>'],
    greeting: 'Dear PSSR Lead,',
    ask: 'Please review the PSSR checklist items and punch list for the system and sign off, or record the open actions.',
  },
  'permit-overdue': {
    to: ['Permit Office Supervisor <permit.office@oqrpi.example>'],
    cc: ['L. D’Souza, HSE Lead <l.dsouza@oqrpi.example>'],
    greeting: 'Dear Permit Office,',
    ask: 'Please renew or close the permits listed. Work under an expired permit must stop until it is renewed.',
  },
  integration: {
    to: ['Planner group <ta.planners@oqrpi.example>'],
    cc: ['M. Al-Balushi, Planning Lead <m.albalushi@oqrpi.example>'],
    greeting: 'Dear Planning team,',
    ask: 'No action is needed unless the message says an update was rejected or failed. Failed messages are retried automatically and escalated to this group.',
  },
};

const trim = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export async function getMailPreview(alert: AlertItem): Promise<MailPreview> {
  const route = { ...ROUTING[alert.type] };
  // an SCF already approved by the Head of Turnaround Services is addressed to that role
  if (alert.type === 'scf-approval' && /Head of Turnaround Services/.test(alert.message)) {
    route.to = ['Dr. Y. Al-Lawati, Head of Turnaround Services <y.allawati@oqrpi.example>'];
    route.greeting = 'Dear Head of Turnaround Services,';
  }
  const sev = alert.severity === 'crit' ? 'URGENT' : alert.severity === 'warn' ? 'Action' : 'FYI';
  const preview: MailPreview = {
    from: 'TURNPOINT Notifications <no-reply@turnpoint.example>',
    to: route.to,
    cc: route.cc,
    subject: `[TURNPOINT] ${sev}: ${TYPE_LABEL[alert.type]}: ${trim(alert.message, 80)}`,
    greeting: route.greeting,
    paragraphs: [alert.message, route.ask],
    action: alert.link ? { label: 'Open in TURNPOINT', to: alert.link } : undefined,
    footer: 'You receive this message because you are the approver of record for this workflow. It was generated automatically by TURNPOINT. Replies are not monitored.',
  };
  return delay(preview);
}
