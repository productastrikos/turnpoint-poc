# PBC 03 demo videos: redo brief (5 Nov 2026)

Source of truth: `../../PBC 03 Spectrum comments on videos.xlsx` (column G, "Spectrum Comments 04.11.2026"), plus the owner's feedback:
the videos feel AI-made, the voice-over is bad, explanations are unnecessary and robotic. Redo all of them so they sound like a person
walking a colleague through the screen.

## What changed in the app (already done, verified)
| Spectrum comment | What the app now does | Where |
|---|---|---|
| 1A: when scope is created, show SAP side by side to confirm it exists in SAP; same for manual upload | Creating a scope item (manual, bulk CSV, Excel) sends it to the SAP stand-in, SAP opens a maintenance order (CRTD / TPSC), acknowledges it, and the SAP panel opens beside OQ with a green "Received from OQ" banner and the new order at the top. OQ shows a toast "SAP confirmed: N maintenance orders created (...)". | `/scope`, button **SAP side by side** (also in the top bar) |
| 1C: bulk updates must show SAP updating at the same time | **Approve all at Gate 1/2/3** pushes the new user status to every SAP order (GT1 "Gate 1 approved", GT2, then REL + APRV); the SAP panel opens and the banner reads "N orders updated at once (bulk update)". Freeze pushes SFRZ. | `/scope` > 3-gate approvals |
| 7: syncing, and it can be automated | Attendance page has an **Automatic sync** switch with interval (15 s demo / 1 min / 5 min) and a countdown. | `/attendance` |
| 8: re-work must include equipment (manlift, scaffolding) with man-hours | New section "Re-work by equipment" (chart + table), a tile "Equipment tied up", equipment fields in Capture re-work, and the generated report includes it. | `/pre-ta/rework-reports` |
| 13: interface inventory, Intelex / DMS / MOC base scope | New tab **Interface inventory** (7 interfaces). Intelex, DMS, MOC are shown as design only, base scope. | `/integrations?tab=interfaces` |

## Rules from the comments (do not miss)
- **1A video**: remove the voice-over about the logo change / application name. (The OQ logo and "Ask S!a" can stay on screen, just do not talk about them.)
- **2 video**: remove the voice-over about the discipline tab having moved to the left pane. Just show and explain the dashboards.
- **1A, 1C**: add the SAP side-by-side moments above. Record a **bulk update verification** video (see new video below).
- **7**: show the automatic sync switch.
- **8**: show equipment in re-work (manlift, scaffolding) next to man-hours.
- Items 3, 4, 5, 6, 9, 10 and 1B are "covered": keep their content, redo voice and pacing.
- 4: the cost AND timeline impact of a delay must stay in the story.
- Items 11 and 12 are commercial, no video. Item 13 needs no video.

## Video list to produce (12 files)
01a-scope-intake (now with SAP side by side, manual + Excel/bulk), **01c-bulk-update-in-sap (NEW)**, 01b-risk-freeze-certificate,
02-discipline-dashboards, 03-critical-path, 04-live-monitoring-delay-impact, 05-qaqc-workflow, 06-itp-tracking,
07-mobilization-tools-manpower, 08-rework-reports, 09-contractor-kpi-toolbox-talk, 10-critical-path-change-report.
The old films in `C4/demo-video/` were already removed (owner's decision). Do not recreate them.

## How the narration must sound
- Write like someone talking, not a brochure. Contractions ("it's", "you'll"). First person plural is fine ("here we..."). No filler, no "seamlessly", "leverage", "robust", "comprehensive", "powerful", "streamline", "in today's", "empowers".
- One idea per sentence, mostly under 16 words. Say what the thing **does** and what you are about to click, then let the screen speak. Never narrate what is obviously visible.
- Say each function once, plainly: what it is, what happens when you click, what the result means. Nothing more, nothing less. No recap at the end, no "as you can see", no intro that announces the video.
- Do not open with the product name or a greeting. Start on the first action.
- Numbers only when they are on screen and matter. Spell abbreviations naturally: say "S A P" as "SAP", "O Q" as "OQ", "Ask Sia" for S!a. Avoid forced spacing like "C S V" (it was making the old voice stilted); write the words the way a person says them ("CSV", "ITP", "KPI", "HSE") and listen to the result; adjust spelling only if the voice mispronounces.
- Target length: each video 1:00 to 2:15 (01a up to 3:00). Shorter than the old ones.
- Let there be small natural pauses; do not fill every second with speech. The click should happen just before the sentence that explains it.

## Voice (ElevenLabs, in the browser)
- Use the owner's logged-in Chrome (`mcp__claude-in-chrome__*`, load the tools via ToolSearch first), ElevenLabs web app, Text to Speech. Previous voice "David - Audiobook & Documentary" sounds like a robot: pick a more natural, conversational male or female narrator voice from the library (try a few of the same 5-line sample; prefer relaxed, mid-pace, slightly imperfect delivery). Settings: Stability about 40-55%, Similarity high, Style low, speaker boost on. If a v3 / "Eleven v3" model with audio tags is available use it sparingly (no dramatic tags). Use one voice for all videos.
- Free credits were about 113 left at last check (1 credit per character). 12 videos need roughly 7,000 characters. **If credits are not enough, stop and tell the owner exactly how many characters are needed; do NOT buy or upgrade a plan, and do not enter payment details.** Generate in small chunks (one video at a time) so a shortage is found early.
- Download each result as `audio/<id>.mp3`. Save the final scripts into `narration.json` and `videos.py` as well.

## Pipeline (already exists in this folder: lib.py, run.py, videos.py, mux.py, audiosplit.py, all.sh)
- Read `README.md` in this folder first. Dev server: `npx vite --port 5173 --strictPort` from `turnpoint-poc` (already running on 5173 if the preview server is up; check first). Never `npm install` without `--prefix "$PWD"`.
- **Record at 1920x1080** (`W, H` in `lib.py`) so the SAP panel is readable; 1600x900 is too small for the side-by-side shots. Keep the demo cursor and captions.
- The SAP panel opens by itself after a SAP confirmation or a bulk approval; to show it deliberately click the **SAP side by side** button (top bar). Wait about 1.5 s after a create for the green SAP banner and order row. In 01a: create one item by hand (use the "P-205 pump overhaul" example, click **Create anyway** or **Create at Gate 1** whichever the button says), then show SAP; then Excel import > Use sample > Import (3 rows) and show SAP again (3 new orders). In 01c: Approve all at Gate 1, show the SAP panel with the GT1 status on many orders; optionally Gate 2.
- Start every video from a fresh page load so numbers are the seed numbers. Press the app's Reset if a video relies on starting data.
- The title card at the start of each video is optional: keep it very short (under 2 s) or drop it; do not narrate it.
- Remove dead time. Do not leave the cursor idle for more than a second or two while nothing happens.
- Output `final/<id>.mp4` (H.264 + AAC). Delete the `raw/` and `out/` scratch folders when done.

## Verify before reporting done
- Watch each final video by extracting frames (ffmpeg, e.g. one frame every 3 s into a contact sheet) and LOOK at them: the SAP panel visible in 01a and 01c, no console errors, no empty pages, captions readable.
- Check each audio track lines up with what is on screen (the sentence for a click should start just after the click) and that no sentence is cut off.
- Re-read every script against the "how it must sound" rules and cut anything that does not explain a function.
- Report: file list with durations, anything mocked, anything that could not be verified, and whether ElevenLabs credits ran short.
