# Demo script: the three AI capabilities (about 10 minutes)

Order: 1 Duplicate scope detection, 2 Risk prediction, 3 Chatbot. Each step names the menu item or tab exactly as it appears on screen.

## Before you start (1 minute)
1. Open http://localhost:5173 (or double-click `Run TURNPOINT.bat`).
2. Top bar: press **Reset**. Check **Active TA = STO-2026 · ACTIVE** and **View as = TA Event Manager**.

---

## 1. AI duplicate scope detection (3-4 min)

**Open:** left menu **Scoping & Worklist Frozen** > **Scope & Worklist** > tab **Worklist** (opens by default).

1. Scroll to the card **AI duplicate scope detection** (AI MODEL badge). Point at the chips: **2 duplicates**, **3 bundle opportunities**, and the line "Avoidable double counting: OMR ... and ... man-hours".
2. First finding: **J-2235 is a 91% duplicate of J-2230** (R-101 outlet nozzle weld repair). Click **Why 91%?** and read the reasons (same equipment R-101, same component: nozzle).
3. Click **Merge J-2235 into J-2230**. A toast confirms: estimate and man-hours consolidated, SAP notification closed, model retrained.
4. Top right of the Worklist, click **New scope item**. Stay on the **Manual entry** tab.
   - Scope description: `Weld repair on R-101 outlet nozzle`
   - Equipment tag: `R-101`
   - A warning appears as you type: **Possible duplicate of J-2230 (92%)**. Click **Cancel, it is a duplicate**.
5. Optional: reopen **New scope item** > tab **Excel import** (the **AI duplicate check** column) or tab **SAP notifications / orders**. Optional: **How it works** on the card.

Say: "Hundreds of requests come from SAP, Excel and people. The AI checks every entry route before approval, so the same job is not paid for twice."

## 2. AI risk prediction (3 min)

**Open:** left menu **AI Analytics** > tab **Risk prediction**.

1. Four tiles: **Chance of finishing by 05 Sep = 21%**, **AI P50 finish = 06 Sep**, **CP1 slip risk = 78%**, **Expected cost of delay = OMR 343K**.
2. Chart **Finish date across 2,000 simulated turnarounds**. Click **How the model works**.
3. Card **Recommended actions (modelled)**: click **Accept** on "Add a second night crew on CPA-003, R-101 internals inspection". The 21% rises to about 58%.
4. Click tabs **Predictive critical path** and **Schedule forecast** for a few seconds each.
5. Left menu **Command Dashboard**: the **AI Risk Prediction** card shows the same live numbers.

Say: "A model scores every activity for slip risk, then 2,000 simulated runs give the finish-date odds. Each action is re-simulated, so you see what it buys."

## 3. AI chatbot (2 min)

**Open:** purple **Ask TURNPOINT** button in the top bar (works on any page), or left menu **AI Analytics** > tab **Assistant**.

Suggested question chips show on a fresh chat; after the first question, type the rest:
1. Click `What's blocking CP2 right now?` (shows "Read the critical path / Ran the risk model" steps and an **Open Critical Path** link).
2. Type `Are there any duplicate scope items?`
3. Type `What are the chances we finish on the schedule forecast?`
4. Optional: top bar **View as** > Contractor Supervisor, ask `Are we over budget?` (cost figures should be hidden for contractors).

Say: "It answers from the same live data as the screens, using tools. The badge says ON-DEVICE AI; with an API key it uses Claude."

## Bonus: SAP and P6 reacting live (2 min)
Open http://localhost:5173/ext/split. Press **SAP notification: V-102 (AI flags duplicate)**, then **P6: extend E-204 Retube +3 days, Schedule (F9)**. The dashboard shows the "Live from SAP & Primavera P6" feed and the AI forecast moves. Press **Reset demo** afterwards.

## Be honest about
- The models are real code but train on generated history. Real accuracy needs OQ's past worklists and turnarounds.
- SAP and P6 are stand-in consoles, not OQ's systems.
- The chatbot runs on-device unless an Anthropic key is in `.env.local`.
