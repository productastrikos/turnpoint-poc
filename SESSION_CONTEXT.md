# TURNPOINT session context (19 Oct 2026, end of day)

Run: `Run TURNPOINT.bat` (or `npm run dev`, port 5173 strict). Audit + design: `docs/AUDIT_AI_AND_INTEGRATION_2026-10-19.md`. Call prep for the boss: `../BOSS_CALL_BRIEFING.md`.
Pre-change snapshot of src/docs: zip `turnpoint-snapshot-before-2026-10-19.zip` in an earlier session's temp folder.

## Done and verified
- **S9 duplicate scope detection**, **G12 / X16 / X17 risk, forecast, predictive CP**, **SAP / P6 two-way sync** (stand-in consoles `/ext/sap`, `/ext/p6`, split `/ext/split`): see previous notes in the audit doc. E2E test (`integration_test.py`, five flows) passed again on the final code.
- **G13 assistant is now wired**: `src/ai/assistant/useAssistant.ts` (state, role reset, relay status, fallback to on-device on any LLM error) and `AssistantChat.tsx` (badge Live AI / On-device AI, tool-step chips, page links, Stop, New conversation). Used by `src/app/ChatLauncher.tsx` and AI > Assistant. The old scripted `aiService.ts` is deleted.
  - Verified in on-device mode (no key): 10 questions, staff and contractor (cost withheld), no console errors.
  - **NOT verified: the live Claude path** (`agent.ts`) - no `ANTHROPIC_API_KEY` was available. First thing to do when a key is in `.env.local`: ask the six suggested prompts and check streaming, tool chips and the fallback block.
- **SAP sandbox card** (`src/modules/integrations/SapSandboxCard.tsx`, Integration Hub > SAP): read-only; needs `SAP_API_KEY` (or paste into the field, kept in memory only). **NOT verified against the real sandbox**; entity and field names (`MaintenanceNotification`, `NotificationText`, `MaintenanceOrder`...) are from SAP's published API and may need adjusting.
- Checklist registry: S9, G12, G13, X16, X17 = built. Docs updated: README, `docs/MOCK_VS_REAL.md`, `../DEMO_GUIDE_VALUE_FIRST.md` (36 items, 21% / P50 06 Sep, 58% after night crew).
- Full sweep: 106 URLs at 1920x1080, 0 console errors, 0 failed or external requests, 0 overflow. `tsc -b` and `oxlint` clean.

## Video
- `../demo-video/TURNPOINT_Demo_v2.mp4` (6:12, 1080p60, captions) and `TURNPOINT_AI_Highlights.mp4` (1:52). Source synced into `../demo-video/source`; working copy `C:\dev\turnpoint-video` (re-create from source; see `../demo-video/README.md`). Record against `npx vite preview --port 4173` after `npm run build`.
- True 4K is not possible with the CDP screencast (frames cap at viewport size).
- The film shows the on-device assistant (no key).

## Gotchas
- After batch edits by script, Vite's watcher on OneDrive can serve a stale module. Restart the dev server.
- Git Bash rewrites `/ext/...` script args into Windows paths. Use `MSYS_NO_PATHCONV=1`.
- Keys only go in `turnpoint-poc/.env.local` (see `.env.example`), never in chat.
- A previous `C:\dev\turnpoint-video` (earlier session's working copy) was deleted by mistake this session and rebuilt from the OneDrive source.
- Merging a duplicate or accepting a risk action changes numbers until **Reset**.

## Next
1. Add `ANTHROPIC_API_KEY` and test the live assistant; re-record ch10 if you want the film to show Live AI.
2. Add `SAP_API_KEY`, test the sandbox card, fix field names.
3. Optional: commit (the folder is not a git repo).

## 1 Nov 2026: PBC 03 response (see docs/PBC03_PLAN.md)
Built (all demo flows, in memory, with Reset buttons): scope freeze lifecycle + certificate Rev A/B (modules/scope), computed critical path + delay impact + recovery + change report (services/criticalPathService.ts, modules/critical-path), QA/QC PO->ITP->acceptance workflow (modules/qaqc), broken/missing tools + mobile report screens, contractor HSE KPI (toolbox talk, housekeeping), attendance-system sync + mobilization, Pre-TA Re-work Reports, discipline Pre-TA tiles, OQ + Sia rename. Disciplines has its own sidebar entry.
NOT done: PBC 03 guided walkthrough mode, PBC coverage mapping, recorded demo video. Waiting for the client's updated checklist. Not browser-verified by click: tools-tracking, attendance sync, mobilization simulate, mobile HSE screens.
Dev server for checks: `npx vite --port 5190 --strictPort`.

## 1 Nov 2026 (later): updated PBC_03.xlsx pass + demo videos
- Branding per the sheet: OQ logo (src/app/OqLogo.tsx, sidebar/login/favicon), assistant is "Ask S!a" (was Sia).
- Added scope Risk tab card "Impact of risk on the scope: cost and timeline" (item 1a) with Simulate risk event.
- demo-videos/: 11 narrated mp4s in final/ (see demo-videos/README.md). Playwright recorder (lib.py, videos.py, run.py, mux.py, all.sh).
- ElevenLabs free credits nearly used (~113 left). More narration needs a top-up.
- Dev server was restarted: stale vite process served an old scopeMock.ts (FREEZE_DATE export error) until killed.

## 5 Nov 2026: Spectrum comments (PBC 03 sheet dated 04.11.2026) - app changes done
- SAP side by side: `src/app/SapDock.tsx` (SAP stand-in framed beside OQ, always mounted, top window only, hidden for contractors). Creating scope (manual / bulk / Excel) sends `tp.scope.created` on the bus, SAP opens orders (number = 400003 + 1000 + job no., same as `sapWoForJob`, which now returns one for every OQ-created item) and answers `sap.scope.confirmed`; OQ logs it, toasts it and opens the dock. No ack in 4 s = Failed message + warning toast. Gate 1/2 approvals push user status GT1/GT2 to SAP; bulk approval opens the dock. Dock events: `window.dispatchEvent(new CustomEvent('oq:sap-dock', {detail:{open|toggle}}))`.
- Attendance: Automatic sync switch (workforceService `getAutoSync/setAutoSync`), runs while the page is open.
- Re-work: equipment (Manlift, Scaffolding, Mobile crane, Welding machine, Hydrotest pump) with equipment-hours and cost in qualityMock/qualityService and `/pre-ta/rework-reports`.
- Integration Hub: new "Interface inventory" tab (PBC item 13). Intelex / DMS / MOC are design only.
- Old pre-PBC03 films in `../demo-video/` were sent to the Recycle Bin (owner's decision).
- Videos: redo brief in `demo-videos/VIDEO_BRIEF.md`. NOT verified: SAP dock at widths under 1100 px, split view with the new messages.
