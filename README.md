# TURNPOINT: Turnaround Digitalization POC

Browser-based, mock-data prototype of the end-to-end Turnaround / STO management platform OQ RPI is tendering for (SOW "End-to-End Digital Turnaround Solution Platform").
It is for internal evaluation. **Nothing here is connected to OQ's SAP, Primavera P6 or any live system**: SAP and P6 are stand-in consoles, and the AI models (duplicate scope, risk, forecast) run in the browser on generated training history. See [docs/MOCK_VS_REAL.md](docs/MOCK_VS_REAL.md).

The app covers all **97 lines** of the client's *TA Digitalization DEMO Check List (7 Oct 2026)*. Open **Checklist Coverage** (`/coverage`) to see each line, its status (Built / Simulated / Integration point) and a link to the screen that demonstrates it; "Run link check" proves every line resolves to a real route, tab and page.

## Run it

Double-click **`Run TURNPOINT.bat`** (next to this folder). It installs dependencies on first run, starts the dev server and opens http://localhost:5173.

Or from this folder:

```
npm install --prefix "$PWD"      # first time only (OneDrive: always pass --prefix)
npm run dev                      # http://localhost:5173 (port is pinned, strictPort)
npm run build                    # type-check + production build
npm run lint
```

Everything works offline: fonts are bundled, there are no CDN calls.

### Sign-in (demo gate)

The app opens on a plain, generic login card with the credentials pre-filled (`admin` / `Turnpoint2026!`, the TA Event Manager), so a demo is one press of **Sign In**. To try another role, type its username with the same password: `steerco`, `planner`, `inspection`, `hse`, `contractor`. Sign out is in the profile menu. This is a **demo gate, not security**: the accounts are in the client bundle. The `/ext/*` SAP / P6 stand-in consoles are not behind it.

### Language (English / العربية)

The **EN / العربية** switch is on the login card and in the top bar; the choice is remembered and flips the page to right-to-left. Arabic covers the sign-in screen and the app shell: sidebar, stage bar, page tabs, top bar, profile menu, role names. **The page bodies (tables, charts, mock records, assistant answers, guided-demo captions) are still English**: translating them is a separate piece of work. Strings live in `src/i18n/ar.ts` (keyed by the English text; a missing key just shows English). The Arabic font (IBM Plex Sans Arabic) is bundled, so it works offline.

### Deploying to astrikos.xyz

See **`DEPLOY.md`** (ports 3303 / 4303, pm2, nginx, Cloudflare). The deployed build needs `server/index.mjs` for the assistant and SAP card; everything else is static.

### Optional keys (`.env.local`)

Copy `.env.example` to `.env.local` and restart. Keys stay in the relay (`server/relay.mjs`: mounted by `vite-relay.ts` locally, run by `server/index.mjs` when deployed) and never reach the browser.

- `ANTHROPIC_API_KEY`: the assistant answers open questions with Claude through tools over the live data. Without it an on-device engine answers the common questions from the same data (the badge in the chat shows which).
- `SAP_API_KEY`: enables the read-only SAP sandbox card in Integration Hub > SAP.

### Two-way sync demo

The split view (`/ext/split`) opens on the Command Dashboard and has one-click **Demo actions** (three SAP notifications, an SAP cost change, P6 extend / recover E-204 with Schedule F9, and Reset demo). The dashboard shows a "Live from SAP & Primavera P6" feed and refreshes its tiles and AI forecast when a message arrives.

Integration Hub > **Live two-way sync** opens the stand-in **SAP** (`/ext/sap`) and **P6** (`/ext/p6`) consoles, or both beside TURNPOINT at `/ext/split`. Try: send a new notification from SAP (lands in Scope, flagged as a duplicate), approve a Gate 3 item (releases the order in SAP), extend E-204 by 3 days in P6 (TA end 05 Sep to 07 Sep, driving path CP1 to CP2).

## A 5-minute path through the demo

Press **Guided demo** in the top bar for an 11-step storyline across modules, or:

1. **Executive Summary**, then switch **Active TA** (top bar) to see the portfolio rescale the dashboard.
2. **Integration Hub**: SAP tab, *Pull from SAP*, import items (they land in Scope at Gate 1 with an SAP chip and an AI duplicate check). Live two-way sync tab: the SAP and P6 stand-in consoles. P6 tab: import sample XER, recalculate ALU/RLU, export a generated XER.
3. **Scope & Worklist**: AI duplicate detection (merge J-2235 into J-2230), three-gate approval, divert a non-TA item, risk matrix, challenge, variations, freeze certificate.
4. **Work Packs**, **Critical Path** (dependency network, live monitor, change report), **What-if**, **AI Analytics** (21% chance of the 05 Sep forecast; accept the night-crew action and watch it rise to 58%; ask the assistant).
5. **Mobile Field App**: go offline, record progress, come back online and sync.
6. **View as** Contractor Supervisor: cost and approvals lock; menu items show locks.
7. **Close-Out Report**: generate the AI draft (templated text).

## Stack

