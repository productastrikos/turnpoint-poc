// Mock data for the Integration Hub (SAP S/4HANA + Primavera P6). Everything here is SIMULATED.
import type { IntegrationMessage, SapItem } from '../types/execution';

export const P6_PROJECT = {
  file: 'OQ_Sohar_TA2026_Baseline.xer',
  version: 'Primavera P6 v24.21 (UAT instance)',
  project: 'OQ-SOH-STO2026',
  dataDate: '2026-08-16',
  activities: 2486,
  relationships: 5912,
  resources: 38,
  calendars: 4,
  baselines: 3,
  wbsNodes: 214,
  constraints: 63,
};

export const P6_CALENDARS = [
  { name: '12h Day', detail: '06:00-18:00, 7 days, 12 h/day', activities: 1348 },
  { name: '12h Night', detail: '18:00-06:00, 7 days, 12 h/day', activities: 402 },
  { name: '7-day', detail: '24 h continuous (cure, purge, run-in)', activities: 531 },
  { name: '5-day', detail: 'Mon-Fri 07:00-16:00 (office / punch list)', activities: 205 },
];

export const P6_WBS = [
  { level: 0, code: 'OQ-SOH-STO2026', name: 'Sohar Refinery STO 2026' },
  { level: 1, code: '1', name: 'Shutdown & Decontamination' },
  { level: 1, code: '2', name: 'Unit 100 · Hydrocracker (HCU)' },
  { level: 1, code: '3', name: 'Unit 200 · Crude Distillation (CDU)' },
  { level: 1, code: '4', name: 'Unit 220 · Sulphur Recovery (SRU)' },
  { level: 1, code: '5', name: 'Unit 250 · Vacuum Distillation (VDU)' },
  { level: 1, code: '6', name: 'Unit 300 · FCC' },
  { level: 1, code: '7', name: 'Flare, Pipe Racks & Interconnecting' },
  { level: 1, code: '8', name: 'Start-up & Commissioning' },
];

const labour: [string, string, number][] = [
  ['L-PF', 'Pipefitter', 4.2], ['L-WLD', 'Welder 6G', 5.1], ['L-RIG', 'Rigger / Slinger', 3.8], ['L-SCF', 'Scaffolder', 3.2],
  ['L-INS', 'Insulator', 3.0], ['L-MF', 'Mechanical Fitter', 4.0], ['L-MW', 'Millwright (Rotating)', 4.8], ['L-IT', 'Instrument Technician', 4.6],
  ['L-EL', 'Electrician', 4.1], ['L-NDT', 'NDT Technician', 5.4], ['L-INSP', 'Inspector (Static)', 6.0], ['L-HSE', 'Safety Watch / Fire Watch', 2.9],
  ['L-FOR', 'Foreman', 5.2], ['L-CRO', 'Crane Operator', 4.9], ['L-HJ', 'Hydrojet Operator', 3.6], ['L-CAT', 'Catalyst Handler', 4.4],
  ['L-REF', 'Refractory Mason', 4.3], ['L-CIV', 'Civil Labourer', 2.6], ['L-PAI', 'Painter / Blaster', 3.1], ['L-COM', 'Commissioning Technician', 5.0],
  ['L-PLN', 'Planner / Scheduler', 6.5], ['L-SUP', 'Supervisor', 6.1],
];

const nonLabour: [string, string, number][] = [
  ['N-CR250', 'Crawler Crane 250 t', 310], ['N-CR80', 'Mobile Crane 80 t', 140], ['N-CR50', 'Mobile Crane 50 t', 95], ['N-MAN', 'Manlift / Boom Lift', 38],
  ['N-FLT', 'Forklift 5 t', 22], ['N-HJ', 'Hydrojet Unit 1000 bar', 120], ['N-VAC', 'Vacuum Truck', 65], ['N-WRG', 'Welding Rig (diesel)', 18],
  ['N-HTP', 'Hydrotest Pump Skid', 40], ['N-AIR', 'Air Compressor 750 cfm', 55], ['N-GEN', 'Generator 250 kVA', 48], ['N-LGT', 'Flood Lighting Tower', 12],
  ['N-N2', 'Nitrogen Purge Skid', 150], ['N-BTH', 'Bolt Tensioner Set', 30], ['N-FAB', 'Fabrication Shop Bay', 60], ['N-CTN', 'Site Container Office', 9],
];

