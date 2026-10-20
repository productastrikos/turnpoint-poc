# SAP S/4HANA + Primavera P6 — what they are, how the client uses them, how the demo should show integration

Supersedes the thin "Integrations tab" in CHECKLIST_UPDATE_PLAN.md (D5, D6, G5). Everything here is a **simulated** frontend (no live connection) and must be badged `Simulated`.

## 1. Plain-English: what the two systems are
| | Primavera P6 (Oracle) | SAP S/4HANA (PM / MM / PS) |
|---|---|---|
| Role in a turnaround | **The schedule brain.** Activity network with logic (FS/SS/FF/SF), durations, calendars (12h day/night shifts), constraints, baselines, resources (labour + non-labour), critical path (CPM), resource histograms. | **The system of record** for maintenance, materials and cost. PM = notifications, work orders, task lists, equipment, functional locations, maintenance plans. MM = materials, BOM, reservations, PR/PO. PS/FI = WBS and cost. |
| Who uses it | Turnaround planners/schedulers. | Maintenance planners, buyers/stores, finance. |
| How data gets in/out | **.XER file** import/export (the standard planner workflow), **P6 EPPM REST API** (`/p6ws/rest/v1` on current versions; older `/p6ws/restapi`), XML/Excel. The client's UAT is **P6 v24.21** (SOW 4.16). | **OData (V2) services** and REST APIs, usually through **SAP Integration Suite (CPI)**; catalogue is the **SAP Business Accelerator Hub (api.sap.com)** — the site in the boss's screenshot. Client target is **S/4HANA 2025**, clean-core, API-driven, side-by-side (SOW 19.16). |
| Typical objects | Project, WBS, Activity, Relationship, Calendar, Resource, Resource assignment, Baseline, Activity codes, UDFs | Maintenance Notification, Maintenance Order (work order) + operations, Task list, Equipment, Functional Location, Material, Reservation, PR/PO, WBS element |
| API names (verify on api.sap.com / Oracle docs before quoting externally) | Activities, Resource assignments, WBS, Projects endpoints | `API_MAINTNOTIFICATION`, `API_MAINTENANCEORDER` (names seen in SAP KBA/third-party docs; service must be activated in `/IWFND/MAINT_SERVICE`) |

**How a real refinery turnaround flows across them (the story the demo should tell):**
1. Operations/inspection raise **notifications** in SAP PM -> become candidate scope items.
2. Scope is challenged and gated (3 gates), then **frozen**; approved items get/keep **SAP work orders** + task lists + material reservations (MM).
3. Planners build the **P6 schedule** from those work orders (activities carry SAP WO numbers; resources/man-hours loaded; baseline fixed; CPM gives CP1/2/3).
4. During execution the field updates progress (shift/daily); P6 recomputes **actual/remaining units (ALU/RLU)**, forecast finish, delay/gain and the critical path; costs and confirmations flow back to **SAP**.
5. Discovery jobs / SCFs add new work -> new SAP notification/WO + new P6 activities.
6. Close-out: final cost in SAP, final schedule in P6, history archived.
The pain the client wants to kill: re-keying the same job in SAP, P6, Excel and WhatsApp ("no parallel system", SOW 20). The STO platform is the **single field-facing layer** that keeps both in sync.

## 2. What the client's own SOW demands (cite these in the UI)
- 4.36 bi-directional integration with SAP S/4HANA **PM & MM**; 4.37 P6 **two-way sync** (SOW p.14). 4.16 P6 UAT v24.21 (p.12).
- 19.16-19.17 (p.56-57): SAP-certified mechanisms (OData, REST, SAP Integration Suite/CPI), clean core, **near-real-time bi-directional** exchange for planning/execution/confirmation/status, **event- or status-driven + periodic sync**, **centralised monitoring, exception handling, automated error resolution**, OAuth/certificates/encryption, AD SSO, retrofit of existing interfaces. Status changes (planning status, **scope freeze**, readiness) must be **reflected in SAP**.
- 19.18 (p.57-58) P6 integration lifecycle; 19.20 deliverables.
- **SOW section 16 "Dry Run" (p.45-48) — 34 explicit test scenarios.** Key P6 ones: import `.xer` (tasks, timestamps, relationships, constraints, resources, calendars) -> field-simulated updates -> **export updated `.xer`** (actual timestamps, progress, remaining duration, ALU, RLU); pull **Activity IDs** from xer and show against each activity; labour/non-labour resources imported **read-only**; auto-compute BLU/ALU/RLU from progress; S-curve and histogram on man-hours; est. end = data date + remaining duration; delay/gain propagation to successors (with/without sequence violation); day-wise planned progress verified against P6. Also QA/QC (exchanger inspection stages, rework at all stages, REQUESTED-but-NOT-DONE view), SCF vendor-input at evaluation stage, man-hour S-curves at project/equipment level, milestone/handover status per asset (Handover by Ops, Blinding, Opening...), filter/sort activities by asset type/tag/criticality/area/delay-gain.
=> **The demo can be built around this table.** It is the most persuasive thing we can show: "we implemented your dry-run script."

