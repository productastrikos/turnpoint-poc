// The 34 dry-run test scenarios from SOW section 16 (pp. 45-48), with an honest status for this POC.
//   Pass       = the behaviour genuinely runs in this app on mock data (state changes, calculations).
//   Simulated  = shown end to end, but files / systems / data are generated, not real.
//   Planned    = not demonstrated in this POC.
export type DryRunStatus = 'Pass' | 'Simulated' | 'Planned';

export interface DryRunScenario {
  sr: number;
  category: string;
  scenario: string;
  status: DryRunStatus;
  to: string;
  where: string;
}

export const DRY_RUN: DryRunScenario[] = [
  { sr: 1, category: 'Data sync STO <-> P6', scenario: 'Contractor dry run: import, field-simulate updates, export updated XER', status: 'Simulated', to: '/integrations?tab=p6', where: 'P6 round-trip wizard' },
  { sr: 2, category: 'Data sync STO <-> P6', scenario: 'Import .xer: tasks, timestamps, relationships, constraints, resources, calendars', status: 'Simulated', to: '/integrations?tab=p6', where: 'Wizard step 1 (sample XER summary + preview)' },
  { sr: 3, category: 'Data sync STO <-> P6', scenario: 'Export .xer: actual timestamps, progress, remaining duration, ALU, RLU', status: 'Simulated', to: '/integrations?tab=p6', where: 'Wizard step 4 (generated sample file)' },
  { sr: 4, category: 'Activity ID', scenario: 'Pull activity IDs from .xer and show against each activity', status: 'Pass', to: '/critical-path', where: 'P6 Activity ID chips on Critical Path, Lookahead, Scope, Work Packs' },
  { sr: 5, category: 'Resources', scenario: 'Import labour and non-labour resources; view against each activity', status: 'Simulated', to: '/integrations?tab=p6', where: 'Wizard step 1 (resource panel)' },
  { sr: 6, category: 'Resources', scenario: 'Labour and non-labour resources are read-only on the STO platform', status: 'Pass', to: '/integrations?tab=p6', where: 'Resource master shows lock icons, no edit controls' },
  { sr: 7, category: 'Resources', scenario: 'Auto-compute BLU, ALU, RLU from task progress', status: 'Pass', to: '/integrations?tab=p6', where: 'Wizard step 3 (calculated live)' },
  { sr: 8, category: 'Resources', scenario: 'All imported resources visible at project level in a resource master view', status: 'Simulated', to: '/integrations?tab=p6', where: 'Resource master panel (38 resources)' },
  { sr: 9, category: 'Resources', scenario: 'S-curve calculated from man-hours (BLU and ALU)', status: 'Pass', to: '/kpis?tab=scurve', where: 'Man-hour S-curve' },
  { sr: 10, category: 'Resources', scenario: 'Histogram: day-wise labour and non-labour BLU vs ALU', status: 'Pass', to: '/mobilization', where: 'Resource histogram, plan vs actual' },
  { sr: 11, category: 'Progress calculation', scenario: 'Planned progress at activity level uses BLU; WBS level uses resource cost', status: 'Simulated', to: '/integrations?tab=p6', where: 'Wizard step 3 (planned % column)' },
  { sr: 12, category: 'Progress calculation', scenario: 'Est. end = data date + remaining duration, remaining = (1 - % progress) x planned duration', status: 'Pass', to: '/integrations?tab=p6', where: 'Wizard step 3' },
  { sr: 13, category: 'Progress calculation', scenario: 'Delay/gain propagation to successors and asset end task (no sequence violation)', status: 'Pass', to: '/integrations?tab=p6', where: 'Wizard step 3 (successor impact, asset end tasks)' },
  { sr: 14, category: 'Progress calculation', scenario: 'Delay/gain/float when execution violates planned sequence', status: 'Planned', to: '/integrations?tab=dryrun', where: 'Not demonstrated in this POC' },
  { sr: 15, category: 'QA/QC workflow', scenario: 'Heat exchanger inspection workflow, pre-cleaning to final inspection: role approval, stage control, signature, remarks, printable report, rework', status: 'Pass', to: '/qaqc', where: 'QA/QC exchanger inspection workflow' },
  { sr: 16, category: 'QA/QC workflow', scenario: 'Asset-wise inspection status updates automatically from entered data', status: 'Pass', to: '/qaqc', where: 'Status rolls up from stage entries' },
  { sr: 17, category: 'QA/QC workflow', scenario: 'Quick view: REQUESTED but NOT DONE, and DONE but CLEARANCE NOT GIVEN', status: 'Pass', to: '/qaqc', where: 'Quick-view filters' },
  { sr: 18, category: 'QA/QC workflow', scenario: 'Rework tracking for all stages, not only hydrotest and final', status: 'Pass', to: '/qaqc', where: 'Rework at any stage' },
  { sr: 19, category: 'QA/QC workflow', scenario: 'Extract all incomplete inspections and why they are not completed', status: 'Pass', to: '/qaqc', where: 'Pending-reason column + filter' },
  { sr: 20, category: 'QA/QC workflow', scenario: 'Exchanger sub-types and their components', status: 'Pass', to: '/qaqc', where: 'Sub-type and component list' },
  { sr: 21, category: 'QA/QC workflow', scenario: 'Track request and inspection approval at component level', status: 'Pass', to: '/qaqc', where: 'Component rows in the inspection drawer' },
  { sr: 22, category: 'QA/QC workflow', scenario: 'Configurable filters to extract inspection tasks by status', status: 'Pass', to: '/qaqc', where: 'Status filters' },
  { sr: 23, category: 'QA/QC workflow', scenario: 'Configure rework in all stages', status: 'Pass', to: '/qaqc', where: 'Rework action on every stage' },
  { sr: 24, category: 'QA/QC workflow', scenario: 'Extract remarks entered across inspection stages for all assets', status: 'Pass', to: '/qaqc?tab=remarks', where: 'Remarks register' },
  { sr: 25, category: 'SCF process', scenario: 'Selected vendors see SCF details and give cost inputs at evaluation stage, with privacy on quotes', status: 'Simulated', to: '/scf', where: 'Vendor input panel on the SCF queue' },
  { sr: 26, category: 'Analytical dashboard', scenario: 'Man-hour S-curve at overall project level', status: 'Pass', to: '/kpis?tab=scurve', where: 'Man-hour S-curve' },
  { sr: 27, category: 'Analytical dashboard', scenario: 'Man-hour S-curve at equipment level', status: 'Pass', to: '/kpis?tab=scurve', where: 'Equipment selector' },
  { sr: 28, category: 'Analytical dashboard', scenario: 'Man-hour-based overall % actual progress', status: 'Pass', to: '/kpis?tab=scurve', where: 'Headline progress tile' },
  { sr: 29, category: 'Analytical dashboard', scenario: '% progress at unit, area and asset level', status: 'Pass', to: '/kpis?tab=progress', where: 'Progress by level' },
  { sr: 30, category: 'Analytical dashboard', scenario: 'Milestone / handover status per asset (Handover by Ops, Blinding, Opening) in one view', status: 'Pass', to: '/area-handover?tab=milestones', where: 'Asset milestone matrix' },
  { sr: 31, category: 'Analytical dashboard', scenario: 'Filter and sort activities by asset type, tag, criticality, area, delay/gain, timestamps', status: 'Pass', to: '/lookahead?tab=activities', where: 'Activity table filters' },
  { sr: 32, category: 'Reports', scenario: 'Reports generated in OQ-finalised formats', status: 'Planned', to: '/integrations?tab=dryrun', where: 'Formats to be finalised with OQ' },
  { sr: 33, category: 'Planned progress', scenario: 'Day-wise planned progress verified against P6', status: 'Simulated', to: '/integrations?tab=p6', where: 'Wizard step 3 (planned vs actual column)' },
  { sr: 34, category: 'Estimated finish', scenario: 'How estimated finish is calculated when there is delay/gain', status: 'Pass', to: '/integrations?tab=p6', where: 'Wizard step 3 (formula and result)' },
];

