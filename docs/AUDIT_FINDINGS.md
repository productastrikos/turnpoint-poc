# TURNPOINT audit findings

Phase 1 scope (before any code change): every route in `MODULE_LIST` (62) plus every `?tab=` in `tabRegistry` = 126 URLs, each loaded in a real browser (Playwright, headless Chromium) at 1920x1080 and 1366x768, dark and light theme (504 page loads, screenshots reviewed by eye, plus scripted checks for console output, failed and external requests, horizontal overflow, clipped text, WCAG contrast, empty table columns, missing labels). Three personas (Contractor Supervisor, Steering Committee, HSE Officer) were run across all 64 routes at 1366x768. Interaction checks covered the guided demo (all 11 steps), the assistant panel, modals, the SAP drawer, global search (16 queries, every result clicked), the phase spine, the 18 sidebar entries and every hub tab, back/forward and keyboard focus.

Client documents read in full: SOW (72 pages, sections 1 to 25), the 97-line demo checklist, the build plan, `CHECKLIST_UPDATE_PLAN.md`, `MOCK_VS_REAL.md`.

Severity: **P0** blocks the demo, **P1** visibly wrong, **P2** polish. Status (Phase 3) is on every line: **FIXED** (changed and re-checked in the browser), **PARTLY**, **NOT FIXED** (with reason) or **DECISION** (needs you).

## Verified good before any change (no action needed)

Console clean on all 126 URLs and all personas (0 errors, 0 warnings); no failed or external requests (works offline); no horizontal page scroll at 1920 and, except Organization, at 1366; every sidebar entry, hub tab, phase-spine stage, deep link and all 11 guided-demo steps land on a real page and highlight correctly; all 97 checklist lines link to existing routes and tabs (`/coverage`: 79 built, 15 simulated, 3 integration point); every global-search result resolves; role locks and view-only banners match the access matrix on all 64 routes for 3 personas; the core scenario numbers agree across pages (Day 14 of 32, 44% vs 47%, SPI 0.94, budget OMR 11.80M / forecast 12.21M, 15 variations +OMR 0.75M, 22 NCRs, 18 CP changes, 1,513 of 1,610 heads, 28 lessons); `run.bat` is ASCII only.

## Re-verification result (after the fixes)

Full sweep repeated: 126 URLs x (1920 dark, 1920 light, 1366 dark, 1366 light) and a second pass of all 126 at 1920 light and 1366 dark after the last edits: **0 console errors or warnings, 0 failed or external requests, 0 horizontal overflow, 0 clipped text, 0 overflowing elements on every URL**. Contractor persona re-scanned: no OMR or USD amount on any unlocked page (only the SCF rule text). Guided demo, chat panel, modal, drawer, toast stacking, Escape, search results, phase spine, sidebar, hub tabs re-run and passing. `/coverage` "Run link check": "97 of 97 items resolve to a registered route, an existing tab and an implemented page". `tsc` (app and node configs) clean, `oxlint` clean, production `vite build` succeeds (built to a scratch folder so `dist/` was not touched; run `npm run build` yourself to refresh `dist/`). Remaining automated contrast hits are disabled buttons and a few false positives on gradient / `color-mix` backgrounds.

---

## P0: blocks the demo

- [x] **P0-1 Assistant panel overlaid the page instead of docking. FIXED.** It was `position: fixed` over the right 392px, covering action buttons (the "Approve" button on `/scope?tab=approvals` was under it), cutting the phase spine, hiding half of every table at 1366, forced to 520px tall by an old `components.css` rule, and did not close on Escape. Now: page content and phase spine reflow beside it (below 1100px it overlays), full height, Escape closes, assistant answers are scrubbed of costs for contractors. Checked: Approve not covered, panel 706px tall at 1366x768, Escape closes.
- [x] **P0-2 Guided-demo bar covered the bottom of every page. FIXED.** `.content` now gets bottom padding while the bar is on screen (and the bar re-centres when the assistant is docked). Checked at 1366: last card ends 24px above the bar (was 75px under it).
- [x] **P0-3 Toasts were rendered below modals, drawers and the guide bar. FIXED.** Toast stack z-index 200 -> 700 (the `z-index: 600` in `astrikos.css` was on an unpositioned element), `role="status" aria-live="polite"` added, and it moves left when the assistant is docked. Checked: toast raised over an open modal is the top element.

## P1: visibly wrong

