# PBC 03 demo videos

Spec: `VIDEO_BRIEF.md` (5 Nov 2026 redo after Spectrum's comments). Final files go to `final/<id>.mp4`
(1920x1080, H.264 + AAC, ElevenLabs voice, on-screen captions). One video per PBC 03 item, 12 files.

| PBC item | Video | Where in the app |
|---|---|---|
| 1 (a, d, e, logo, Ask Sia) | 01a-scope-intake (now with SAP side by side, manual + Excel) | /scope |
| 1 (c) bulk updates seen in SAP | **01c-bulk-update-in-sap (new)** | /scope > 3-gate approvals + SAP side by side |
| 1 (b, f, g, h) | 01b-risk-freeze-certificate | /scope |
| 2 Discipline dashboards | 02-discipline-dashboards | /disciplines |
| 3 Critical path CP1-3 | 03-critical-path | /critical-path |
| 4 Live monitoring + delay cost/time impact | 04-live-monitoring-delay-impact | /critical-path > Live monitor |
| 5 QA/QC acceptance workflow | 05-qaqc-workflow | /qaqc > Workflow |
| 6 ITP tracking after PO | 06-itp-tracking | /qaqc > PO & ITP tracking |
| 7 Mobilization, manpower, faulty tools, automatic sync | 07-mobilization-tools-manpower | /attendance, /mobilization, /mobile-capture, /tools-tracking |
| 8 Re-work reports incl. equipment | 08-rework-reports | /pre-ta/rework-reports |
| 9 Contractor KPI + toolbox talk | 09-contractor-kpi-toolbox-talk | /mobile-capture (HSE), /contractor-kpi |
| 10 Critical path change report | 10-critical-path-change-report | /critical-path > CP change report |

Items 11-13 (PMO/Siemens roles, document handover, IT/cyber interfaces) are commercial answers, no video. The interface
inventory (item 13) lives at /integrations?tab=interfaces; Intelex, DMS and MOC are shown as design only (base scope).

## What is mocked
Everything shown is simulated in the browser: SAP S/4HANA is a stand-in (`/ext/sap`, receives from OQ over an in-page
bus, shown beside OQ in the SAP dock), P6, the attendance system and mobile sync too. Demo buttons (Simulate / Fast-forward /
Issue new PO / Next demo delay) drive it. Excel and CSV import use bundled sample files, not a real upload.

## Status (5 Nov 2026): redo finished
- `final/` holds the 12 new films (1920x1080, H.264 + AAC, ElevenLabs voice "Siren - Natural realistic conversational voice", model Eleven v4,
  default settings: stability 50, similarity 75). Scripts: `narration.json` / `videos.py`. Raw ElevenLabs audio: `audio/<id>.mp3` (+ `.json` sentence clips).
- 7,346 ElevenLabs credits were used (one generation per video, no retries). Free plan, 10,000 per month.
- Films run 0:31 to 1:09 (shorter than the brief's 1:00 target on purpose: one idea per sentence, no filler).
- Time-lapse: while the simulated app is busy (Working..., page loads) the film is sped up and the next sentence waits for the screen.

## Rebuild
1. App on :5173 (`npx vite --port 5173 --strictPort` in `turnpoint-poc`), machine idle (a background render makes recording slow).
2. `python alignsplit.py <id>` (needs a venv with faster-whisper, set ASR_PY; it aligns the script to the audio and writes `audio/<id>.json`).
3. `./all.sh <id> ...` records with Playwright (`run.py <id> rec`) and muxes (`mux.py`) into `final/<id>.mp4`. `FINAL_DIR=final_new` stages elsewhere.
   `mux.py` reads two corner markers drawn by `lib.py` (caption change, time-lapse) so audio follows the screen, not the wall clock.
4. Delete `raw/` and `out/` afterwards.

Characters per video (1 credit each): 01a 753, 01c 433, 01b 775, 02 446, 03 505, 04 736, 05 695, 06 565, 07 731, 08 621, 09 679, 10 407.

## Pipeline files
`lib.py` (Playwright helpers, 1920x1080, captions, cursor, SAP iframe helpers), `videos.py` (scripts + clicks),
`run.py <id> dry|rec|draft`, `alignsplit.py` + `asr_words.py` (script/audio alignment, ASR check), `audiosplit.py` (older silence-based splitter), `mux.py`, `all.sh`, `grab.sh`.
Start the app first: `npx vite --port 5173 --strictPort` from `turnpoint-poc`.

## 5 Nov (later): light theme
All 12 films re-recorded on the white (light) theme with the same audio. lib.py sets localStorage turnpoint-theme=light and a white title card. The earlier dark films are kept in final_dark/.

## Round 3 (Nov 2026): Gemini voice, only the changed videos -> final_v3/
Scope for this round: `7-mobilization-tools-manpower` (re-recorded; now also shows the faulty and missing tools list at the bottom of
the Command Dashboard `/` and on `/disciplines?tab=pre-ta`) and `12-handover-confirmation-letter` (new, `/handover-archive`: Generate
confirmation letter, then Download letter). The other films in `final/` are unchanged. Output goes to `final_v3/`; `final/` and `final_dark/` are untouched.
- Voice: Google Gemini TTS, prebuilt voice `Achird`, one clip per sentence (`audio_gemini/<id>/NN.wav`, cached). Video 7 was voiced with
  `gemini-3.1-flash-tts-preview`, video 12 with `gemini-3.8-flash-lite-tts` (the free tier allows only about 10-20 requests per model per day,
  so the second film had to use another model; same voice name, slightly faster pace). gemini-3.x reads a style prefix aloud, so no prefix is
  sent to it (gemini-2.5 follows one silently; see `gemini_tts.py`). **The API key is read from the environment variable
  `GEMINI_API_KEY` only; it is never stored in a file.** Choose voice/model with `GEMINI_TTS_VOICE` / `GEMINI_TTS_MODEL`
  (default model is gemini-2.5-flash-preview-tts; set `GEMINI_TTS_MODEL=gemini-3.1-flash-tts-preview` to reproduce video 7).
- Scripts and clicks: `videos_v3.py` (same structure as `videos.py`). Light theme, 1920x1080, captions and demo cursor as before.
- Regenerate (app on :5173, machine idle):
  ```
  set GEMINI_API_KEY=...            (PowerShell: $env:GEMINI_API_KEY="...")
  python tts_v3.py 7-mobilization-tools-manpower 12-handover-confirmation-letter     # clips + audio_gemini/<id>/all.wav, clips.json
  python run_v3.py <id> rec                                                           # Playwright recording -> out/<id>.webm
  python mux3.py <id>                                                                 # screen + sentence clips -> final_v3/<id>.mp4
  ```
  Then delete `raw/` and `out/`. `run_v3.py <id> dry` checks every click still lands without recording.
- Free-tier daily quota (HTTP 429, "requests per day") is the limit that bites; `gemini_tts.py` retries with back-off and caches, so a re-run only fetches missing clips.
- `final_v3/` holds only these two films. Films: 7 = 68.5 s, 12 = 31.6 s, both 1920x1080 H.264 + AAC, white theme.
