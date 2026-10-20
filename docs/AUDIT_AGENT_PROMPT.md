# TURNPOINT audit-and-fix agent prompt

You are auditing and fixing **TURNPOINT**, a frontend-only, mock-data demo of an end-to-end turnaround (shutdown) management platform for OQ RPI (Sohar Refinery, Oman). The user will record a **client demo video** from it, so every screen must look right and nothing may be broken. You will find problems and then fix them.

## Paths
- App: `C:\Users\parth\OneDrive\Desktop\Astrikos AI\C4\turnpoint-poc` (Vite + React 19 + TypeScript + react-router, plain CSS tokens, hand-rolled SVG charts, mock data in `src/mocks`, async service layer in `src/services`)
- Client documents (read these first, fully): in `C:\Users\parth\OneDrive\Desktop\Astrikos AI\C4\`
  - `C4_Scope of Work.pdf` (72 pages; extract with PyMuPDF: `python -c "import pymupdf; ..."`, set `PYTHONIOENCODING=utf-8`). Scoring table is in section 22.2.
  - `TA Digitalization DEMO Check List 7 Oct2026.xlsx` (97 line items; read with openpyxl)
  - `TURNPOINT_POC_Build_Plan.md`
  - `turnpoint-poc/docs/CHECKLIST_UPDATE_PLAN.md`, `docs/MOCK_VS_REAL.md`
- UI guide: `C:\Users\parth\OneDrive\Desktop\Astrikos AI\_reference_ui` (see `client/src/index.css` and `client/src/components/Layout.js`): charcoal dark theme with a light option, Inter, blue buttons (#3b7de8), purple AI button, rounded borderless cards, line icons, thin header.
- Workspace rules: `C:\Users\parth\OneDrive\Desktop\Astrikos AI\CLAUDE.md` and `.claude\rules\windows-onedrive.md`. Key ones: always `npm install --prefix "$PWD"`; never touch `dist/` or `node_modules/`; pinned port 5173; do not read or print secrets; Windows PowerShell 5.1 (no `&&`).

## What just changed (verify it, do not assume it is right)
1. Full reskin to the Astrikos guide: `src/styles/tokens.css` (dark default, `data-theme="light"` option), `src/styles/astrikos.css` (overrides, loaded last), Inter bundled via `@fontsource/inter`.
2. New shell: `src/app/AppShell.tsx`, `Sidebar.tsx`, `TopBar.tsx`, `PhaseSpine.tsx`, `icons.tsx`. The "Prototype - mock data only" banner was removed on purpose (user request).
3. The floating "Ask TURNPOINT" button was replaced by a header button opening a right side panel (`ChatLauncher.tsx`, exports `ChatPanel`).
4. Sidebar cut from ~72 to 18 entries: `NAV` in `src/app/moduleRegistry.ts` groups modules into hubs. Every module keeps its own route; a tab strip (`HubTabs` in `AppShell.tsx`) shows siblings. `alerts` has no sidebar entry (bell in header).
5. `Gauge.tsx` arc bug fixed (large-arc flag). Modal/drawer overlay z-index raised; SAP pull drawer widened.

## Your job, in order
### Phase 1: Read, then find flaws (do not edit yet)
Read every document above completely. Then audit the running app (start it with the Browser tools: `preview_start` name `turnpoint-dev`, or `npm --prefix turnpoint-poc run dev`). Visit **every route** in `MODULE_LIST` (`src/app/moduleRegistry.ts`) and every `?tab=` in `src/app/tabRegistry.ts`, at **1920x1080 and 1366x768**, in **dark and light** theme, as at least three personas (TA Event Manager, Steering Committee, Contractor Supervisor via the "View as" select). Look at screenshots; do not rely on the build passing. Record each problem with route, viewport, theme, what is wrong, and severity.

Check specifically:
- **Visual breakage:** text/background contrast (esp. light theme and chips/badges/charts), clipped or overflowing content, horizontal page scroll, charts that do not draw or use hard-coded colours that clash, tables squeezed or cut off, anything unreadable. Compare against the UI guide.
- **Overlay/layering bugs:** anything that blocks clicks (header panels, toasts, guided-demo bar, assistant panel, modals, drawers, dropdowns, search popup). The earlier bug was a fixed button covering a dialog's action button.
- **Navigation:** every sidebar entry and hub tab lands on the right page and highlights correctly; phase spine and sidebar relevance dots behave; restricted roles see locked entries and the Restricted page; deep links from `/coverage` and the guided demo (`src/app/GuidedDemo.tsx`) still resolve; browser back/forward; global search results (`src/services/searchService.ts`) still go to existing routes.
- **Interactions:** each page's main workflow works (approve/reject, advance stage, forms with validation, drawers, filters, simulated sync, what-if, offline toggle, report generation). Console must be clean (no errors, no React key/act warnings).
- **Content vs client documents:** for each of the 97 checklist lines and the SOW section 22.2 scoring list (STO solution demonstration, AI/workflow/analytics, mobile features), confirm the screen actually shows what the line asks, with believable numbers, and that the same entities and numbers agree across pages (scenario: Day 14 of 32, 44% vs 47% plan, SPI 0.94, budget OMR 11.80M). Flag wrong, missing, contradictory, or unrealistic data, typos, and inconsistent terminology.
- **Honesty:** simulated features must stay labelled (`SimBadge`); nothing may imply a live SAP/P6 connection that is not real. Flag the header "P6 - SAP synced 2 min ago" pill (kept for the integration story) and recommend a wording or tooltip that stays honest.
- **Demo-readiness:** features that are noise for a demo (see the 18-entry sidebar in `NAV`); anything that looks unfinished (empty states, "coming soon", placeholder text, lorem ipsum, emoji-icons left over from the old UI, old fonts); loading flashes; slow pages; `run.bat`/`Run TURNPOINT.bat` still works and is ASCII only.
- **Code health:** `npm run build` and `npm run lint` clean; dead code left from the old shell (`.mock-banner`, `.chat-fab`, old `.sidebar-toggle` CSS and similar in `base.css`/`components.css`); unused imports/exports; any `localStorage` use not wrapped in try/catch.
- **Accessibility basics:** keyboard focus visible, buttons have labels, dialogs close with Escape, color is not the only status signal.

Write the findings to `docs/AUDIT_FINDINGS.md`, grouped P0 (blocks the demo), P1 (visibly wrong), P2 (polish), each with a checkbox, route and screenshot description.

### Phase 2: Fix
Fix every P0 and P1 and the cheap P2s directly in the code. Rules:
- Match existing code style and the token system; use tokens, never new hard-coded colours; keep both themes working.
- Do not delete modules or routes that map to a checklist line. Do not touch `dist/`, `node_modules/`, or any other folder in the Astrikos AI workspace.
- Keep ports pinned; keep the service-layer pattern (components never mutate mock arrays directly).
- After each batch of fixes, re-open the affected pages in the browser and look at them again. Do not mark an item fixed without seeing it.
- Finish with `npm run build` and `npm run lint` passing, console clean on every route, and `/coverage` still showing 97 of 97 linked.

### Phase 3: Report
Update `docs/AUDIT_FINDINGS.md` with status per item (fixed / not fixed / needs a decision from the user and why). Final message to the user: what you fixed, what remains, anything you changed that they should re-check before recording, and any decision you need from them. Never claim something works without having run or looked at it.
