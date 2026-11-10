"""PBC 03 round 3 videos (Gemini voice, light theme): only the two that changed.

  7-mobilization-tools-manpower   re-recorded, now with the faulty and missing tools list on the Command Dashboard
  12-handover-confirmation-letter new, /handover-archive

Each video is a list of (spoken sentence(s), scene function, caption override). Same structure as videos.py.
ASCII only. Narration rules: VIDEO_BRIEF.md (conversational, one idea per sentence, no recap, no greeting).
"""
import os, time

DLG = "[role=dialog]"
TOOLS_WIDGET = "Contractor tools"          # title of the widget on the Command Dashboard


def cap_top(d, on):
    """Move the caption bar to the top of the screen while the tools list at the page bottom is on show (restores it after)."""
    d.page.evaluate("on => { const c = document.getElementById('__cap'); if (c) { c.style.bottom = on ? 'auto' : ''; c.style.top = on ? '78px' : ''; } }", on)


# ---------------------------------------------------------------- item 7
def v07():
    def s1(d):
        d.go("/attendance")
        d.wait(1200)
        d.tap("Sync from attendance system", pause=3200)

    def s2(d):
        d.tapsel("input[type=checkbox]", pause=6500)

    def s3(d):
        d.tap("Simulate 6 check-ins", pause=3000)

    def s4(d):
        d.go("/mobilization")
        d.wait(1800)
        d.tap("Simulate contractor mobilizes crew", pause=3500)

    def s5(d):
        d.go("/")
        d.wait(1500)
        cap_top(d, True)
        d.scroll(TOOLS_WIDGET)
        d.wait(1500)

    def s6(d):
        cap_top(d, False)
        d.go("/mobile-capture")
        d.tap("Tools", nth=0, scope="main", pause=1500)
        d.tap("Fill demo data", pause=2500)

    def s7(d):
        d.tap("Send to tool crib", pause=3200)

    def s8(d):
        d.go("/")
        d.wait(1200)
        cap_top(d, True)
        d.scroll(TOOLS_WIDGET)
        d.wait(2500)

    def s9(d):
        d.go("/disciplines?tab=pre-ta")
        d.wait(1500)
        cap_top(d, True)
        d.scroll("Faulty and missing tools")
        d.wait(2500)

    def s10(d):
        cap_top(d, False)
        d.go("/tools-tracking")
        d.wait(1800)
        d.tap("Confirm at crib", pause=2000)
        d.tap("Order replacement", pause=2500)

    return [
        ("Manpower comes from the site attendance system. Sync pulls in the badge swipes and matches them to each contractor.", s1, None),
        ("Syncing can also run by itself. Switch on Automatic sync, and it keeps polling.", s2, None),
        ("Six more workers badge in, and the mobilized headcount goes up.", s3, None),
        ("The mobilization plan compares planned crews with who's arrived. Simulate a crew arriving, and it updates.", s4, None),
        ("The Command Dashboard now lists faulty and missing tools at the bottom. Seven faulty, three missing.", s5, None),
        ("Out in the field, an operator reports a broken tool from the mobile app, with a photo and a priority.", s6, None),
        ("Send it, and it goes straight to the tool crib.", s7, None),
        ("Back on the dashboard, the counts have moved. One more faulty tool, one more waiting for a replacement.", s8, None),
        ("The same list sits on the Pre-TA discipline dashboard, for all contractors.", s9, None),
        ("The tool crib confirms the report and orders a replacement. Every step is recorded.", s10, None),
    ]


# ---------------------------------------------------------------- item 12
def v12():
    def s1(d):
        d.go("/handover-archive")
        d.wait(2500)

    def s2(d):
        d.tap("Generate confirmation letter", pause=3200)

    def s3(d):
        d.wait(1500)

    def s4(d):
        # click Download letter, catch the real downloaded file and show its content over the page
        try:
            with d.page.expect_download(timeout=8000) as info:
                d.tap("Download letter", pause=600)
            dl = info.value
            path = dl.path()
            html = open(path, encoding="utf-8").read()
            name = dl.suggested_filename
            d.page.evaluate("""a => { const o = document.createElement('div'); o.id = '__letter';
              o.style.cssText = 'position:fixed;inset:60px 360px 120px 360px;z-index:2147483645;background:#fff;border:1px solid #cbd5e1;border-radius:12px;box-shadow:0 20px 60px rgba(15,23,42,.3);display:flex;flex-direction:column;overflow:hidden';
              const h = document.createElement('div'); h.textContent = 'Downloaded file: ' + a[1];
              h.style.cssText = 'font:600 14px Inter,system-ui,sans-serif;padding:10px 16px;background:#f1f5f9;color:#0f172a;border-bottom:1px solid #e2e8f0';
              const f = document.createElement('iframe'); f.srcdoc = a[0]; f.style.cssText = 'flex:1;border:0;background:#fff';
              o.appendChild(h); o.appendChild(f); document.body.appendChild(o); }""", [html, name])
        except Exception as e:  # keep the film going even if the download hook fails
            d.misses.append("download:" + str(e)[:60])
        d.wait(4500)

    def s5(d):
        d.page.evaluate("() => { const o = document.getElementById('__letter'); if (o) o.remove(); }")
        d.scroll(0.45)
        d.wait(2500)

    return [
        ("This is the handover register. Every document set, by discipline and asset, with its status.", s1, None),
        ("Generate confirmation letter builds the letter from the live register.", s2, None),
        ("It gets a reference number, the archive folder in OQ's shared drive, and the open formats.", s3, None),
        ("Download letter saves the file, ready to sign and send to OQ.", s4, None),
        ("The handover counts as complete once every set shows as archived.", s5, None),
    ]


VIDEOS = {
    "7-mobilization-tools-manpower": v07,
    "12-handover-confirmation-letter": v12,
}
