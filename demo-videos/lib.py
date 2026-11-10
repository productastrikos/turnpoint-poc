"""Shared Playwright helpers for the PBC 03 demo videos (ASCII only, UTF-8 files)."""
import time, json, os
from playwright.sync_api import sync_playwright

BASE = "http://localhost:5173"
W, H = 1920, 1080

CAPTION_JS = """
(() => {
  if (window.__cap) return;
  const s = document.createElement('style');
  s.textContent = `#__cap{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);max-width:1280px;z-index:2147483647;
  background:rgba(15,23,42,.98);color:#fff;font:600 22px/1.4 Inter,system-ui,sans-serif;padding:14px 26px;border-radius:14px;
  box-shadow:0 8px 30px rgba(0,0,0,.35);text-align:center;transition:opacity .25s;pointer-events:none}
  #__cur{position:fixed;width:22px;height:22px;border-radius:50%;background:rgba(239,68,68,.55);border:2px solid #fff;z-index:2147483647;
  pointer-events:none;transform:translate(-50%,-50%);transition:left .45s ease,top .45s ease;box-shadow:0 0 0 6px rgba(239,68,68,.2)}
  #__title{position:fixed;inset:0;z-index:2147483646;background:#ffffff;color:#0f172a;display:flex;flex-direction:column;
  align-items:center;justify-content:center;font-family:Inter,system-ui,sans-serif;text-align:center;gap:14px;transition:opacity .5s}
  #__title h1{font-size:46px;margin:0;font-weight:800}#__title p{font-size:22px;margin:0;color:#475569;max-width:900px}
  #__title .pbc{color:#fb7185;font-weight:700;letter-spacing:.14em;font-size:15px}`;
  document.head.appendChild(s);
  const c = document.createElement('div'); c.id='__cap'; c.style.opacity=0; document.body.appendChild(c);
  const u = document.createElement('div'); u.id='__cur'; u.style.left='-50px'; u.style.top='-50px'; document.body.appendChild(u);
  const m = document.createElement('div'); m.id='__sync';
  m.style.cssText='position:fixed;left:0;top:0;width:8px;height:8px;z-index:2147483647;pointer-events:none;background:transparent';
  document.body.appendChild(m); window.__syncN = window.__syncN || 0;
  /* second marker (8..16 px): red while the scene is only waiting for the app to finish; mux.py time-lapses those stretches */
  const f = document.createElement('div'); f.id='__fast';
  f.style.cssText='position:fixed;left:8px;top:0;width:8px;height:8px;z-index:2147483647;pointer-events:none;background:transparent';
  document.body.appendChild(f); window.__fast = (on) => { f.style.background = on ? '#ff0000' : 'transparent'; };
  window.__cap = (t) => { c.textContent = t || ''; c.style.opacity = t ? 1 : 0;
    /* sync marker: a corner pixel block that flips magenta/green at every caption change; mux.py reads it from the video and then paints it over */
    window.__syncN++; m.style.background = (window.__syncN % 2) ? '#ff00ff' : '#00ff00'; };
  setInterval(() => { const d = document.querySelector('.sap-dock.open'); const w = d ? d.getBoundingClientRect().left : innerWidth;
    c.style.left = (w / 2) + 'px'; c.style.maxWidth = Math.min(1280, w - 60) + 'px'; }, 200);
  window.__cur = (x,y) => { u.style.left = x+'px'; u.style.top = y+'px'; };
  window.__title = (pbc,h,sub) => { let e=document.getElementById('__title'); if(!h){ if(e){e.style.opacity=0;setTimeout(()=>e.remove(),600);} return;}
    if(!e){e=document.createElement('div');e.id='__title';document.body.appendChild(e);}
    e.style.opacity=1; e.innerHTML='<div class="pbc">'+pbc+'</div><h1>'+h+'</h1><p>'+sub+'</p>'; };
})();
"""