export const P6_RESOURCES = [
  ...labour.map(([id, name, rate]) => ({ id, name, type: 'Labour' as const, unit: 'h', rate })),
  ...nonLabour.map(([id, name, rate]) => ({ id, name, type: 'Non-labour' as const, unit: 'day', rate })),
];

// ---------------- SAP ----------------

export const SAP_PENDING: SapItem[] = [
  { number: '100051901', kind: 'Notification', description: 'Leak at flange 8"-P-2204, E-204 outlet', funcLoc: 'SOH-CDU-E204-OUT', equipment: 'E-204', priority: 2, plannerGroup: 'MPG-200 Static', estCostOMR: 6_500, manhours: 120, discipline: 'Process', area: 'Unit 200', reportedBy: 'K. Rao', createdOn: '2026-08-13' },
  { number: '100051915', kind: 'Notification', description: 'R-101 thermowell TW-1103 replacement (erosion)', funcLoc: 'SOH-HCU-R101-TW1103', equipment: 'R-101', priority: 3, plannerGroup: 'MPG-100 Instr', estCostOMR: 4_200, manhours: 70, discipline: 'Instrumentation', area: 'Unit 100', reportedBy: 'S. Kumar', createdOn: '2026-08-13' },
  { number: '100051928', kind: 'Notification', description: 'Inspect V-102 nozzles N3-N5 (wall loss reported)', funcLoc: 'SOH-CDU-V102', equipment: 'V-102', priority: 2, plannerGroup: 'MPG-200 Static', estCostOMR: 15_800, manhours: 300, discipline: 'Inspection', area: 'Unit 200', reportedBy: 'A. Hinai', createdOn: '2026-08-14' },
  { number: '100051933', kind: 'Notification', description: 'FCC regenerator expansion joint EJ-3 bellows crack', funcLoc: 'SOH-FCC-R301-EJ3', equipment: 'R-301', priority: 1, plannerGroup: 'MPG-300 Static', estCostOMR: 38_000, manhours: 540, discipline: 'Inspection', area: 'Unit 300', reportedBy: 'T. Said', createdOn: '2026-08-14' },
  { number: '4000033440', kind: 'Work Order', description: 'P-205 crude charge pump vibration trend analysis and bearing check', funcLoc: 'SOH-CDU-P205', equipment: 'P-205', priority: 3, plannerGroup: 'MPG-200 Rotating', estCostOMR: 9_800, manhours: 160, discipline: 'Rotating Equipment', area: 'Unit 200', reportedBy: 'R. Fernandes', createdOn: '2026-08-12' },
  { number: '4000033447', kind: 'Work Order', description: 'Replace sour water stripper reboiler gaskets (E-221)', funcLoc: 'SOH-SRU-E221', equipment: 'E-221', priority: 3, plannerGroup: 'MPG-220 Static', estCostOMR: 7_400, manhours: 110, discipline: 'Process', area: 'Unit 220', reportedBy: 'K. Rao', createdOn: '2026-08-12' },
  { number: '100051940', kind: 'Notification', description: 'MCC-3 cubicle 14 overheating, thermography hotspot', funcLoc: 'SOH-FCC-MCC3-14', equipment: 'MCC-3', priority: 2, plannerGroup: 'MPG-300 Elec', estCostOMR: 5_600, manhours: 90, discipline: 'Electrical', area: 'Unit 300', reportedBy: 'T. Said', createdOn: '2026-08-15' },
  { number: '100051946', kind: 'Notification', description: 'Flare knock-out drum level transmitter LT-4012 drifting', funcLoc: 'SOH-FLR-KOD-LT4012', equipment: 'LT-4012', priority: 2, plannerGroup: 'MPG-400 Instr', estCostOMR: 2_900, manhours: 40, discipline: 'Instrumentation', area: 'Flare System', reportedBy: 'S. Kumar', createdOn: '2026-08-15' },
  { number: '4000033455', kind: 'Work Order', description: 'Pipe rack 4 corrosion-under-insulation survey and repair, 120 m', funcLoc: 'SOH-PR4-LINE-CUI', equipment: 'PR4-LINES', priority: 3, plannerGroup: 'MPG-100 Static', estCostOMR: 21_000, manhours: 420, discipline: 'Inspection', area: 'Pipe Rack 4', reportedBy: 'A. Hinai', createdOn: '2026-08-11' },
  { number: '100051952', kind: 'Notification', description: 'Handrail missing at T-251 platform level 3', funcLoc: 'SOH-VDU-T251-PL3', equipment: 'T-251', priority: 1, plannerGroup: 'MPG-250 Civil', estCostOMR: 1_800, manhours: 30, discipline: 'Civil', area: 'Unit 250', reportedBy: 'L. D’Souza', createdOn: '2026-08-15' },
  { number: '4000033461', kind: 'Work Order', description: 'F-101 flue gas damper actuator overhaul', funcLoc: 'SOH-HCU-F101-DMP', equipment: 'F-101', priority: 3, plannerGroup: 'MPG-100 Instr', estCostOMR: 11_500, manhours: 180, discipline: 'Instrumentation', area: 'Unit 100', reportedBy: 'S. Kumar', createdOn: '2026-08-10' },
  { number: '100051958', kind: 'Notification', description: 'Cooling water line 12"-CW-1102 external corrosion at supports', funcLoc: 'SOH-CDU-CW1102', equipment: 'CW-1102', priority: 3, plannerGroup: 'MPG-200 Static', estCostOMR: 8_700, manhours: 140, discipline: 'Process', area: 'Unit 200', reportedBy: 'K. Rao', createdOn: '2026-08-14' },
  { number: '4000033468', kind: 'Work Order', description: 'K-301 main air blower lube oil cooler tube leak test', funcLoc: 'SOH-FCC-K301-LOC', equipment: 'K-301', priority: 2, plannerGroup: 'MPG-300 Rotating', estCostOMR: 6_200, manhours: 95, discipline: 'Rotating Equipment', area: 'Unit 300', reportedBy: 'T. Said', createdOn: '2026-08-11' },
  { number: '100051964', kind: 'Notification', description: 'Install additional sampling point on hydrocracker recycle gas line', funcLoc: 'SOH-HCU-RG-SP', equipment: 'RG-LINE', priority: 4, plannerGroup: 'MPG-100 Static', estCostOMR: 3_400, manhours: 60, discipline: 'Process', area: 'Unit 100', reportedBy: 'K. Rao', createdOn: '2026-08-13' },
  { number: '4000033472', kind: 'Work Order', description: 'SRU incinerator burner flame scanner replacement', funcLoc: 'SOH-SRU-INC-FS', equipment: 'INC-221', priority: 2, plannerGroup: 'MPG-220 Instr', estCostOMR: 4_800, manhours: 55, discipline: 'Instrumentation', area: 'Unit 220', reportedBy: 'S. Kumar', createdOn: '2026-08-12' },
  { number: '100051970', kind: 'Notification', description: 'T-201 overhead line 24"-P-2001 spool CUI, wall loss 38%', funcLoc: 'SOH-CDU-T201-OVH', equipment: 'T-201', priority: 1, plannerGroup: 'MPG-200 Static', estCostOMR: 54_000, manhours: 900, discipline: 'Process', area: 'Unit 200', reportedBy: 'K. Rao', createdOn: '2026-08-15' },
  { number: '4000033479', kind: 'Work Order', description: 'Replace Unit 300 emergency lighting battery banks', funcLoc: 'SOH-FCC-EL-BB', equipment: 'EL-300', priority: 4, plannerGroup: 'MPG-300 Elec', estCostOMR: 3_100, manhours: 50, discipline: 'Electrical', area: 'Unit 300', reportedBy: 'T. Said', createdOn: '2026-08-10' },
  { number: '100051977', kind: 'Notification', description: 'Heat tracing failure on instrument impulse lines, Unit 250', funcLoc: 'SOH-VDU-HT-IMP', equipment: 'HT-250', priority: 3, plannerGroup: 'MPG-250 Elec', estCostOMR: 2_200, manhours: 45, discipline: 'Electrical', area: 'Unit 250', reportedBy: 'T. Said', createdOn: '2026-08-14' },
  { number: '4000033485', kind: 'Work Order', description: 'HCU recycle gas compressor K-101 seal gas filter replacement', funcLoc: 'SOH-HCU-K101-SGF', equipment: 'K-101', priority: 3, plannerGroup: 'MPG-100 Rotating', estCostOMR: 5_300, manhours: 80, discipline: 'Rotating Equipment', area: 'Unit 100', reportedBy: 'R. Fernandes', createdOn: '2026-08-11' },
];