Vite + React 19 + TypeScript + react-router-dom 7, plain CSS tokens (`src/styles`), hand-rolled SVG charts (no chart library). Fonts: `@fontsource` (bundled).

```
src/
  app/          shell, registries (moduleRegistry, checklistRegistry, tabRegistry), RBAC, search, guided demo
  components/   ui (tables, tabs, drawers, forms), charts (SVG), workflow, tracker (config-driven page)
  modules/      one folder per page
  services/     async functions over in-memory stores (the future API boundary)
  mocks/        seeded, typed data (shared master data in master.ts, scenario clock in _gen.ts)
  types/        shared types
docs/           CHECKLIST_UPDATE_PLAN.md, INTEGRATION_RESEARCH_AND_DEMO_SPEC.md, MOCK_VS_REAL.md
```

Navigation, routing, access control and `/coverage` are all generated from `src/app/moduleRegistry.ts`, so a page cannot be missing from one and present in another.

## Page index (64 pages)

**Platform & General**

| Route | Page |
|---|---|
| `/` | Command Dashboard |
| `/executive-summary` | Executive Summary |
| `/portfolio` | Multi-TA Portfolio |
| `/kpis` | KPIs & S-Curve |
| `/readiness` | Overall STO Readiness |
| `/budget` | Budget Control |
| `/ai-panel` | AI Assistant & Analytics |
| `/mobile-capture` | Mobile Field App (Offline) |
| `/integrations` | Integration Hub (SAP · P6) |
| `/platform` | Platform & Performance |
| `/access-control` | Access Control (RBAC) |
| `/alerts` | Alerts & Notifications |
| `/coverage` | Checklist Coverage |

**TA Event Initiation**

| Route | Page |
|---|---|
| `/organization` | TA Organization |
| `/risk-register` | Risk Register |
| `/milestones` | Milestones & Event Tracker |
| `/strategy` | TA Strategy Document |

**Scoping & Worklist Frozen**

| Route | Page |
|---|---|
| `/scope` | Scope & Worklist |

**Planning, Procurement & Contracting**

| Route | Page |
|---|---|
| `/materials` | Materials / MTO |
| `/bom` | BOM & Approval Flow |
| `/material-tracking` | Material & Procurement Tracking |
| `/work-packs` | Work Packs |
| `/qaqc` | QA/QC & ITP |
| `/flange-tracking` | Flange Management |
| `/pid-analyzer` | P&ID / Isometric Analyzer |

**Pre-TA**

| Route | Page |
|---|---|
| `/lookahead` | Lookahead Plan |
| `/mobilization` | Contractor Mobilization |
| `/pre-ta/scaffold` | Scaffold Management |
| `/pre-ta/isolation` | Isolation Management |
| `/pre-ta/insulation` | Insulation Management |
| `/pre-ta/weld` | Weld Management |
| `/pre-ta/rigging` | Rigging & Lift Management |
| `/pre-ta/tools` | Tools Management |
| `/pre-ta/bagging-tagging` | Bagging & Tagging |
| `/pre-ta/heavy-equipment` | Heavy Equipment |
| `/pre-ta/prefab` | Fabrication & Pre-fab |
| `/pre-ta/waste` | Waste Management |
| `/pre-ta/equipment-inspection` | Equipment & Tools Inspection |
| `/disciplines` | Discipline Dashboards |

**Execution**

| Route | Page |
|---|---|
| `/critical-path` | Critical Path Monitor |
| `/what-if` | What-if Schedule Analysis |
| `/readiness-board` | Walkdown / PSSR / Startup Readiness |
| `/issues` | Issues & Safety Log |
| `/discovery-jobs` | Discovery Jobs |
| `/scf` | SCF & Additional Work |
| `/change-moc` | Change / MOC |
| `/field-checklists` | Digital Field Checklists |
| `/productivity` | Productivity Analysis |
| `/box-up` | Box-Up Management |
| `/pssr` | PSSR |
| `/mc-certificates` | Mechanical Completion Certificates |
| `/blinding` | Blinding / De-blinding |
| `/equipment-tracking` | Equipment / Valve Tracking |
| `/ncr` | Non-Conformance Reports |
| `/rework` | Re-work & Delay Capture |
| `/area-handover` | Area / Unit Handover |
| `/attendance` | Attendance & Manpower |
| `/shift-log` | Shift Handover Log |
| `/contractor-kpi` | Contractor KPIs |
| `/daily-report` | Daily Newsletter |

**Close-Out & Continuous Improvement**

| Route | Page |
|---|---|
| `/closeout` | Close-Out Report |
| `/lessons-learned` | Lessons Learned |
| `/post-ta-completion` | Post-TA Work Completion |
| `/handover-archive` | Handover & Archive |

Several pages have tabs addressed as `?tab=` (for example `/scope?tab=freeze`); the list is in `src/app/tabRegistry.ts`.

## Honesty rules

Anything simulated (SAP / P6 stand-ins, load test, offline mobile, drawing analysis, close-out draft) carries a **Simulated** or **Illustrative** badge. Trained models carry an **AI model** badge, the assistant shows **Live AI** or **On-device AI**, and the top banner says the prototype is not connected to any live system.