export const OWNERSHIP = [
  { field: 'Activity dates, logic, constraints, calendars', p6: 'Owner', sto: 'Read', sap: '-', rule: 'P6 wins. STO never edits dates; it shows the forecast.' },
  { field: 'Resources and budgeted units (BLU)', p6: 'Owner', sto: 'Read-only', sap: '-', rule: 'P6 wins. Resources are read-only in STO.' },
  { field: 'Progress %, actual start / finish, ALU', p6: 'Receives', sto: 'Owner', sap: 'Confirmation', rule: 'STO wins. Field progress is written to P6 and confirmed to SAP.' },
  { field: 'Remaining duration, RLU, forecast finish', p6: 'Recalculates', sto: 'Shows', sap: '-', rule: 'P6 recalculates on import, STO displays the result.' },
  { field: 'Cost, commitments, actuals, WBS', p6: '-', sto: 'Read', sap: 'Owner', rule: 'SAP wins. Approved budget changes are pushed, actuals are read back.' },
  { field: 'Materials, reservations, purchase requisitions', p6: '-', sto: 'Read + create PR', sap: 'Owner', rule: 'SAP wins on stock and PO status.' },
  { field: 'Order / notification status, scope freeze, MC status', p6: '-', sto: 'Initiates', sap: 'Owner', rule: 'STO pushes the event, SAP status profile validates it.' },
  { field: 'Scope item description, risk, gate approvals', p6: '-', sto: 'Owner', sap: 'Receives', rule: 'STO wins. SAP keeps the original notification text.' },
];
