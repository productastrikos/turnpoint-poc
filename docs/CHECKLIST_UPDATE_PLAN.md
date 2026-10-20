# TURNPOINT — Checklist Update Plan
Source: `../../TA Digitalization DEMO Check List 7 Oct2026.xlsx` (sheet "TA Check List", 97 numbered line items, 8 sections incl. document deliverables).
Goal: every checklist line has a visible, clickable home in the frontend, running on fake data, so leadership can see "the final app".
Constraint: **frontend only, mock data, no backend.** Keep the existing service-layer pattern (`src/services` -> `src/mocks`, async functions returning Promises).

## 0. Where the app is today (gap analysis)
Built (16 pages): Command Dashboard, Critical Path, Change/MOC, Risk Register, Discovery Jobs, SCF, Alerts, Discipline Dashboards,
Scope & Work Requests (3-gate), Flange Mgmt, Equipment/Valve Tracking, Budget, Materials/MTO, Daily Newsletter, Mobile Capture, AI Panel.
Navigation is organised by build tier ("Tier 1/2/3") and a SOW phase spine (Scoping -> Planning -> Scheduling -> Execution -> Compliance -> Startup).
**Problem:** the checklist is organised by TA lifecycle section, not by our tiers, and ~75% of its lines have no page at all.

## 1. Structural changes (do first)
1. **Re-organise nav to the checklist's sections.** Sidebar sections: `Platform & General`, `TA Event Initiation`, `Scoping & Worklist Frozen`,
   `Planning, Procurement & Contracting`, `Pre-TA`, `Execution`, `Close-Out & Continuous Improvement`. Remove the "Tier" labels from the UI.
2. **Replace the phase spine** with the checklist stages: `Initiation -> Scoping -> Planning & Procurement -> Pre-TA -> Execution -> Close-Out`
   (update `Phase` type, `PHASES`, `PHASE_LANDING`, module `phases`). Clicking a stage filters the sidebar and lands on that stage's hero page.
3. **Checklist Coverage page** (`/coverage`): table of all 97 checklist items -> section, status (Built / Simulated / Integration point), and a link to the route.
   Driven by a single `src/app/checklistRegistry.ts`. This is the "we read every line" proof for leadership. Must be generated from the same data used for nav, so it can't drift.
4. **Reusable building blocks** (so ~35 new pages stay cheap and consistent): 
   - `TrackerPage` — config-driven page: title, KPI tiles, filter chips, sortable table with status chips + progress bars, optional detail drawer and a chart slot. Used for most "Mgmt/Tracking" items.
   - `DataTable`, `Drawer`, `Tabs`, `ProgressBar`, `StatusChip`, `Timeline`, `OrgChart`, `Gauge/Donut`, `Heatmap`, `Gantt` (simple SVG, no chart lib) in `src/components`.
   - Fake-data helper in `src/mocks/_gen.ts` (seeded PRNG so numbers are stable across reloads).
5. **Global**: active-TA selector in TopBar (see item G1), role switcher already exists (`RoleContext`) — wire to RBAC (G4). Global search box in TopBar (G14).
6. **Mock-vs-real honesty** (project rule): any simulated integration/AI/load-test surface carries a small `Simulated` / `Illustrative` badge. Add a `docs/MOCK_VS_REAL.md` table.

## 2. Checklist -> screen map
Legend: **NEW** new page, **EXT** extend existing page, **OK** already satisfied (just re-home in nav / polish).

### Document deliverables (D1-D6) -> `/platform` "Platform, Performance & Integrations" (NEW, tabs)
- D1 Implementation plan to 2028: Gantt of upcoming TAs 2026-2028 with phases/milestones (Tab "Roadmap").
- D2/D3/D4 1500+ users, <=1 s response, load-test evidence: Tab "Performance" — illustrative load-test report (users ramp chart, p50/p95/p99 latency, error rate, pass/fail vs SLA), badge `Illustrative`.
- D5 SAP S/4HANA bi-directional, D6 P6 two-way sync: Tab "Integrations" — connection cards, last-sync time, sync log, field-mapping table, simulated "Sync now" button with progress + toast, badge `Simulated`.