export const SAP_MAPPINGS = [
  { sto: 'Scope item', sap: 'Maintenance Notification', iface: 'API_MAINTNOTIFICATION (OData V2)', direction: 'Pull + status push', trigger: 'Scheduled (15 min) + on status change' },
  { sto: 'Work pack / job', sap: 'Maintenance Order + operations', iface: 'API_MAINTENANCEORDER (OData V2)', direction: 'Bi-directional', trigger: 'Event-driven (freeze, release, confirmation)' },
  { sto: 'Equipment, flange, valve', sap: 'Equipment master, Functional Location', iface: 'Equipment / FuncLoc read API', direction: 'Read', trigger: 'Scheduled (nightly)' },
  { sto: 'BOM / MTO line', sap: 'Material, Reservation, Purchase Requisition', iface: 'Material / Reservation / PR APIs', direction: 'Read + create PR', trigger: 'On BOM approval' },
  { sto: 'Budget / Sub-WBS', sap: 'PS WBS element, cost (actuals / commitments)', iface: 'Project / WBS and cost APIs', direction: 'Read actuals, push approved changes', trigger: 'Scheduled (daily) + on approval' },
  { sto: 'SCF, discovery job', sap: 'New Notification / Order', iface: 'API_MAINTNOTIFICATION create', direction: 'Create', trigger: 'On approval' },
  { sto: 'Scope freeze, readiness, MC certificate', sap: 'System / user status', iface: 'Order status update (via CPI)', direction: 'Push', trigger: 'Event-driven' },
];

