"""PBC 03 demo videos: narration + the clicks that go with each sentence.

Each video is a list of segments (narration text, scene function, caption override). Narration is read by the ElevenLabs
voice; the scene function drives the app while that sentence plays. ASCII only so the file is safe everywhere.

Rewritten 5 Nov 2026 (Spectrum comments): short spoken-style scripts, no title cards, SAP side by side in 01a and 01c.
Acronyms are spelled out where the voice might stumble (turnaround, inspection test plan, purchase order); SAP, OQ, CSV,
KPI and HSE are left as words. Caption override None = the on-screen caption shows the spoken text.
"""

DLG = "[role=dialog]"
SAPF = "iframe[title^=SAP]"


# ---------------------------------------------------------------- item 1a: scope intake, with SAP side by side
def v01a():
    def s1(d):
        d.go("/scope")
        d.wait(2200)

    def s2(d):
        d.tap("New scope item", pause=2200)

    def s3(d):
        d.tap("P-205 pump overhaul", scope=DLG, pause=1500)
        d.scroll("AI budget estimate")
        d.wait(2500)

    def s4(d):
        d.scroll("Possible duplicate")
        d.wait(2500)

    def s5(d):
        d.tap("Create anyway", scope=DLG, pause=3800)

    def s6(d):
        d.tap("New scope item", pause=1000)
        d.tap("Excel import", scope=DLG, pause=700)
        d.tap("Use sample", scope=DLG, pause=1500)
        d.tap("valid rows", scope=DLG, pause=2500, wait=5000)

    def s7(d):
        d.wait(2800)

    def s8(d):
        d.tapsel("button[aria-label='Close SAP view']", pause=900)
        d.page.keyboard.press("Escape")
        d.wait(500)
        d.scroll("AI duplicate scope detection")
        d.tap("Why 91%", pause=3000)

    def s9(d):
        d.scroll(0)
        d.tap("3-gate approvals", pause=2500)

    return [
        ("This is the scope worklist. Nothing's frozen yet, so we can still add work.", s1, None),
        ("New scope item opens the form. It tracks the mandatory fields, so nothing gets created half empty.", s2, None),
        ("I'll load the pump overhaul example. The AI budget estimate suggests a cost from similar past jobs.", s3, None),
        ("The AI also flags it as a possible duplicate, so the button reads Create anyway. We'll go ahead.", s4, None),
        ("Create it, and the order lands in SAP straight away. There it is at the top, status CRTD.", s5, None),
        ("Excel works the same way. Load the sample file, and import the rows.", s6, None),
        ("Three more orders in SAP. Either way, scope created in OQ is confirmed in SAP.", s7, None),
        ("Duplicate detection lists look-alike items with its reasons, and the planner can merge them.", s8, None),
        ("Then every item goes through three approval gates.", s9, None),
    ]


# ---------------------------------------------------------------- item 1c (NEW): bulk update shown in SAP at the same time
def v01c():
    def s1(d):
        d.go("/scope")
        d.wait(1500)
        d.tap("SAP side by side", scope="main", pause=2500)

    def s2(d):
        d.tap("3-gate approvals", pause=2200)

    def s3(d):
        d.tap("Approve all at Gate 1", pause=300)
        d.settle(hold=2200)

    def s4(d):
        d.point("text=updated at once", frame=SAPF, pause=2200)

    def s5(d):
        d.tap("Approve all at Gate 2", pause=300)
        d.settle(hold=2200)

    def s6(d):
        d.tap("Approve all at Gate 3", pause=300)
        d.settle(hold=2200)

    def s7(d):
        d.tapframe("Change log", pause=3500)

    return [
        ("First, open SAP beside OQ, so we can watch both at once.", s1, None),
        ("Bulk approvals live under three-gate approvals. Each gate has an Approve all button.", s2, None),
        ("Approve all at Gate 1. Every order in SAP takes the Gate 1 approved status at the same moment.", s3, None),
        ("The banner counts how many orders were updated at once.", s4, None),
        ("Now Gate 2, and SAP follows.", s5, None),
        ("At Gate 3, SAP sets the orders to released and approved.", s6, None),
        ("SAP's change log keeps every update that came from OQ.", s7, None),
    ]