### General items (G1-G14)
| ID | Item | Screen |
|---|---|---|
| G1 | Multi-TA portfolio, 10-yr plan, budget, duration | NEW `/portfolio`: 10-year TA business plan timeline (2026-2035) + cards/table with budget, duration, status; selecting a TA sets the **active TA** in the TopBar selector and rescales dashboard headline numbers |
| G2 | Whole lifecycle initiation -> close-out | OK via new phase spine + nav |
| G3 | TA Office organization setup | NEW `/organization` (tabs: TA Office, Execution Organogram, Contractor Twin Org) — also satisfies I1, X1, X2 |
| G4 | RBAC | NEW `/access-control`: role x module permission matrix, user list; role switcher in TopBar actually hides/locks modules ("Restricted for role" state) |
| G5 | P6 two-way sync | -> `/platform` Integrations tab (D6) |
| G6 | Mobile 100% offline via SIM | EXT `/mobile-capture`: Online/Offline toggle, SIM signal indicator, queued actions list, "Sync when online" animation, progress update + approval + capture flows |
| G7 | Attendance (plan vs actual manpower, both shifts) | NEW `/attendance`: day/night shift planned vs actual chart, by contractor/discipline, headcount check-in feed; same numbers feed Daily Newsletter |
| G8 | P&ID & Isometric analyzer | NEW `/pid-analyzer`: mock P&ID drawing (inline SVG), "Analyze" button -> animated extraction -> equipment/line/valve table -> "Push to MTO" |
| G9 | Performance reporting dashboard & KPIs | NEW `/kpis` (TA KPI scorecard: safety, schedule SPI, cost CPI, quality, manpower; trend sparklines; targets) |
| G10 | Budget (planned/committed/actual/forecast, per Sub-WBS, base vs current estimate, variable vs fixed logistics, approved extra jobs/scope changes incorporated) | EXT `/budget`: add variable-vs-fixed split, base-vs-current estimate trend, "approved SCFs/discovery jobs included" bridge/waterfall |
| G11 | Overall STO readiness | NEW `/readiness`: composite readiness score + per-stage/per-discipline readiness gauges + gaps list |
| G12 | AI risk prediction | EXT `/ai-panel` tab "Risk Prediction" (+ card on Command Dashboard) |
| G13 | AI chatbot | EXT `/ai-panel` tab "Assistant" — more scripted Q&A (10+ prompts incl. checklist-flavoured ones), floating launcher available on every page |
| G14 | User friendly | Global search (routes + records), consistent empty/loading states, keyboard shortcut hint, responsive down to 1280x720 |

### TA Event Initiation (I1-I6)
| ID | Item | Screen |
|---|---|---|
| I1 | TA event organization planning & preparation setup | `/organization` (G3) |
| I2 | Risk register + steering-committee progress/close-out dashboards | EXT `/risk-register`: add Steering Committee view tab (burndown of open risks, mitigation progress, close-out status) |
| I3 | TA milestones | NEW `/milestones` tab "Milestones" (timeline with RAG) |
| I4 | TA event tracker (events, milestones, issues) | `/milestones` tabs "Event Tracker" |
| I5 | TA strategy document | NEW `/strategy`: structured digital strategy doc viewer (sections, version, approval stamp, linked KPIs), "Download PDF" is a toast only |
| I6 | Previous TA lessons learned digitised with dashboards and actions closed out | NEW `/lessons-learned` (also Close-Out C1): by-category chart, action tracker with owner/due/status, carry-forward to current TA |

