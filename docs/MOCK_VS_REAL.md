# TURNPOINT: what is real and what is mocked

TURNPOINT is a **proof of concept that runs in the browser**. There is no database and no connection to any OQ RPI system.
All data is seeded in `src/mocks` and held in memory behind an async service layer in `src/services`, so a real API can replace it later without touching components.
Reloading the page (or pressing **Reset** in the top bar) restores the seed data.
Two optional calls leave the machine, both through a localhost-only relay (`vite-relay.ts`) that keeps the keys in `.env.local`: the assistant to Claude (needs `ANTHROPIC_API_KEY`) and read-only reads of SAP's public API sandbox (needs `SAP_API_KEY`). With no keys the demo runs fully offline.

## What is real in the demo

| Area | What genuinely runs |
|---|---|
| Navigation, phase spine, role-based access | Real logic: menu, locks, view-only banners and disabled actions follow the role chosen in "View as" |
| Workflows | Real state machines through the service layer: 3-gate scope approval, SCF routing rule (USD 75K / mechanical window), MOC, discovery jobs, work-pack release, QA/QC stage control, box-up, MC certificates, blinding, shift handover, NCR, issues |
| Calculations | Real: S-curves, SPI, readiness score, priority ranking, risk matrix, what-if model, budget variance and base-vs-current bridge, BLU / ALU / RLU and delay / gain in the P6 tab |
| Cross-page consistency | Real: the same jobs, activities, contractors and numbers feed every page (e.g. approving a variation changes the budget bridge) |
| AI duplicate scope detection (S9) | A pairwise logistic-regression model trains in the browser on a generated history of labelled pairs (hold-out AUC 0.98), scores the live worklist, new items as they are typed, Excel imports and SAP pulls, and retrains on every "merge" / "not a duplicate" decision |
| AI risk prediction, schedule forecast, predictive critical path (G12, X16, X17) | A slip classifier per activity (AUC 0.74) feeds a 2,000-run Monte Carlo over the CP1-CP3 network: chance of the 05 Sep forecast, P50 / P90, criticality index, and each recommended action re-simulated with the same random draws |
| Two-way sync with SAP and P6 stand-ins | TURNPOINT and the stand-in consoles (`/ext/sap`, `/ext/p6`, side by side at `/ext/split`) exchange real messages over a browser `BroadcastChannel`. The P6 stand-in runs a real CPM (forward / backward pass, leads, lags, constraints): extending E-204 by 3 days moves the TA end from 05 Sep to 07 Sep and flips the driving path to CP2 |
| Assistant (G13) | Each answer reads the live services through 11 tools (cost figures are removed in code for contractors). With a key it is Claude, otherwise an on-device engine composes the answer from the same tool data. The badge says which |
| Files | The P6 tab downloads a generated `.xer` text file; CSV exports and print views work |

## What is simulated (carries a visible badge)

| Item | Badge | Notes |
|---|---|---|
| SAP S/4HANA integration (D5, G5) | Stand-in | The SAP side is a stand-in Fiori-style console with its own orders and notifications, not a connection to OQ's SAP. Messages in both directions are real (a new notification arrives and is duplicate-checked, a cost change updates the estimate, a Gate 3 approval releases the order). The pull drawer in the hub is a simulated feed. API names are illustrative until verified against the client's landscape |
| SAP public sandbox read (Integration Hub > SAP) | Live (read-only) | Real HTTPS reads of SAP's shared sample data through the relay. Needs `SAP_API_KEY`; without it the card stays in demo mode. Not verified end to end in this build (no key was available), and the sandbox is read-only so write-back is never attempted |
| Primavera P6 integration (D6, G5) | Stand-in | The P6 side is a stand-in EPPM-style console seeded from the same schedule, not a connection to OQ's P6. The sample XER in the hub tab is a bundled summary, not a parsed file, and the exported `.xer` is named `..._SIMULATED.xer` |
| Dry-run readiness (SOW section 16) | Honest statuses | 34 scenarios marked Pass / Simulated / Planned. Two are Planned (not demonstrated) |
| Load test and 1,500+ users (D2-D4) | Illustrative | A report format with generated numbers. Real evidence needs a measured test in UAT |
| Implementation roadmap (D1) | Illustrative | Plan content is a proposal, not a commitment |
| Mobile offline with SIM (G6, X13) | Simulated | A web screen; the SIM and network are a toggle. Queued actions sync automatically when the toggle returns to online (SOW 4.69). No native app, camera or GPS |
| E-mail notifications (SOW 4.75, 22.2) | Simulated | Each alert has an "E-mail" preview showing sender, routing (To / Cc by workflow), subject and body. Nothing is sent; no mail server or OQ mail integration |
| P&ID / isometric analyzer (G8) | Simulated | The drawings are mock SVGs and the extraction result is predefined. No drawing is read |
| AI training history | Illustrative | OQ's past worklists and turnarounds are not digitised, so the duplicate and slip models train on generated, documented histories. The screens say so. Real accuracy needs OQ's historical data (the SOW asks for it to be loaded) |
| Close-Out comparison with the previous turnaround (C3, C4) | Illustrative history | STO-2026 figures are live from the same services as the rest of the app. The STO-2024 final figures (duration, cost, scope growth, duplicates, NCRs, near misses, rework) are seeded stand-ins in `src/mocks/taComparisonMock.ts`, matched to the 2024 lessons already recorded. "Add to lessons learned" writes real entries into Lessons Learned |
| Close-out report AI draft (X28, C5) | Simulated AI | Templated text assembled from the live numbers. No model is called |
| Live critical-path monitor (X21) | Simulated | A timer feeds delays into near-critical activities |
| SCF vendor input (SOW dry run 25) | Simulated | Vendors "respond" inside the demo |
| Gate check-ins (G7) | Simulated | The real feed would come from the site access-control system |
| Digital signatures and hashes on the freeze certificate | Illustrative | Not cryptographic |

## Not built (integration points, shown as intent only)

Permit-to-Work system, HSSE / Intelex, Active Directory SSO, connectivity to OQ's own SAP and P6, a real mobile app, real file parsing of XER / Excel / PDF, report formats finalised with OQ.

## Scenario clock

The demo is frozen at **16 Aug 2026, Day 14 of 32** of the Major STO 2026 (Sohar Refinery, OQ RPI). Progress is 44% against a plan of 47% (SPI 0.94), forecast finish 5 Sep (+2 days), approved budget OMR 11.80M, forecast OMR 12.21M, 15 approved scope variations (+OMR 0.75M) against the base estimate, 36 scope items (live estimate OMR 2.70M). Critical-path forecasts and float are computed from the same network the P6 stand-in uses (CP1 float -2 d, CP2 -1 d).
Dates in the Portfolio, roadmap and close-out pages are proposals or forecasts, not facts.

## Currency and units

OMR throughout. The original SCF rule threshold is kept in USD (75,000) as in the SOW, converted at OMR 0.385 per USD where shown in OMR.