class Demo:
    def __init__(self, name, record=True, user="admin", viewport=(W, H)):
        self.name = name
        self.pw = sync_playwright().start()
        self.browser = self.pw.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        kw = dict(viewport={"width": viewport[0], "height": viewport[1]})
        if record:
            kw["record_video_dir"] = os.path.join(os.path.dirname(__file__), "raw", name)
            kw["record_video_size"] = {"width": viewport[0], "height": viewport[1]}
        self.ctx = self.browser.new_context(**kw)
        self.ctx.add_init_script("try{sessionStorage.setItem('turnpoint-session','ta-manager');localStorage.setItem('turnpoint-theme','light')}catch(e){}")
        self.page = self.ctx.new_page()
        self.errors = []
        self.misses = []
        self.page.on("pageerror", lambda e: self.errors.append(str(e)))
        self.page.on("console", lambda m: self.errors.append(m.text) if m.type == "error" else None)
        self.t0 = time.time()
        self.vt0 = self.t0
        self.user = user

    def login(self):
        p = self.page
        p.goto(BASE + "/", wait_until="domcontentloaded")
        p.wait_for_timeout(600)
        if p.locator("input[type=password]").count():
            p.fill("input[type=password]", "Turnpoint2026!")
            p.keyboard.press("Enter")
            p.wait_for_timeout(1200)
        self.inject()

    def inject(self):
        self.page.evaluate(CAPTION_JS)

    def go(self, path):
        self.page.evaluate("p => { history.pushState({}, '', p); dispatchEvent(new PopStateEvent('popstate')); }", path)
        self.page.wait_for_timeout(900)
        self.inject()

    def cap(self, text):
        self.inject()
        self.page.evaluate("t => window.__cap(t)", text)

    def title(self, pbc, h, sub):
        self.inject()
        self.page.evaluate("a => window.__title(a[0],a[1],a[2])", [pbc, h, sub])

    def untitle(self):
        self.page.evaluate("window.__title && window.__title()")

    def click(self, sel, text=None, pause=700, nth=0):
        loc = self.page.get_by_text(text, exact=False) if text else self.page.locator(sel)
        if sel and text:
            loc = self.page.locator(sel).filter(has_text=text)
        el = loc.nth(nth)
        el.scroll_into_view_if_needed()
        bb = el.bounding_box()
        if bb:
            self.page.evaluate("a => window.__cur && window.__cur(a[0],a[1])", [bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2])
            self.page.wait_for_timeout(520)
        el.click()
        self.page.wait_for_timeout(pause)

    def wait(self, ms):
        self.page.wait_for_timeout(ms)

    def until(self, secs):
        """Wait until `secs` seconds after the recording started (keeps actions in step with narration)."""
        left = secs - (time.time() - self.t0)
        if left > 0:
            self.page.wait_for_timeout(int(left * 1000))

    def close(self):
        self.ctx.close()
        self.browser.close()
        self.pw.stop()


def _btns(self, scope="main"):
    js = r"s => [...document.querySelectorAll(s+' button, '+s+' [role=tab]')].map(b=>b.innerText.trim().split(/\s+/).join(' ')).filter(x=>x&&x.length<70)"
    return self.page.evaluate(js, scope)


def _tap(self, text, nth=0, pause=800, scope=None, wait=0):
    """Click a button/tab/link by visible text with the demo cursor; never raises (logs a miss).
    wait = ms to keep looking for the control to appear/enable (recording is slower than a dry run)."""
    root = self.page.locator(scope) if scope else self.page
    if wait:
        end = time.time() + wait / 1000
        while time.time() < end:
            ok = False
            for l in (root.get_by_role("button", name=text), root.get_by_role("tab", name=text)):
                try:
                    if l.count() > nth and l.nth(nth).is_enabled():
                        ok = True
                        break
                except Exception:
                    pass
            if ok:
                break
            self.page.wait_for_timeout(300)
    for loc in (root.get_by_role("tab", name=text), root.get_by_role("button", name=text), root.get_by_role("link", name=text), root.get_by_text(text, exact=False)):
        try:
            if loc.count() > nth:
                el = loc.nth(nth)
                el.scroll_into_view_if_needed(timeout=2000)
                bb = el.bounding_box()
                if bb:
                    self.page.evaluate("a => window.__cur && window.__cur(a[0],a[1])", [bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2])
                    self.page.wait_for_timeout(450)
                el.click(timeout=4000)
                self.page.wait_for_timeout(pause)
                return True
        except Exception as e:  # noqa
            continue
    self.misses.append(text)
    print("   MISS:", text)
    return False