### Data and content
- [x] **P1-1 Contractor still saw cost figures (SOW 4.17 examples 1 and 2). FIXED.** Dashboard "Budget Committed" tile, Scope "Budgetary estimate" tile, Scope Risk / Challenge / Variations / Freeze tabs (locked panel for contractors), KPI "Planned vs actual cost", What-if costs, AI exposure and recommendation text, Rework cost column / tile / detail, Heavy Equipment rates and daily hire, assistant answers. Re-scanned as contractor: no amounts remain. **DECISION:** the SCF raise form and Heavy Equipment "Add item" form still let a contractor type a cost (they are inputs, not views). Say if you want those fields hidden too.
- [x] **P1-2 Pre-TA trackers showed empty columns. FIXED.** Weld (Joints, Welded, NDT passed), Isolation (Points), Insulation (m2), Tools (Qty, Crib), Bagging (Items), Heavy Equipment (Hours), Pre-fab (Spools, Inch-dia, Shop) now render from `row.metrics`; the Weld table now agrees with its KPI tiles.
- [x] **P1-3 Cross-page number mismatches. FIXED.** Executive Summary pending variations now computed (OMR 0.20M, same as Scope, Budget, Close-out); KPI scorecard productivity index and the Productivity page now share one computed value (0.95) and its trend ends on it; alert text for SCF-201 no longer contradicts the routing rule; assistant "four scope items" corrected to five.
- [x] **P1-4 Load-test page contradicted its own verdict. FIXED (wording).** Verdict reads "PASS on p95 / p99 over 1 s on 2 transactions", footnote states the pass logic and that SOW 4.25 asks for 1 second on every transaction, so the two p99 outliers stay on the tuning list. Numbers unchanged (illustrative).
- [x] **P1-5 Header pill "P6 · SAP synced 2 min ago" implied a live connection. FIXED.** Now "P6 · SAP simulated · 2 min ago", amber non-pulsing dot, "sim" tag kept at <=1500px (it used to collapse to a bare green dot), tooltip and aria-label say there is no live connection; Integration Hub chips read "Connected (simulated)".
- [x] **P1-6 Browser tab said "turnpoint-poc" with the default Vite logo as favicon. FIXED.** Title "TURNPOINT | Turnaround Digitalization", new T favicon matching the brand mark.

### Layout and charts
- [x] **P1-7 Chart axes were wrong. FIXED.** Ticks are now round values (1, 2, 2.5, 5 x 10^n; whole numbers for counts) in BarChart, LineChart, Bubble and Pareto, so bars match their labels (NCRs per day, Issues age, Field checklists, Close-out cost, CP change chart).
- [x] **P1-8 Charts did not use the card width. FIXED.** New `chartKit.ts` measures the container; all charts now draw at real width (and Gantt, architecture diagram) with true-size text.
- [x] **P1-9 Gantt charts rendered at 1.6x scale with truncated / clipped labels. FIXED.** True-size text, label column sized to the chart, right-hand gutter for bar tags, month labels never collide, "Sep" never "Sept". Checked on Portfolio, Platform roadmap, Milestones, What-if.
- [x] **P1-10 Organization page cut off (left branch unreachable; RACI table widened the page 138px at 1366). FIXED / PARTLY.** Tree now starts at the left edge, shrinks to fit (down to 72%), scrolls sideways centred on the root with a visible scrollbar and a hint line; RACI table scrolls inside its card; grid cells can shrink (`.grid > * { min-width: 0 }`) so no page overflows any more. At 1366 the Execution organogram is still wider than its card, so it scrolls sideways (hint shown).
- [x] **P1-11 Integration Hub architecture diagram clipped text. FIXED.**
- [x] **P1-12 Duplicate first filter chip (Mobilization, Resource histogram, Lookahead, P&ID, Discipline dashboards). FIXED** (`hideAll` on `FilterChips`; chips also expose `aria-pressed`).
- [x] **P1-13 BarRow percentages invisible in light theme. FIXED** (own column, never over the bar); AI "what drives the prediction" no longer shows two different numbers.
- [x] **P1-14 Attendance gate feed looked overprinted by its footnote. FIXED** (it is a scroll box; now bordered with a scroll label).
- [x] **P1-15 KPI S-curve showed a shaded triangle to Day 32. FIXED** (area now closes at the last actual point).
- [x] **P1-16 Pareto x labels clipped (Rework & Delay). FIXED** (margins sized from the longest label, tooltips carry the full text).
- [x] **P1-17 Contrast failures. FIXED.** Dark: primary buttons, avatar and active step number 3.97 -> 5.1:1 (`--btn`), Ask TURNPOINT 4.2 -> 5.7, Reject / bell 3.8 -> 4.8 (`--crit-solid`), red text on dark 4.5 -> 6.1 (`--crit` is now a lighter coral, so red bars in dark-theme charts look softer, see decisions), read alerts no longer dimmed to 0.6. Light: good / warn / SAP tags 4.1-4.3 -> 5.2-5.6, Simulated badges 3.4-3.7 -> pass (global `opacity .9` removed). Token values and ratios are documented at the top of `tokens.css`.
- [x] **P1-18 Leftover emoji icons from the old UI. FIXED.** Lock, camera, pin, folder and warning replaced with line icons (Cost restricted, P6 resources, vendor quotes, Field checklists, Mobile, Handover archive, not-integrated badge).
- [x] **P1-19 (found while fixing) Flange Management was the thinnest page vs SOW 10.51. FIXED.** Added dashboard tiles (closed, in progress, leak tested, critical joints open, re-work after torque), SOW stage names (Opened, Cleaned & Inspected, Assembled, Torqued, Leak Tested, Closed) and a per-flange drawer with bolting, gasket, torque value, tightening sequence, opening inspection, QA/QC sign-offs, previous-TA record and a time-stamped audit trail. Detail values are generated from the flange record and labelled as such in the drawer.