## 3. Demo design: "Integration Hub" (replaces the Integrations tab) — route `/integrations`
Add to sidebar under "Platform & General". All data in `src/mocks/integrationMock.ts`, logic via `src/services/integrationService.ts` (async). Every screen carries a `Simulated` badge and a footer "No live connection - illustrative data".

### 3.1 Overview tab — architecture + health
- SVG diagram: `Primavera P6 (v24.21 UAT)` <-> `TURNPOINT STO Platform` <-> `SAP Integration Suite (CPI)` <-> `SAP S/4HANA 2025 (PM/MM/PS)`; animated pulse dots along the links when a sync runs. Labels on links: `.XER / P6 REST API`, `OData V2 / REST - OAuth 2.0 + mTLS`.
- Health tiles per connection: status (Connected), last sync (relative time, ticking), next scheduled sync, messages today, error queue count, avg latency. A "Sync now" button runs a visible progress sequence (steps tick off, counts increment, toast on completion, tiles update).
- Security strip: OAuth 2.0 / certificate / TLS / AD SSO chips (SOW 19.17.2-3).

### 3.2 Primavera P6 tab — the XER round-trip (the headline demo)
Wizard-style, 4 steps, each clickable and rewindable:
1. **Import**: drag-drop zone pre-loaded with sample `OQ_Sohar_TA2026_Baseline.xer` (button "Use sample"). Parsing animation -> summary: ~2,486 activities, ~5,912 relationships, 38 resources (labour + non-labour), 4 calendars (12h Day, 12h Night, 7-day, 5-day), 3 baselines, data date, project/WBS tree. Preview table with **P6 Activity IDs** (e.g. `CDU-1040`) against each activity; resources shown **read-only** with lock icon.
2. **Field updates**: shows the last N simulated field updates from Execution (e.g. "10-E-101 bundle pulled 100%") with who/when from mobile.
3. **Recalculate**: BLU / ALU / RLU computed per activity, est. end = data date + remaining duration, delay/gain propagation to successors, critical-path change flagged (+ "CP changed 1 time today"). Show a small before/after S-curve.
4. **Export**: diff table (what will be written back: actual start/finish, % complete, remaining duration, ALU, RLU) -> "Export updated .XER" button that triggers a **real browser download of a generated, plausible sample .xer text file** (small, from the mock data) — acceptable because it is clearly named `..._SIMULATED.xer`. Log entry added.
Plus a **"P6 REST" sub-panel**: list of endpoints used (`GET /activity`, `PUT /activity`, `GET /resourceAssignment`, `GET /wbs` ...) with sample request/response JSON viewer. Label "illustrative - confirm paths against client P6 v24.21 docs".