### Scoping & Worklist Frozen (S1-S9) -> restructure `/scope-approvals` into `/scope` "Scope & Worklist" with tabs (keep old path as redirect)
| ID | Item | Tab / feature |
|---|---|---|
| S1 | Comprehensive risk assessment, risk-based scope optimisation | Tab "Risk-Based Optimisation": risk matrix heatmap x scope items; "optimise" suggests defer/keep |
| S2 | Mandatory-field enforcement in scope generation | "New scope item" form with required-field validation, inline errors, completeness meter |
| S3 | Create via manual, bulk upload, Excel import, SAP notifications/work orders; configurable multi-gate | Create dialog with 4 source tabs (simulated file drop / SAP pull producing rows); gate config panel |
| S4 | Budgetary estimates at scope level | Cost estimate column + rollup in worklist |
| S5 | Three-gate approval (Area Ops Focal Point -> Head of Area Ops -> VP Asset Ops) | OK existing; keep and polish, show TA/Non-TA diversion at gate 1 |
| S6 | Scope challenge basis: risk + cost + manhours | Tab "Scope Challenge" scatter/bubble (risk vs cost, size = manhours) |
| S7 | Scope variation tracking before/after freeze | Tab "Variations": additions/deletions/changes with originator, pre-/post-freeze flag, net cost+manhour delta |
| S8 | Digitally approved scope & Scope Freeze Certificate | Tab "Freeze Certificate": printable-looking certificate, signatories, digital-signature stamp, freeze date |
| S9 | AI duplicate scope detection | Panel in worklist: flagged pairs with similarity %, merge/dismiss actions |

### Planning, Procurement & Contracting (P1-P9)
| ID | Item | Screen |
|---|---|---|
| P1 | Consolidated MTO segregated Long/Medium/Short lead | EXT `/materials` (exists; ensure all 3 categories shown with the exact thresholds >6, 4-6, <4 months) |
| P2 | Flange management digitisation | OK `/flange-tracking` |
| P3 | BOM with customisable approval flow + procurement alerts by lead time | NEW `/bom`: BOM table, approval-flow stepper (configurable steps), alert banner when order-by date approaches |
| P4 | Work pack management | NEW `/work-packs`: work pack list, readiness checklist (scope, drawings, materials, permits, resources), kanban status |
| P5 | Digitalise QA/QC/acceptance workflows | NEW `/qaqc`: inspection request -> inspection -> acceptance workflow board, hold/witness points, pass/fail |
| P6 | Systemisation & prioritisation of worklist | prioritisation score column/rank in `/scope` worklist + "Priority Matrix" |
| P7 | Material tracking & expediting dashboard | NEW `/material-tracking` (arrival status, ETA vs need-date, expedite flags, map-free) |
| P8 | Procurement tracking & expediting | `/material-tracking` tab "Procurement" (PR -> PO -> shipped -> received funnel, vendor delays) |
| P9 | Inspection Test Plan tracking after PO issuance | `/qaqc` tab "ITP Tracking" |

### Pre-TA (R1-R14) — all built with the `TrackerPage` template, route `/pre-ta/<slug>`
R1 Scaffold (`scaffold`), R2 Isolation (`isolation`), R3 Lookahead plan dashboard (NEW custom `/lookahead`, 2-4 week lookahead grid by day/discipline),
R4 Contractor mobilization plan - resources & equipment, planned vs actual, during planning/pre-TA/execution (NEW `/mobilization`),
R5 Insulation (`insulation`), R6 Weld (`weld`; weld-map style counts: joints welded/NDT passed/repair rate), R7 Rigging & Lift (`rigging`; lift plan status, crane, load),
R8 Tools (`tools`), R9 Bagging & Tagging progress (`bagging-tagging`), R10 Heavy equipment (`heavy-equipment`), R11 Fabricated material & pre-fab status (`prefab`),
R12 Waste (`waste`; tonnes by stream, disposal manifests), R13 Inspection of equipment & tools status (`equipment-inspection`),
R14 Discipline-wise customised dashboards for Pre-TA / TA execution / post-TA: EXT `/disciplines` — add phase toggle (Pre-TA | Execution | Post-TA) with different priority/focus panels.