## P2: polish

- [x] **P2-1 Range sliders in browser-default red. FIXED** (`accent-color` token; also checkboxes).
- [x] **P2-2 Dashboard delta arrows green for bad news ("+9 overdue", "4 today"). FIXED** (rising warn / crit values now coloured by severity).
- [x] **P2-3 Dead old-shell CSS. FIXED / PARTLY.** Removed `.mock-banner`, `.chat-fab`, `.sidebar-toggle*`, `.main-layout`, `.topbar .brand*`, `.phase-connector`, `.role-badge*`, `.tag-soon`, the old `.chat-panel` block and the stray `.sidebar-link` variants; `Sidebar.tsx` dead fallback removed. **NOT FIXED:** unused `@fontsource/barlow-condensed` and `@fontsource/ibm-plex-sans` are still in `package.json` (removing them needs `npm uninstall`, which touches `node_modules`; nothing imports them, so there is no runtime cost).
- [x] **P2-4 `Run TURNPOINT.bat` had LF endings and bare `npm`. FIXED** (CRLF, ASCII only, `--prefix "%APPDIR%"` on install and run). Not executed here (it would open a second server on 5173); the same commands were run by hand.
- [x] **P2-5 Accessibility basics. FIXED / PARTLY.** Skip link, keyboard-reachable sortable headers and clickable rows (Enter / Space), dialogs and drawers get an accessible name and focus moves in and back out, toast live region, assistant closes on Escape, tile buttons respond to Enter. **NOT FIXED:** no full focus trap inside dialogs.
- [x] **P2-6 Mixed date formats. PARTLY.** Alerts stamp ("16 Aug, 09:02"), flange and freeze-certificate dates, "Sep" everywhere. ISO dates (2026-08-21) still appear in a few detail drawers and the Portfolio side panel.
- [x] **P2-7 Budget donut note and raw legend values. FIXED** (legend shows OMR 8.51M / 3.29M).
- [x] **P2-8 Truncated bar labels / network node names. PARTLY.** Bar labels now use the available width ("Discovery job", "Pre-job safety"); long node names in the CP dependency network are still ellipsised and the CP1 lane still extends past the card (scrolls).
- [x] **P2-9 Scope challenge bubble labels overprinted. FIXED** (labels skipped where bubbles overlap; axis ticks rounded).
- [x] **P2-10 Spacing. PARTLY.** Daily newsletter section spacing fixed. NOT FIXED: Dashboard Budget card is still shorter than the S-curve card.
- [x] **P2-11 Missing checklist chips. FIXED** for Discovery Jobs (X5) and Flange (P2). Change/MOC and Alerts have no checklist line.
- [x] **P2-12 Phase spine jumped to Initiation on Lessons Learned. FIXED.**
- [ ] **P2-13 DECISIONS, not changed:** (a) the build plan acceptance list asks for an always-visible "prototype / mock data / not integrated" banner; it was removed on purpose. Honesty signals that remain: SimBadge on every simulated page, footers on the Integration Hub, the header pill (fixed above), `MOCK_VS_REAL.md`. Recommend keeping it off for the recording. (b) Portfolio and Platform roadmap use "TA-2027 minor / STO-2028 major", while SOW 4.10 names SR2-TA-2027 and AP-TA-2027 (mid Oct 2027), SR1&PP-TA-2028 and MAF-TA-2028 (mid Oct 2028) at 1.8 / 1 / 3.5 / 2 MN man-hours. Aligning names and dates would read as "we read your document" but changes scenario data. (c) SCF threshold is USD 75K as in the SOW (the build plan said OMR); the app follows the SOW. (d) The dark-theme red (`--crit`) is now a lighter coral so red text passes contrast; red chart bars follow it. If you prefer the stronger red in charts, use a separate fill token (about 15 chart call sites).
- [ ] **P2-14 Area Handover "Punch A open 94" vs MC Certificates "Punch A open 101".** Different scopes (17 handover packages vs 20 systems) but a sharp viewer may ask. NOT FIXED; explain in the talk track or align the seeds.
- [ ] **P2-15 Persona inconsistency to know about:** the Contractor Supervisor has Full access to the "governance" group (Risk Register, SCF, MOC, Discovery), so it can see the whole risk register. Matches the access matrix as designed. NOT FIXED.