### 3.3 SAP S/4HANA tab
- **Object mapping table** (STO object <-> SAP object <-> interface <-> direction <-> trigger): Scope item <-> Maintenance Notification (`API_MAINTNOTIFICATION`, pull + status push); Work pack/job <-> Maintenance Order + operations (`API_MAINTENANCEORDER`, bi-dir); Equipment/Flange/Valve <-> Equipment & Functional Location (read); BOM/MTO <-> MM material + reservation + PR (read/create); Budget/Sub-WBS <-> PS WBS element & cost (read actuals, push approved changes); SCF/Discovery job -> new notification/WO (create); Status (scope freeze, readiness, MC) -> SAP system/user status (push). Direction arrows and "event-driven / scheduled" chips.
- **Pull from SAP** drawer (also reachable from the Scope "Create from SAP" tab, S3): table of ~20 mock open notifications/work orders (number, description, functional location, priority, planner group); select rows -> "Import as scope items" -> they actually appear in the scope worklist via the service layer with a `SAP` source chip and the SAP number.
- **Push to SAP**: when a scope item reaches Frozen / a work pack becomes ready / an MC certificate is issued, an outbound message is queued and shown in the log. Visible on the Scope Freeze Certificate page: "Status pushed to SAP: WO 4000123456 -> TECO-ready" style chips.
- **Material availability (MM)** chip on work packs/BOM rows ("In stock 12 / Reserved 8 / PR 10012345 open").
- Business Accelerator Hub reference card: "APIs consumed" list with API names and a "View in SAP Business Accelerator Hub" **plain text note** (do not hot-link a hub deep link we haven't verified).

### 3.4 Monitoring & error handling tab (SOW 19.16.8 / 19.17.8)
- Message log table: timestamp, system, direction, object, key (WO/Activity ID), status (Delivered / Retrying / Failed / Auto-resolved), latency; click row -> drawer with request/response payload JSON and "what we did" (e.g., "Auto-retry x2 then resolved: material locked in SAP").
- Error queue with 3-5 seeded errors; "Auto-resolve" button demonstrates automated resolution without manual intervention; counters update.
- **Conflict resolution** card: same activity changed in P6 (dates) and in STO (progress) -> rule shown "P6 owns dates/logic/resources; STO owns progress/actuals; SAP owns cost/material/status" with a field-ownership matrix. This answers "which system wins" - credible and a common client question.

### 3.5 Dry-Run Readiness tab (SOW section 16)
Table of the 34 dry-run scenarios from the SOW (category, scenario, linked demo screen, status Pass/Simulated/Planned) with a "Run all" button that animates statuses to Pass (those the POC genuinely demonstrates) and leaves Planned for the rest. Link each row to the screen that shows it. Honest statuses only.

### 3.6 Threads through the rest of the app (cheap, high-impact)
- Critical Path, Scope, Work Packs, Lookahead rows show **P6 Activity ID** and **SAP WO #** chips; hover shows source + last sync.
- TopBar: small sync indicator "P6 · SAP  synced 2 min ago" that opens `/integrations`.
- Alerts feed includes integration events ("P6 import complete: 2,486 activities", "SAP WO 4000123xxx status pushed").
- Checklist D5/D6/G5 and Execution items reference this hub in `/coverage`.

## 4. Other demo-polish recommendations (apply in Phase F)
1. **One continuous storyline** that crosses modules with the same seeded entities: SAP notification -> scope item -> 3 gates -> freeze (+push to SAP) -> work pack -> P6 activity -> field progress (mobile, offline then sync) -> XER export -> dashboard S-curve moves -> close-out report. Add a small **"Guided Demo" button** in TopBar: a step list (8-10 steps) that navigates to each screen in order with a one-line caption overlay. Presenter-friendly, avoids hunting through 60 pages.
2. **Presenter mode / reset**: a "Reset demo data" action (clears local state) so every meeting starts clean; no stale approvals.
3. Consistent seeded numbers (same TA, same units, same budget) on dashboard, executive summary, portfolio and close-out.
4. Subtle motion only where it explains (sync pulses, progress ticks); no gratuitous animation. Everything works offline, no external fonts/CDNs.
5. Be upfront in UI/talk-track: what is simulated (see docs/MOCK_VS_REAL.md).

## 5. Sources of the research (for the boss)
- SAP partner page (Rizing "Carbon for Project Integration" - SAP PM/PS <-> P6 sync via HANA SDI, manual + automatic sync): https://www.sap.com/products/scm/partners/rizing-llc-carbon-for-project-integration.html
- SAP partner page (Commondo - bidirectional SAP <-> external scheduling sync): https://www.sap.com/products/technology-platform/partners/commondo-doo-commondo-eppm-suite.html
- SAP partner page (Wipro STO360 on SAP BTP): https://www.sap.com/belgie/products/scm/partners/wipro-limited-wipro-sto360.html
- Oracle P6 REST docs: https://docs.oracle.com/en/industries/construction-engineering/primavera-p6-project/26/rest-api/op-projectresource-post.html
- Oracle P6 REST endpoint list (per version): https://docs.oracle.com/cd/G18294_01/English/Integration_Documentation/rest_api/rest-endpoints.html
- SAP KBA 3787252 (API_MAINTNOTIFICATION performance, OData V2): https://userapps.support.sap.com/sap/support/knowledge/en/3787252
- Prometheus Group STO (competitor positioning: pushes planning changes to SAP and P6): https://prometheusgroup.com/sto
- Client SOW: `C4_Scope of Work.pdf` pp.12, 14, 45-48, 56-58, 71.
Note: exact API field lists and P6 endpoint paths were not verified against official catalogues; the demo shows them as illustrative.