### Execution (X1-X33)
| ID | Item | Screen |
|---|---|---|
| X1, X2 | Execution organogram; contractor twin organization | `/organization` tabs |
| X3 | Visualise CP1/2/3 with insights on dependencies, logic, resource, cost; track CP changes daily + count | EXT `/critical-path`: dependency network (simple SVG), insight cards, "CP changed N times" daily changelog |
| X4 | Log & track issues, safety issues | NEW `/issues` (issues + safety incidents log, severity, owner, aging, filters) — also feeds X23 |
| X5 | Discovery job workflow | OK `/discovery-jobs` |
| X6 | Digital field checklists | NEW `/field-checklists`: checklist templates, fillable form (tick, notes, photo placeholder, sign), completion stats |
| X7 | Productivity analysis | NEW `/productivity`: planned vs actual productivity by discipline/activity (e.g., m of pipe/hr), trend, top under-performers |
| X8 | Box-up management | NEW `/box-up`: equipment box-up checklist/certificate flow, status board, approvals |
| X9 | PSSR | NEW `/pssr`: PSSR items by system, action closure, sign-off flow |
| X10 | SCFs and additional work requests | OK `/scf` (+ "additional work request" type) |
| X11 | What-if schedule analysis (completion, dropping scope) | NEW `/what-if`: sliders/toggles (drop job, add crew, shift start) -> recomputed end date, cost, CP shown vs baseline; simple deterministic model |
| X12 | Mechanical completion certificates | NEW `/mc-certificates`: MC cert register by system/area, status, certificate preview |
| X13 | Mobile: progress, approvals, capture in low/no network | EXT `/mobile-capture` (G6) |
| X14 | Blinding/de-blinding progress | NEW `/blinding`: blind list, installed/removed counts, by unit, status chart |
| X15 | S-curve monitoring | OK (dashboard) — also dedicated `/s-curve` tab inside `/kpis` or dashboard link |
| X16 | AI schedule forecasting | `/ai-panel` tab "Schedule Forecast" (forecast finish vs baseline with confidence band) |
| X17 | AI predictive critical-path analysis | `/ai-panel` tab "Predictive CP" (activities likely to become critical) |
| X18, X19, X20 | Live readiness dashboards: ready for Walkdown / PSSR sign-off / operational startup, by system/unit/area | NEW `/readiness-board` with 3 tabs, heat-grid of units/systems with % ready |
| X21 | Real-time dynamic CP update incl. auto-identification of newly-critical activities | `/critical-path` live "newly critical" ticker (simulated, timer-driven) |
| X22 | Executive summary dashboard | NEW `/executive-summary` (single-screen RAG: schedule, cost, safety, quality, readiness, top risks) |
| X23 | Issues dashboard | `/issues` dashboard tab |
| X24 | Budget comparison dashboard | `/budget` comparison tab |
| X25 | Re-work reports dashboard | NEW `/rework` tab "Re-work" (with X32) |
| X26 | Non-conformance reports | NEW `/ncr`: NCR register, severity, root cause, disposition, closure chart |
| X27 | Area/unit completion certificate handover from main mechanical contractor | NEW `/area-handover`: area list, certificate workflow contractor -> owner, status |
| X28 | Automated (AI) close-out report | `/closeout` (C-section) generator button |
| X29 | Contractor KPI digitisation | NEW `/contractor-kpi` (scorecards per contractor, radar/bars) |
| X30 | End-of-TA report on how many times critical path changed | `/critical-path` tab "CP Change Report" (+ included in close-out) |
| X31 | Day/night shift log for handover/takeover | NEW `/shift-log`: shift handover log entries, signed handover/takeover, carry-over items |
| X32 | Delay & rework capture | `/rework` (delay + rework capture form + Pareto of causes) |
| X33 | Equipment (valves, bundles, etc.) tracking | OK `/equipment-tracking` (add bundles/exchangers to data) |