---

## Checklist and SOW 22.2 coverage verdict

All 97 checklist lines have a screen with believable data and pass the link check. Lines that read thinner than they ask: **G13 / X28** are scripted answers (labelled Simulated AI); **R14** discipline dashboards cover 6 of the 16 disciplines in SOW 10.39 (Inspection, Rotating, Process, Instrumentation, Civil, Electrical); **SOW 4.75** "alerts & mail notifications" shows an in-app alert feed only, with no e-mail preview (the 22.2 scoring text names "alerts & mail notifications"). The SOW 22.2 "STO solution demonstration" list is all present and reachable through the guided demo (phases initiation to close-out, real-time progress, S-curves, critical path updates, change/MOC, risk register, discovery jobs, SCFs, alerts, dashboards); the mobile line (picture capture, barcode, GPS) is on `/mobile-capture`. Flange management (G/P2) is now backed by a real detail view.

## Re-check before you record

1. Chat panel: open it on a wide table page and confirm you like the docked layout.
2. Dark theme: red text and red bars are now coral; look at Rework, NCR, Critical Path.
3. Contractor Supervisor: dashboard tile and locked Scope tabs (the RBAC moment).
4. Header pill wording and amber dot; Integration Hub "Connected (simulated)".
5. Organization > Execution organogram at 1366 (scrolls sideways).
6. Load-test page wording, Flange drawer, Weld table.
7. Run `npm run build` once so `dist/` matches the source.

---

## Session 626cd3: independent verification and additional fixes

A second audit session, working in parallel, re-ran the whole matrix against the build above (126 URLs at 1920 dark, 1920 light, 1366 dark, 1366 light, plus Steering Committee and Contractor at 1366), then clicked every enabled button on every route (about 830 clicks) and walked the main workflows. **Verified:** console clean on every URL and persona; no horizontal overflow, clipped text or off-screen elements; nav, hub tabs, phase spine, back/forward, 108 global-search results and all 101 `/coverage` links resolve; guided demo bar no longer covers content; toasts sit above modals; the fixes listed above (org chart, architecture diagram, S-curve triangle, light-theme bar labels, contrast tokens, header pill, emoji icons, contractor cost hiding) hold up. Build, `tsc` and `oxlint` pass.

Items it found that were not in the list above, and what was done:

- [x] **N-1 Toasts blocked clicks. FIXED.** A toast at bottom-right sat on top of whatever control was underneath (the status chips on `/critical-path`) for its full 3.8 seconds, so a second click was swallowed. Toasts are now `pointer-events: none` (they still auto-dismiss).
- [x] **N-2 Sidebar did not fit at 1366x768. FIXED.** The whole Execution group and Close-Out were below the fold (the user had to scroll the menu during a recording). A compact spacing rule for screens under 820px high now shows all 18 entries.
- [x] **N-3 Light-theme funnels (Flange fleet funnel, PR to PO funnel) had white labels on pale blue bars (about 2.8:1). FIXED.** Solid fills from tokens (`--btn`, new `--good-solid`) with white text.
- [x] **N-4 SCF form failed silently.** Submitting an empty form did nothing and said nothing; its inputs also had no labels. **FIXED:** required markers, inline messages (title, originator, duration, justification), a warning toast, and accessible names. Routing rule unchanged (verified: USD 90,000 routes to the Head of Turnaround Services).
- [x] **N-5 View-only roles could still change data.** The banner for the Steering Committee says actions are disabled, but five pages used raw buttons: SCF submit, mobile Submit progress / Approve / capture, BOM approval-step reordering, critical-path status chips, checklist pass/fail and photo. **FIXED** with the existing `useCanEdit` pattern. Re-checked: no state-changing button is enabled for the Steering Committee; the manager is unaffected.
- [x] **N-6 SOW 22.2 and 4.75 name "alerts & mail notifications"; the app only had an in-app feed. ADDED:** every alert has an **E-mail** preview (drawer, `Simulated` badge) with sender, To and Cc by workflow (SCF, box-up, PSSR, permit, integration), subject and body, and an "Open in TURNPOINT" button. New `mailService.ts`. Nothing is sent. Recorded in `MOCK_VS_REAL.md`.
- [x] **N-7 Mobile queue did not sync on reconnect.** SOW 4.69 asks for automatic synchronisation when the network returns; the demo needed a manual button click. **FIXED:** switching back to Online or Low network syncs the queue automatically with a toast; the manual button is now "Sync now (n)". Leftover glyph icons in the queue and the Scan button replaced with line icons.
- [x] **N-8 "0 CP changes · 0 today" flashed on `/critical-path` before data loaded, and seven pages flashed "No items / No alerts" for about 200 ms.** The chip now waits for data; default simulated service latency lowered from 220 ms to 80 ms, so the empty-state flash is now one or two frames. Calls remain asynchronous.

Not changed, for your decision or because it is by design:

- **D-1 Contractor SCF form still shows the cost slider and the "Routes to" chip** (SOW 4.17 example 1 says the estimated cost is for OQ staff). Hiding them means the contractor submits an SCF with no cost and the TA costing team fills it in later, which needs a "cost pending" state on the SCF record. Tell me if you want it.
- **D-2 Scenario names vs SOW 4.10** (P2-13b above) left alone as agreed.
- **D-3 Small text:** SVG chart labels are 10px and Simulated badges 9.5px; readable on a 1080p recording, tight on a projector.
- **D-4 White on the primary blue** is 5.1:1 after the token change; the Astrikos guide's original `#3b7de8` would be 3.97:1, so the darker `--btn` is a deliberate deviation from the guide.
- **D-5 Guided demo step 10** (Dashboard): the bar overlaps the two lower card buttons ("View all", "Details") until the page is scrolled; the page has bottom padding so they are reachable.

How it was checked: real Chromium (Playwright) against the dev server, screenshots read by eye at both resolutions and both themes, scripted checks for console, overflow, overlap (`elementFromPoint` on every control), contrast, labels and role gating, and a click-everything fuzz. Contrast numbers from the scripted check are unreliable on SVG text and `color-mix` backgrounds; those were judged on screenshots.

---

## Session 3 (14 Oct 2026): spec audit and final polish

Re-ran the full route sweep (105 URLs = every route plus every `?tab=`) at 1920x1080 dark and 1366x768 light: 0 console errors or warnings, 0 failed requests, 0 horizontal overflow, 0 clipped text. Contact sheets of all 105 pages reviewed by eye in both themes.

Fixed:
- **P2-6 date formats (closed).** New `longDate` / `longStamp` in `mocks/_gen.ts` ("03 Aug 2026", "09 Jun 2026, 08:41"). No ISO date is rendered anywhere now (Portfolio panel, Strategy versions and stamp, Freeze certificate signatures, Critical Path node detail). Verified with a text scan of all 105 pages.
- **P2-10 dashboard cards (closed).** Budget card now matches the S-curve card height and carries headroom, committed-not-spent and spent-of-plan figures, all derived from the active TA's numbers.
- **P2-8 (partly closed).** Platform roadmap bar label "STO-2028 Major STO (CDU / VDU / HCU): ro..." shortened so it no longer truncates.
- **P2-3 (closed).** Removed unused `@fontsource/barlow-condensed` and `@fontsource/ibm-plex-sans` (`npm uninstall --prefix`), and the unused Vite template files `src/assets/hero.png`, `src/assets/vite.svg`, `public/icons.svg`.
- `npm run build` refreshed `dist/`; `tsc` and `oxlint` clean.

Still open by design (unchanged): D-1 contractor SCF cost field, P2-13 scenario naming vs SOW 4.10 and no permanent "prototype" banner, P2-14 punch counts, P2-15 contractor governance access, D-3 small chart text.