export const SAP_APIS = [
  { name: 'API_MAINTNOTIFICATION', desc: 'Maintenance Notification: read open notifications, create from SCF / discovery job, update status' },
  { name: 'API_MAINTENANCEORDER', desc: 'Maintenance Order: read work orders and operations, release, confirm, update status' },
  { name: 'Equipment / Functional Location', desc: 'Read equipment master and functional location hierarchy for tag validation' },
  { name: 'Material / Reservation / PR', desc: 'Read stock, create reservations, raise purchase requisitions from the approved BOM' },
  { name: 'Project System (WBS) and cost', desc: 'Read WBS elements, commitments and actuals; push approved budget changes' },
];

export const P6_ENDPOINTS = [
  { method: 'GET', path: '/activity', use: 'Read activities, dates, durations, % complete' },
  { method: 'PUT', path: '/activity', use: 'Write actual start / finish, progress, remaining duration' },
  { method: 'GET', path: '/relationship', use: 'Read predecessor / successor logic and lags' },
  { method: 'GET', path: '/resourceAssignment', use: 'Read labour and non-labour assignments (BLU / ALU / RLU)' },
  { method: 'GET', path: '/wbs', use: 'Read the WBS tree' },
  { method: 'GET', path: '/calendar', use: 'Read calendars (12h day, 12h night, 7-day, 5-day)' },
  { method: 'GET', path: '/baseline', use: 'Read project baselines for variance' },
];

