# TURNPOINT audit: Siemens AI ask + SAP / P6 two-way integration (19 Oct 2026)

## 1. What was asked, and where it came from

| Source | Ask |
|---|---|
| Client checklist `TA Digitalization DEMO Check List 7 Oct2026.xlsx` | AI lines: **G12** AI risk prediction, **G13** AI chatbot, **S9** AI-based duplicate scope detection (plus X16 schedule forecast, X17 predictive CP, X28 / C5 AI close-out report) |
| Murukesh Y. (Siemens) | Siemens can demonstrate the rest of the checklist; needs **Astrikos support on G12, G13 and S9** |
| Subodh Murarka (Spectrum) | Those three go into a **short video**, played at the end of Thursday's customer demo "to comply with the check list" |
| Amit Garsund (Teams) | SAP Business Accelerator Hub **sandbox**: sign in with SAP Universal ID, Try Out > Sandbox, API key, call from Postman or the app |
| Boss (19 Oct) | **Two-way SAP and Primavera P6**: a change made in SAP / P6 shows up in TURNPOINT, and a click in TURNPOINT shows up in SAP / P6. Front-end demo is acceptable; it is a POC |

Not in the folder: the newer `TA Digitalization DEMOFlow ...xlsx` (with Subodh's demo-flow sheet, the yellow "repetitive" rows and Siemens' "can demonstrate" column). This audit uses the 7 Oct checklist. Drop the DEMOFlow file into `C4/` to align the video with Siemens' running order.

## 2. Health check (all fine)

- Swept **105 URLs** (64 routes, every `?tab=`) at 1920x1080 in headless Chromium: **0 console errors or warnings, 0 failed requests, 0 external requests (works offline), 0 horizontal overflow, 0 clipped text**.
- Contact sheets of all 105 screens reviewed by eye. The visual system is consistent (one token set, one card / table / chip language), dark and light themes both hold, and the fixes from the three earlier audits (`AUDIT_FINDINGS.md`) are intact.
- The scenario numbers still agree across pages (Day 14 of 32, SPI 0.94, OMR 11.80M / 12.21M, 18 CP changes).

## 3. Gaps that matter for Thursday

### 3.1 The three AI items are scripted, which is weak for a compliance video

| Line | Today | Why it is weak on video | Fix |
|---|---|---|---|
| **G12** AI risk prediction | Static numbers in `aiMock.ts` (68 %, 12 %, 9 %); "What drives the prediction" weights are labelled *illustrative*; recommendations are fixed text | An evaluator asking "how is 68 % computed?" gets no answer. Numbers never move when the field updates progress | A real model in the browser: logistic slip model trained on a documented history set, Monte Carlo over the CP1/CP2/CP3 network for P10 / P50 / P90 finish, per-activity drivers (feature contributions), recommendations whose effect is computed by re-running the model ("adds a night crew: 68 % to 31 %"). Updates live when a CP status changes |
| **G13** AI chatbot | 14 canned answers matched by keyword (`aiService.ts`); anything off-script gets "try one of the suggestions" | Any unscripted question in the meeting breaks it | A real LLM assistant (Claude, through a local relay so the key never reaches the browser) that **calls the same service layer the screens use** (tools: critical path, budget, risks, scope, duplicates, materials, integrations, readiness...), shows which data it read and links to the page. Contractor role is enforced in the tool layer (no cost data returned), not by prompt. Offline / no key: an on-device engine that answers from live data, clearly labelled |
| **S9** AI duplicate scope detection | 4 hard-coded pairs with fixed % in `scopeMock.ts`. Two of them are not duplicates at all (V-102 nozzle *inspection* vs V-102 *access platform*; T-201 *spool* vs T-201 *trays*) | A process engineer will spot that the "duplicates" are different jobs. Nothing is detected when a new item is created or imported | A real detector (see 3.2): runs over the whole worklist, on every new item **as you type**, on Excel / bulk import and on every SAP notification that arrives. Separates **true duplicates** (merge) from **bundle opportunities** (same equipment and work front, different work: share scaffold / isolation / permit). Planner feedback ("not a duplicate") retrains it |

### 3.2 What "AI-based duplicate scope detection" means in a turnaround

Scope comes in from many originators (operations, inspection, maintenance, projects) and channels (SAP notifications, Excel, manual). The same work gets raised twice with different words ("R-101 outlet nozzle weld overlay repair" vs "Weld build-up on R-101 nozzle N2, thinning found"), and each copy carries its own estimate, man-hours, scaffold and permit. Industry practice for duplicate detection in work orders / demands / tickets (ServiceNow demand similarity at about 85 %+, support-ticket dedup at 0.90+, two-stage "embedding similarity then model validation" in recent research) is a layered pipeline:

1. **Blocking** on the asset: same equipment tag / functional location / line number (normalised: `V-102`, `V102`, `10-V-102`).
2. **Meaning-level text similarity** of the descriptions (domain synonyms: replace / renew, overlay / build-up, CUI / corrosion under insulation, inspect / NDT / survey).
3. **Attribute agreement**: component (nozzle, tray, spool, bundle, seal), action class (inspect, replace, repair, clean, test), damage mechanism, discipline, area, overlapping time window.
4. **A classifier** that turns those signals into a probability, with the reasons shown, and a human decision (merge / bundle / not a duplicate) that feeds back.

The payoff to show: avoided double estimate (OMR and man-hours), one scaffold and one permit instead of two.

### 3.3 SAP and P6 two-way integration: what is possible

Research results (verified by probe where possible):

- **SAP sandbox** `https://sandbox.api.sap.com/s4hanacloud/sap/opu/odata/sap/<SERVICE>/<EntitySet>`, header **`APIKey`** (verified: a call without it returns *"Failed to resolve API Key variable request.header.apikey"*). CORS is open (`Access-Control-Allow-Origin: *`, `apikey` allowed). Services relevant to a turnaround: `API_MAINTNOTIFICATION` (MaintenanceNotification), `API_MAINTENANCEORDER` (MaintenanceOrder, to_MaintenanceOrderOperation). It is SAP's **shared sample tenant**: reading works, but nobody can change its data, so it cannot show "change in SAP, see it in TURNPOINT" or the write-back.
- **Primavera P6** has no public sandbox. EPPM REST needs a licensed tenant; P6 Professional exchanges **XER** files (already in the hub as a simulated round trip).

Design (front-end only, honest labels):

1. **SAP and P6 stand-in consoles**: `/ext/sap` (Fiori-style maintenance orders / notifications) and `/ext/p6` (P6-style activity grid + Gantt + Schedule F9). They open in their **own browser windows** (or side by side in a split view for recording), keep their own data, and talk to TURNPOINT through a **local message bus** using the real payload shapes (OData field names, P6 TASK fields). Every screen carries "demo stand-in for the client's SAP / P6".
2. **Live read from the real SAP sandbox** once the API key is provided, through a local relay so the key stays out of the browser bundle (`.env.local`). Imported sandbox records become scope items with their real SAP numbers. Cached for offline replay.
3. Two-way flows to demo:

| Direction | Action | What the audience sees |
|---|---|---|
| SAP to TURNPOINT | Planner creates a notification in SAP | It lands in TURNPOINT scope at Gate 1 with an SAP chip, and the duplicate detector flags it if it repeats existing scope |
| SAP to TURNPOINT | Cost / priority of a work order changed in SAP | Estimate and budget roll-up update in TURNPOINT, inbound message logged |
| TURNPOINT to SAP | Scope item approved at Gate 3 / SCF approved / freeze reissued | Order created or user status (APRV, SFRZ) set in the SAP console, "changed by TURNPOINT_INT" |
| P6 to TURNPOINT | Planner changes a duration and presses Schedule (F9) | TURNPOINT critical path dates / float update and the "CP changed" counter goes up |
| TURNPOINT to P6 | Field progress / CP status update, discovery job approved | % complete, actual start, remaining duration update in P6; a new activity appears and P6 reschedules |

### 3.4 Minor UI / consistency items (small, delegated)

- Portfolio shows STO-2026 readiness **94 %** (hard-coded) while Executive Summary and Readiness compute **87 %** (known issue in `DEMO_GUIDE_VALUE_FIRST.md` section 6).
- Area Handover "Punch A open **94**" vs MC Certificates "Punch A open **101**" (different scopes, unlabelled).
- Close-Out > Generate with AI: page is almost empty before the click (no preview of what will be generated).
- Critical Path dependency network: long node names are ellipsised with no way to read them.

### 3.5 Images and digital twin

There are **no images, AI-generated pictures or 3D / digital-twin views in TURNPOINT** (only `favicon.svg`; the only 3D is the Remotion intro / outro of the demo film). Nothing in the checklist asks for a 3D twin, and Siemens' ask is the three AI lines, so a plant twin is **not recommended before Thursday**. A follow-up option after the meeting: a plot-plan / 3D unit view coloured by turnaround status (opened, in progress, boxed up, on critical path), which would also serve the "GPS / maps" part of the mobile line.

## 4. Build order

1. Duplicate detector (S9) with live checks in create / import / SAP inbound.
2. Risk model + Monte Carlo (G12, also feeds X16 / X17 and the dashboard card).
3. Integration bus + SAP and P6 stand-in consoles (boss ask).
4. AI assistant with tools over the live services (G13), relay + on-device fallback.
5. SAP sandbox live read (needs the key).
6. Verify, update `MOCK_VS_REAL.md`, README and the demo guide; then the short AI video.

## 5. What we need from you

- **SAP API key** from api.sap.com (Settings > Show API Key). Put it in `turnpoint-poc/.env.local` as `SAP_API_KEY=...` (do not paste it in chat).
- **Anthropic API key** for the live assistant, in the same file as `ANTHROPIC_API_KEY=...`. Optional: without it the assistant runs on the on-device engine.
- The DEMOFlow xlsx, if the video should follow Siemens' order.
