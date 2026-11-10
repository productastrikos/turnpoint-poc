# PBC 03 response plan (1 Nov 2026)

Source: `../PBC 03.xlsx` (client's list of items "not addressed during the demo") plus the action plans the team wrote on the call (screenshots). The xlsx is NOT the final one: an updated checklist is coming. Expect to adapt; keep each stream's work self-contained.

## Principle: this is a DEMO of how the real product behaves
We are not building the production app. Every feature needs **visible, clickable demo moments**: Generate / Add / Simulate buttons, before-after states, toasts that say what changed ("critical path changed", "scope frozen", "certificate generated"), and a Reset. At the end we **record a demo video** of these clicks. Mock what is not real and say so (SimBadge). All state is in-memory services (`createCollection`), so every flow needs to work offline and be resettable.

## Naming
- App name in the UI: **OQ** (sub-line "Turnaround Management"). "TURNPOINT" is removed from user-visible text.
- AI assistant: **S!a**. Buttons/titles read "Ask S!a".

## What the client said, mapped to work streams

| # | PBC / team note | Stream |
|---|---|---|
| Scope c-h | "Digitally Approved Turnaround Scope & Scope Freeze Certificate" -> action plan "Certificate to be generated". "Add budget estimate button by AI". "Scope challenge ... when bulk loading is used". AI duplicate detection (exists). | **S1 Scope freeze** |
| 3, 10 | Visualize/review CP1-3 with insights on dependencies, logic, resource, cost; track how many times the critical path changed; end-of-TA report | **S2 Critical path** |
| 4 | Realtime monitoring, auto-identify activities becoming critical due to delay. Team note: "Include cost and timeline impact because of delay in any line" | **S2 Critical path** |
| 5, 6 | Digitalize QA/QC/Acceptance workflows; ITP tracking after PO issuance | **S3 QA/QC** |
| 2 | Discipline-wise dashboards Pre-TA / TA / Post-TA | **S4 Nav + branding** (move to own sidebar entry, done) |
| 7 | Contractor mobilization (resources & equipment). Team note: "Showcase tools faulty list in the dashboard". Manpower from attendance system | **S5 Tools + mobile**, **S6 Manpower** |
| 8 | Dashboard - Re-work reports (put in Pre-TA section) | **S6 Manpower + rework** |
| 9 | Contractor KPI digitization. Note: track permit, toolbox talk, housekeeping, HSE compliance; "Build tool box talk mobile app template and record video" | **S5 Tools + mobile** |
| 11, 12, 13 | PMO, handover/archiving, IT/cyber | answered in writing, out of scope for build |
| - | OQ + S!a rename | **S4** |

## Research summary (what "best option" means)
- **Scope freeze (pre vs post):** before the freeze date the worklist is open: items are raised, challenged and screened (three gates: Area Ops Focal Point -> Head of Area Ops -> VP Asset Ops). At the freeze the approved list becomes the **baseline**: a signed **Scope Freeze Certificate** (revision A) is issued, order status pushed to SAP. After the freeze **nothing enters or leaves without a formal variation / change request** (cost, man-hours, critical-path impact, approver), each approved variation re-issues the certificate as Rev B, C... and is tracked as scope growth vs baseline. Good demo: start unapproved -> approve through gates -> press **Freeze scope** -> certificate generated -> raise a post-freeze variation -> approve -> **Rev B** with a visible baseline-vs-current diff.
- **Critical path:** longest path by CPM (zero or lowest total float), recalculated on every progress or delay update; **near-critical** = float <= 5 days (GAO schedule guide); the path can switch, so log each change (what became critical, what dropped off, why) and count them per day; delay impact = days lost on end date x daily standing cost + crew standby/extension cost. The existing `src/integration/cpm.ts` is the engine to use.
- **Contractor KPI:** typical digital scorecard = safety (TRIF, observations), HSE compliance (permit compliance, toolbox talk done and attendance, housekeeping inspection score, PPE), schedule/productivity, quality (first-time-right, NCRs), attendance. Toolbox talk / housekeeping / permit audit entries are **entered manually by the contractor supervisor in the mobile app** (client confirmed).
- **Manpower:** the attendance (badge/access-control) system feeds heads on site by contractor/shift; compared with the mobilization plan to flag shortfall. Simulate the feed with a "Sync from attendance system" button.
- **Tools:** operator reports broken / missing tool in the mobile app; goes to the tool crib; replacement requested; dashboard shows faulty list, downtime impact and replacement status.

## Streams (parallel, disjoint file ownership)
Shared registry files are already prepared (modules `tools-tracking`, `pre-ta-rework` registered, Disciplines has its own sidebar entry). Streams may edit only their own line in `app/tabRegistry.ts` and add entries to `app/checklistRegistry.ts` only if needed (otherwise skip it).

1. **S1 Scope freeze**: `modules/scope/*`, `services/scopeService.ts`, `services/scopeModel.ts`, `mocks/scopeMock.ts`, `mocks/jobsMock.ts`, `services/jobsService.ts`.
2. **S2 Critical path & live monitoring**: `modules/critical-path/*`, `services/criticalPathService.ts`, `mocks/criticalPathMock.ts`, `integration/cpm.ts` (extend, keep P6 console working).
3. **S3 QA/QC & ITP**: `modules/qaqc/*`, `services/qaqcService.ts`, `mocks/qaqcMock.ts`.
4. **S4 Branding (OQ / S!a)**: all user-visible TURNPOINT strings, `app/ChatLauncher.tsx`, `ai/assistant/*`, `app/Sidebar.tsx`, `app/TopBar.tsx`, `app/LoginPage.tsx`, `index.html`, `i18n/*`, README. No logic changes.
5. **S5 Tools + mobile + contractor KPI**: `modules/tools-tracking/*`, `modules/mobile-capture/*`, `services/mobileService.ts`, `modules/contractor-kpi/*`, new `services/toolsService.ts`, `services/hseService.ts`, mocks for them. The tools faulty list must also surface on the Mobilization page (tiny read-only widget) and the dashboard.
6. **S6 Manpower & rework**: `modules/attendance/*`, `modules/mobilization/*`, `services/workforceService.ts`, `modules/rework/*`, `modules/disciplines/*` (only to make Pre-TA tab show manpower/rework tiles).
7. **S7 (after 1-6) PBC 03 walkthrough, coverage and video**: `app/GuidedDemo.tsx` PBC mode, PBC mapping page/doc, Playwright script that records the demo video. Waits for the updated checklist.

## Rules for every stream
- Stack: Vite + React 19 + TS, existing UI kit in `components/ui`, `components/charts`, services pattern `createCollection` + `delay`. Match surrounding code style.
- Windows/OneDrive: dev server only with `npx vite --port <your port> --strictPort`. Never `npm install` without `--prefix "$PWD"`. Do not grep node_modules/dist.
- Do not touch files owned by another stream. If you need a change there, say so in your report instead.
- Verify: `npx tsc -b` (errors only in your files count) and `npx oxlint`, then load your pages headless at 1920x1080, click through the new flows, check console errors and LOOK at screenshots (`/demo-verify` skill).
- Every new action should have a toast naming the consequence, work offline, and respect the contractor role (no cost for contractors, existing `useRole`).
- Report: what you built, which buttons to click in which order (demo script), what is mocked, anything you could not verify.