def _scroll(self, to):
    """Scroll the main pane to a fraction (0..1) or to the element with this text."""
    if isinstance(to, str):
        try:
            el = self.page.get_by_text(to, exact=False).first
            el.scroll_into_view_if_needed(timeout=2500)
            # bring it near the top of its scroller (below the sticky bars) so it is not hidden under the caption
            el.evaluate("e => { e.style.scrollMarginTop = '150px'; e.scrollIntoView({block: 'start', behavior: 'smooth'}); }")
        except Exception:
            self.misses.append("scroll:" + to)
    else:
        self.page.evaluate("f => { const m = document.querySelector('main'); const s = (m && m.scrollHeight > m.clientHeight) ? m : document.scrollingElement; s.scrollTo({top: (s.scrollHeight - s.clientHeight) * f, behavior: 'smooth'}); }", to)
    self.page.wait_for_timeout(900)


Demo.btns = _btns
Demo.tap = _tap
Demo.scroll = _scroll


def _jsclick(self, text, pause=800):
    """Click a button by its text via the DOM (for controls sitting behind an open drawer)."""
    ok = self.page.evaluate("t => { const b = [...document.querySelectorAll('button')].find(x => x.innerText.trim().startsWith(t) && !x.disabled); if (b) { b.click(); return true; } return false; }", text)
    if not ok:
        self.misses.append("js:" + text)
        print("   MISS(js):", text)
    self.page.wait_for_timeout(pause)
    return ok


Demo.jsclick = _jsclick


def _until_v(self, secs):
    left = secs - (time.time() - self.vt0)
    if left > 0:
        self.page.wait_for_timeout(int(left * 1000))


Demo.until_v = _until_v


def _tapframe(self, text, frame="iframe[title^=SAP]", pause=800):
    """Click a tab/button inside the SAP side-by-side iframe, with the demo cursor."""
    try:
        fl = self.page.frame_locator(frame)
        el = fl.get_by_text(text, exact=False).first
        bb = el.bounding_box()
        if bb:
            self.page.evaluate("a => window.__cur && window.__cur(a[0],a[1])", [bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2])
            self.page.wait_for_timeout(450)
        el.click(timeout=4000)
        self.page.wait_for_timeout(pause)
        return True
    except Exception as e:  # noqa
        self.misses.append("frame:" + text)
        print("   MISS(frame):", text, str(e)[:80])
        return False


def _tapsel(self, sel, pause=800, nth=0):
    """Click an element by CSS selector with the demo cursor."""
    try:
        el = self.page.locator(sel).nth(nth)
        el.scroll_into_view_if_needed(timeout=2000)
        bb = el.bounding_box()
        if bb:
            self.page.evaluate("a => window.__cur && window.__cur(a[0],a[1])", [bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2])
            self.page.wait_for_timeout(450)
        el.click(timeout=4000)
        self.page.wait_for_timeout(pause)
        return True
    except Exception as e:  # noqa
        self.misses.append("sel:" + sel)
        print("   MISS(sel):", sel, str(e)[:80])
        return False


def _point(self, sel, pause=900, frame=None):
    """Move the demo cursor onto an element without clicking (to draw the eye)."""
    try:
        root = self.page.frame_locator(frame) if frame else self.page
        el = root.locator(sel).first
        bb = el.bounding_box()
        if bb:
            self.page.evaluate("a => window.__cur && window.__cur(a[0],a[1])", [bb["x"] + 60, bb["y"] + bb["height"] / 2])
    except Exception:
        self.misses.append("point:" + sel)
    self.page.wait_for_timeout(pause)


Demo.tapframe = _tapframe
Demo.tapsel = _tapsel
Demo.point = _point


def _fast(self, on):
    self.inject()
    self.page.evaluate("o => window.__fast && window.__fast(o)", bool(on))


def _settle(self, busy=r"Working|Creating|Importing|Freezing|Generating", timeout=45000, hold=2200):
    """Mark the wait as 'fast' (time-lapsed in the film), wait until no button says Working/Creating..., then hold so the result can be read."""
    self.page.wait_for_timeout(500)
    self.fast(True)
    end = time.time() + timeout / 1000
    while time.time() < end:
        busy_now = self.page.evaluate("re => [...document.querySelectorAll('button')].some(b => new RegExp(re).test(b.innerText))", busy)
        if not busy_now:
            break
        self.page.wait_for_timeout(250)
    self.page.wait_for_timeout(300)
    self.fast(False)
    self.page.wait_for_timeout(hold)


Demo.fast = _fast
Demo.settle = _settle