### Close-Out & Continuous Improvement (C1-C6)
| ID | Item | Screen |
|---|---|---|
| C1 | Lessons-learned report | `/lessons-learned` (I6) — "Generate report" view |
| C2 | Digitalise area completion of post-TA work | NEW `/post-ta-completion` (punch/post-TA work by area, % complete) |
| C3 | Digital TA close-out report | NEW `/closeout`: report preview built from live mock data (summary, scope, schedule, cost, safety, quality, lessons) |
| C4 | Final cost & schedule performance report | `/closeout` tab (planned vs actual end date, final cost vs budget, variance by WBS) |
| C5 | AI-generated close-out report | `/closeout` button "Generate with AI" -> streaming-text simulation (`Simulated`) |
| C6 | End-to-end documents handover & archiving | NEW `/handover-archive`: document register by discipline, handover status, archive tree, completeness % |

## 3. Build order (the agent must follow this and verify after each phase)
- **Phase A — Foundation:** nav restructure, phase spine, shared components (Tabs, DataTable, Drawer, TrackerPage, etc.), `checklistRegistry`, `/coverage`, mock generator. Build + browser check.
- **Phase B — Highest demo value (STO demonstration scoring):** Portfolio + active TA, Executive Summary, Critical Path extensions (X3, X21, X30), what-if (X11), readiness board (X18-20), STO readiness (G11), AI panel tabs (G12, G13, X16, X17, S9), Scope tabs (S1-S9), Platform page (D1-D6), Mobile offline (G6).
- **Phase C — Planning/Pre-TA breadth:** BOM, work packs, QA/QC+ITP, material tracking, all 13 Pre-TA trackers, lookahead, mobilization, P&ID analyzer, attendance.
- **Phase D — Execution breadth:** issues, field checklists, productivity, box-up, PSSR, MC certs, blinding, NCR, rework/delay, shift log, area handover, contractor KPI, KPIs page, organization, access control.
- **Phase E — Initiation & Close-out:** milestones/event tracker, strategy, lessons learned, closeout (+AI), post-TA completion, handover archive; extend risk register (steering view), budget (G10).
- **Phase F — Polish & proof:** global search, empty states, `MOCK_VS_REAL.md`, README update, console clean, every route screenshot-checked at 1920x1080 and 1366x768, `npm run build` + `npm run lint` clean, coverage page shows 97/97.

## 4. Rules for the build
- Stack stays as is: Vite + React 19 + TS + react-router + plain CSS tokens (`src/styles/tokens.css`). No new heavy deps; SVG charts hand-rolled. Add a dependency only with a clear reason.
- Match existing code style; reuse `Card`, `PageHeader`, `StatTile`, `Chip`, `KanbanBoard`, `GateStepper`, `SCurveChart`, `BarRow`, `FunnelChart`.
- Data: typed, seeded, plausible (Oman refinery context: Sohar refinery / OQ RPI; units like CDU, VDU, HCU, FCC, SRU; OMR currency; discipline names). Same entities must agree across pages (a job on the scope page appears in the work pack, the lookahead, etc.).
- Every list/workflow page must have at least one working interaction (approve/reject, advance stage, filter, add item via form) via the service layer, not component-local mutation of mock arrays.
- npm: always `--prefix "$PWD"` and verify installs (OneDrive rule). Pin dev port 5173 `strictPort`.
- Do not touch `dist/`, `node_modules/`.
- Never claim an integration/AI feature is real: `Simulated` / `Illustrative` badge.
- Definition of done: `npm run build` and `npm run lint` pass; each new route loads with zero console errors; screenshots reviewed by eye; `/coverage` lists all 97 items linked to working routes.