# ---------------------------------------------------------------- item 1b: risk, challenge, freeze, certificate, variations
def v01b():
    def s1(d):
        d.go("/scope")
        d.wait(1500)
        d.tap("Risk-based optimisation", pause=1500)
        d.scroll("Impact of risk on the scope")

    def s2(d):
        d.tap("Simulate risk event", pause=3500)

    def s3(d):
        d.scroll(0)
        d.tap("Scope challenge", pause=1500)
        d.scroll(0.35)

    def s4(d):
        d.scroll(0)
        d.tap("Variations", nth=0, pause=1500)
        d.scroll(0.4)

    def s5(d):
        d.scroll(0)
        d.tap("Freeze certificate", pause=2500)
        d.tap("Fast-forward demo", pause=300)
        d.settle(hold=2000)

    def s6(d):
        d.tap("Freeze scope and generate certificate", pause=7000, wait=20000)
        d.scroll(0.35)

    def s7(d):
        d.scroll(0)
        d.tap("Simulate post-freeze request", pause=3000, wait=20000)
        d.tap("Variations", nth=0, pause=1500)
        d.scroll(0.45)

    return [
        ("The risk tab ranks scope items on a risk matrix. This panel shows what each risk adds, in cost and in critical path days.", s1, None),
        ("Simulate a risk event. Cost and timeline impact update straight away, so the team can keep, mitigate, or add contingency.", s2, None),
        ("Scope challenge ranks the bulk-loaded items by cost, hours and risk. Costly, low-risk work gets questioned first.", s3, None),
        ("Variations tracks every change before the freeze: who asked, what it costs, who approves. Eight are still pending.", s4, None),
        ("The freeze tab shows what's blocking it. For the demo, fast-forward approves every gate.", s5, None),
        ("Freeze the scope, and the certificate is generated, with the three gate signatures and the SAP freeze status.", s6, None),
        ("After the freeze, a new request becomes a variation against revision A. Simulate one to see it tracked.", s7, None),
    ]


# ---------------------------------------------------------------- item 2: discipline dashboards
def v02():
    def s1(d):
        d.go("/")
        d.wait(1200)
        d.tap("Discipline Dashboards", scope="aside.sidebar", pause=2500)

    def s2(d):
        d.tap("Pre-TA", scope="main", pause=1500)
        d.scroll(0.5)

    def s3(d):
        d.scroll(0)
        d.tap("Rotating Equipment", scope="main", pause=2500)

    def s4(d):
        d.tap("TA execution", scope="main", pause=1500)
        d.tap("Inspection", scope="main", pause=2200)

    def s5(d):
        d.tap("Post-TA", scope="main", pause=2500)
        d.scroll(0.5)

    return [
        ("Each discipline gets its own dashboards, for pre-turnaround, execution and post-turnaround.", s1, None),
        ("Pre-turnaround covers mobilisation, material readiness, re-work, and the top focus areas for that discipline.", s2, None),
        ("Switch the discipline, here Rotating Equipment, and the priorities change with it.", s3, None),
        ("Execution shows progress against plan, critical activities, quality and productivity.", s4, None),
        ("Post-turnaround is about close-out: what's still open, and what hands over.", s5, None),
    ]


# ---------------------------------------------------------------- item 3: critical path CP1 CP2 CP3
def v03():
    def s1(d):
        d.go("/critical-path")
        d.wait(2500)

    def s2(d):
        d.tap("CP2", scope="main", pause=1800)
        d.tap("CP3", scope="main", pause=1800)
        d.tap("All paths", scope="main", pause=1200)

    def s3(d):
        d.tap("Near-critical work", scope="main", pause=2500)

    def s4(d):
        d.tap("Dependency network & insights", pause=2500)
        d.scroll(0.4)

    def s5(d):
        d.scroll(0)
        d.tap("Activities", nth=0, pause=1500)
        d.scroll(0.35)

    return [
        ("The critical path monitor shows the three driving paths, calculated from the schedule, not drawn by hand.", s1, None),
        ("Each path has its own length, float and finish date. Pick a path, and you only see its activities.", s2, None),
        ("Work with under five days of float is near critical. A small slip turns it critical, so it's watched separately.", s3, None),
        ("The dependency view shows which crews sit on more than one critical activity, and what a day of delay costs.", s4, None),
        ("The activities list has every activity with its float, criticality and status.", s5, None),
    ]


# ---------------------------------------------------------------- item 4: live monitoring and delay impact (time AND cost)
def v04():
    def s1(d):
        d.go("/critical-path")
        d.wait(1500)
        d.tap("Live monitor & delay impact", pause=2500)

    def s2(d):
        d.tap("Next demo delay", pause=3500)
        d.scroll(0.25)

    def s3(d):
        d.scroll(0.55)
        d.wait(2500)

    def s4(d):
        d.scroll(0.9)
        d.wait(2500)

    def s5(d):
        d.scroll(0.3)
        d.tap("Night crew", pause=3000)

    def s6(d):
        d.scroll(0)
        d.tap("Next demo delay", pause=3500)
        d.scroll(0.3)

    return [
        ("Live monitoring recalculates the critical path whenever progress changes. In production the feed comes from the field app and Primavera. Here it's simulated.", s1, None),
        ("Trigger a delay. A crane conflict holds one line for two days. The finish date moves, and the cost shows up, as standby and overrun.", s2, None),
        ("Activities that just turned critical are listed, and the driving path can switch. The event feed says what changed, and why.", s3, None),
        ("Near-critical work is watched, so anything running out of float shows up before it hurts the finish date.", s4, None),
        ("Recovery options show what each one saves, in days and in cost. Apply a night crew, and the impact recalculates.", s5, None),
        ("One more delay, and the path changes again. Every change is counted for the end of turnaround report.", s6, None),
    ]