export const P6_SAMPLE_REQUEST = `PUT /p6ws/rest/v1/activity
Content-Type: application/json
Authorization: Bearer <token>

{
  "ObjectId": 482913,
  "Id": "CDU-1020",
  "PercentComplete": 40.0,
  "ActualStartDate": "2026-08-10T06:00:00",
  "RemainingDuration": 12.0,
  "DataDate": "2026-08-16T08:00:00"
}`;

export const P6_SAMPLE_RESPONSE = `HTTP/1.1 200 OK

{
  "ObjectId": 482913,
  "Id": "CDU-1020",
  "Name": "T-201 Tray Repair - Section B",
  "PercentComplete": 40.0,
  "RemainingDuration": 12.0,
  "RemainingLabor": 840.0,
  "ActualLabor": 560.0,
  "FinishDate": "2026-08-27T18:00:00"
}`;

export const SAP_SAMPLE_REQUEST = `PATCH /sap/opu/odata/sap/API_MAINTENANCEORDER/A_MaintenanceOrder('4000033201')
Authorization: Bearer <token>   (OAuth 2.0, mTLS via Integration Suite)
Content-Type: application/json

{
  "MaintenanceOrderStatus": "REL",
  "UserStatus": "SFRZ",
  "ZZ_STO_SCOPE_FROZEN": true,
  "ZZ_STO_PACK_ID": "WP-2201"
}`;

export const SAP_SAMPLE_RESPONSE = `HTTP/1.1 204 No Content
x-csrf-token: validated
sap-message: {"code":"IWO/001","message":"Order status updated","severity":"success"}`;

// ---------------- monitoring: seeded message log ----------------

const mk = (
  id: string,
  at: string,
  system: IntegrationMessage['system'],
  direction: IntegrationMessage['direction'],
  object: string,
  key: string,
  status: IntegrationMessage['status'],
  latencyMs: number,
  channel: string,
  note?: string
): IntegrationMessage => ({
  id,
  at,
  system,
  direction,
  object,
  key,
  status,
  latencyMs,
  channel,
  note,
  request:
    system === 'P6'
      ? JSON.stringify({ endpoint: `${direction === 'Inbound' ? 'GET' : 'PUT'} /p6ws/rest/v1/${object.toLowerCase()}`, Id: key, DataDate: '2026-08-16T08:00:00' }, null, 2)
      : JSON.stringify({ service: object.includes('Order') ? 'API_MAINTENANCEORDER' : 'API_MAINTNOTIFICATION', key, operation: direction === 'Inbound' ? 'READ' : 'UPDATE_STATUS', via: 'SAP Integration Suite (CPI)' }, null, 2),
  response:
    status === 'Failed'
      ? JSON.stringify({ error: { code: key.startsWith('400') ? 'IWO/410' : 'WBS/204', message: note ?? 'Rejected by target system' } }, null, 2)
      : status === 'Retrying'
        ? JSON.stringify({ status: 'RETRY_SCHEDULED', attempt: 2, nextAttemptInSeconds: 60 }, null, 2)
        : JSON.stringify({ status: 'OK', processed: 1, latencyMs }, null, 2),
});

