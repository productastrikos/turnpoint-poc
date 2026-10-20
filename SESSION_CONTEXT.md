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