# ---------------------------------------------------------------- item 5: QA/QC acceptance workflow
def v05():
    def s1(d):
        d.go("/qaqc")
        d.wait(2500)

    def s2(d):
        d.tap("Issue new PO (demo)", pause=3500)

    def s3(d):
        d.tap("Request ITP from vendor", scope=DLG, pause=3500)

    def s4(d):
        d.jsclick("Fast-forward PO", pause=2500)
        d.jsclick("Fast-forward PO", pause=2500)
        d.jsclick("Fast-forward PO", pause=2500)

    def s5(d):
        d.tap("Close", scope=DLG, pause=1800)
        d.scroll(0)
        d.wait(2000)

    def s6(d):
        d.tap("Exchanger inspections", pause=3500)

    return [
        ("Every purchase order moves through inspection test plan approval, inspection, non-conformance handling and acceptance.", s1, None),
        ("Issue a purchase order, and it enters at stage one. The stepper runs from order issued to certificate and release.", s2, None),
        ("Each stage offers an action to the right role. Here, the vendor is asked for the inspection test plan.", s3, None),
        ("Fast-forward, and each stage is cleared by its owner: the QA and QC lead, the inspector, and site receiving.", s4, None),
        ("The counters show what needs attention: plans awaiting approval, overdue hold points, open non-conformances, certificates issued.", s5, None),
        ("On site, each heat exchanger follows the same discipline, from pre-cleaning to final inspection, signed at every stage.", s6, None),
    ]


# ---------------------------------------------------------------- item 6: ITP tracking after PO issuance
def v06():
    def s1(d):
        d.go("/qaqc")
        d.wait(1500)
        d.tap("PO & ITP tracking", pause=2500)

    def s2(d):
        d.tap("Open PO", pause=3500)

    def s3(d):
        d.wait(3000)

    def s4(d):
        d.jsclick("Simulate inspection failure", pause=3500)

    def s5(d):
        d.tap("Close", scope=DLG, pause=1800)
        d.tap("ITP points (all POs)", pause=3000)

    return [
        ("Inspection test plan tracking starts when a purchase order is issued. This table shows each order, its vendor, and approval time against the three day target.", s1, None),
        ("Open an order to see every hold, witness and review point, with who's responsible and the planned date.", s2, None),
        ("Points are signed in order. The history records who cleared what, and when.", s3, None),
        ("Simulate an inspection failure, and a non-conformance report is raised. It blocks acceptance until the rework is closed.", s4, None),
        ("The points view shows the same picture across all orders, so overdue hold points are visible to everyone.", s5, None),
    ]


# ---------------------------------------------------------------- item 7: mobilization, manpower, faulty tools, automatic sync
def v07():
    def s1(d):
        d.go("/attendance")
        d.wait(1500)
        d.tap("Sync from attendance system", pause=3000)

    def s2(d):
        d.tapsel("input[type=checkbox]", pause=6500)

    def s3(d):
        d.tap("Simulate 6 check-ins", pause=3000)

    def s4(d):
        d.go("/mobilization")
        d.wait(2000)
        d.tap("Simulate contractor mobilizes crew", pause=3500)

    def s5(d):
        d.go("/mobile-capture")
        d.tap("Tools", nth=0, scope="main", pause=1500)
        d.tap("Fill demo data", pause=2200)
        d.tap("Send to tool crib", pause=3000)

    def s6(d):
        d.go("/mobilization")
        d.scroll("aulty")
        d.wait(2500)

    def s7(d):
        d.go("/tools-tracking")
        d.wait(2000)
        d.tap("Confirm at crib", pause=2000)
        d.tap("Order replacement", pause=2500)

    return [
        ("Manpower comes from the site attendance system. Sync pulls the check-ins and matches them to each contractor.", s1, None),
        ("Syncing can also run by itself. Switch on Automatic sync, pick an interval, and it keeps polling.", s2, None),
        ("Six more workers badge in, and the mobilized headcount updates.", s3, None),
        ("The mobilization plan compares planned crews against arrivals. Simulate a crew arriving, and the plan updates.", s4, None),
        ("In the mobile app, an operator reports a broken or missing tool, with a photo and a priority, and sends it to the tool crib.", s5, None),
        ("The faulty tool list shows on the mobilization dashboard straight away, with the contractor and the tool.", s6, None),
        ("The tool crib confirms it and orders a replacement. Every step is recorded until the tool is replaced or written off.", s7, None),
    ]