export const SEED_MESSAGES: IntegrationMessage[] = [
  mk('MSG-0412', '2026-08-16T08:02:11', 'SAP', 'Outbound', 'Maintenance Order status', '4000033201', 'Delivered', 412, 'OData V2 / OAuth 2.0 + mTLS'),
  mk('MSG-0411', '2026-08-16T08:01:48', 'P6', 'Inbound', 'Activity', 'CDU-1020', 'Delivered', 188, 'P6 REST'),
  mk('MSG-0410', '2026-08-16T07:58:30', 'SAP', 'Inbound', 'Maintenance Notification', '100051970', 'Delivered', 356, 'OData V2 / OAuth 2.0 + mTLS'),
  mk('MSG-0409', '2026-08-16T07:55:02', 'SAP', 'Outbound', 'Maintenance Order status', '4000033215', 'Failed', 1260, 'OData V2 / OAuth 2.0 + mTLS', 'Order is locked by another user in SAP (user LMAINT01). Will retry, then raise to the planner group.'),
  mk('MSG-0408', '2026-08-16T07:52:40', 'P6', 'Outbound', 'Activity', 'FCC-2010', 'Retrying', 940, 'P6 REST', 'P6 returned 503 while the nightly summarise job was running. Retry 2 of 5 scheduled.'),
  mk('MSG-0407', '2026-08-16T07:47:19', 'SAP', 'Outbound', 'Reservation', 'RS-0000731', 'Auto-resolved', 780, 'OData V2 / OAuth 2.0 + mTLS', 'Material was locked in SAP (MM60 session). Auto-retried twice, then delivered without manual intervention.'),
  mk('MSG-0406', '2026-08-16T07:44:05', 'P6', 'Inbound', 'Resource assignment', 'CDU-2020', 'Delivered', 221, 'P6 REST'),
  mk('MSG-0405', '2026-08-16T07:40:33', 'SAP', 'Inbound', 'Equipment', 'E-204', 'Delivered', 204, 'OData V2 / OAuth 2.0 + mTLS'),
  mk('MSG-0404', '2026-08-16T07:36:12', 'P6', 'Outbound', 'Activity', 'HCU-1030', 'Failed', 1530, 'P6 REST', 'Activity HCU-1030 has a start constraint that conflicts with the posted actual start. P6 owns dates and logic, so the update was rejected and the planner was notified.'),
  mk('MSG-0403', '2026-08-16T07:30:50', 'SAP', 'Outbound', 'WBS cost commitment', 'WBS-7000', 'Auto-resolved', 690, 'OData V2 / OAuth 2.0 + mTLS', 'Cost element 410100 was not open for the period. Re-posted to the correct period automatically.'),
  mk('MSG-0402', '2026-08-16T07:21:44', 'SAP', 'Inbound', 'Maintenance Order', '4000033187', 'Delivered', 298, 'OData V2 / OAuth 2.0 + mTLS'),
  mk('MSG-0401', '2026-08-16T07:15:27', 'P6', 'Outbound', 'Activity', 'CDU-3020', 'Delivered', 176, 'P6 REST'),
  mk('MSG-0400', '2026-08-16T07:08:03', 'SAP', 'Outbound', 'Maintenance Order status', '4000033204', 'Delivered', 388, 'OData V2 / OAuth 2.0 + mTLS'),
  mk('MSG-0399', '2026-08-16T07:01:51', 'P6', 'Inbound', 'WBS', 'OQ-SOH-STO2026', 'Delivered', 142, 'P6 REST'),
  mk('MSG-0398', '2026-08-16T06:54:16', 'SAP', 'Outbound', 'Maintenance Order status', '4000033230', 'Failed', 1480, 'OData V2 / OAuth 2.0 + mTLS', 'Status SFRZ is not allowed from system status CNF in the SAP status profile. Mapping rule to be corrected by SAP basis team.'),
  mk('MSG-0397', '2026-08-16T06:47:39', 'P6', 'Inbound', 'Calendar', '12h Night', 'Delivered', 119, 'P6 REST'),
  mk('MSG-0396', '2026-08-16T06:40:08', 'SAP', 'Inbound', 'Purchase Requisition', '10012345', 'Delivered', 332, 'OData V2 / OAuth 2.0 + mTLS'),
  mk('MSG-0395', '2026-08-16T06:31:22', 'P6', 'Outbound', 'Activity', 'FLR-1020', 'Delivered', 163, 'P6 REST'),
];