# ---------------------------------------------------------------- item 8: re-work reports, now with equipment
def v08():
    def s1(d):
        d.go("/pre-ta/rework-reports")
        d.wait(2800)

    def s2(d):
        d.scroll(0.3)
        d.wait(2500)

    def s3(d):
        d.scroll(0.55)
        d.wait(2500)

    def s4(d):
        d.scroll("Re-work by equipment")
        d.wait(3500)

    def s5(d):
        d.scroll(0)
        d.tap("Capture re-work", pause=3000)
        d.tap("Capture", scope=DLG, pause=3000)

    def s6(d):
        d.tap("Generate report", pause=4500)

    return [
        ("The re-work dashboard shows hours lost, first time right against the allowance, the cost, and now the equipment tied up.", s1, None),
        ("The Pareto ranks re-work by cause. The daily chart shows the trend through the turnaround.", s2, None),
        ("Hours are broken down by discipline and by contractor. Repeat causes are listed as the first things to fix.", s3, None),
        ("Re-work by equipment covers manlifts, scaffolding, cranes, with equipment hours next to man-hours and the cost.", s4, None),
        ("Capture a re-work event, pick the equipment used again and its hours, and every chart updates.", s5, None),
        ("Generate report writes it all up, equipment included, ready to print for the steering meeting.", s6, None),
    ]


# ---------------------------------------------------------------- item 9: contractor KPI
def v09():
    def s1(d):
        d.go("/mobile-capture")
        d.wait(1500)
        d.tap("HSE", nth=0, scope="main", pause=2000)

    def s2(d):
        d.tap("Fill demo data", pause=2500)

    def s3(d):
        d.tap("Submit toolbox talk", pause=3000)

    def s4(d):
        d.tap("Housekeeping", nth=0, scope="main", pause=2500)
        d.tap("Permits & PPE", scope="main", pause=2500)

    def s5(d):
        d.go("/contractor-kpi")
        d.wait(2500)
        d.tap("Simulate supervisor entry", pause=3500)

    def s6(d):
        d.scroll(0.5)
        d.wait(3000)

    return [
        ("Contractor KPIs start in the field. In the mobile app, the supervisor opens the HSE screen, which holds the toolbox talk template.", s1, None),
        ("It captures the topic, attendees, time, a photo of the sign-in sheet, and the supervisor sign-off.", s2, None),
        ("Submit it, and it's stored on the device and synced, even without network.", s3, None),
        ("Housekeeping and permits use the same simple screens, so contractors enter everything manually from the field.", s4, None),
        ("On the contractor KPI dashboard, a new supervisor entry arrives, and the HSE compliance figure moves.", s5, None),
        ("The HSE score combines toolbox talks, housekeeping, permits and observations, next to safety, schedule, quality and productivity. One scale for every contractor.", s6, None),
    ]


# ---------------------------------------------------------------- item 10: report on critical path changes
def v10():
    def s1(d):
        d.go("/critical-path")
        d.wait(1500)
        d.tap("CP change report", pause=2500)

    def s2(d):
        d.scroll(0.3)
        d.wait(3000)

    def s3(d):
        d.tap("Export CSV", pause=1500)
        d.scroll(0.6)
        d.wait(2000)

    def s4(d):
        d.tap("Generate end-of-TA report", pause=1500)
        d.scroll(1.0)
        d.wait(2500)

    return [
        ("The critical path is tracked daily. This report counts how many times it changed, and on which days.", s1, None),
        ("The chart shows changes per day. The list shows which activities changed it most, and why.", s2, None),
        ("The daily log says what changed each day, and exports to CSV for the close-out pack.", s3, None),
        ("At the end of the turnaround, one click generates the report: number of changes, busiest day, main drivers, and final finish date.", s4, None),
    ]


VIDEOS = {
    "01a-scope-intake": v01a,
    "01c-bulk-update-in-sap": v01c,
    "01b-risk-freeze-certificate": v01b,
    "02-discipline-dashboards": v02,
    "03-critical-path": v03,
    "04-live-monitoring-delay-impact": v04,
    "05-qaqc-workflow": v05,
    "06-itp-tracking": v06,
    "07-mobilization-tools-manpower": v07,
    "08-rework-reports": v08,
    "09-contractor-kpi-toolbox-talk": v09,
    "10-critical-path-change-report": v10,
}
