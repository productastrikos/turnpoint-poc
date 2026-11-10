"""mux.py <video-id>: webm + sentence clips -> final/<id>.mp4

The recorded webm does not run at wall-clock speed when the page is busy, so audio is NOT placed by wall-clock times.
lib.py draws two corner markers: one flips magenta/green at every caption change (= segment start), one is red while the
scene is only waiting for the app (Working...). This script reads both from the video itself, then
  - time-lapses the 'waiting' stretches to about 1 s,
  - starts each sentence clip LEAD seconds after its caption flip (the click comes first, then the voice),
  - holds the last frame before the next caption if a sentence would otherwise run into it,
  - pads the end so the last sentence is never cut,
  - paints the markers over."""
import sys, os, json, subprocess
import numpy as np
here = os.path.dirname(os.path.abspath(__file__))
vid = sys.argv[1]
LEAD, TAIL, FAST_OUT = 0.7, 0.35, 1.2
a = json.load(open(os.path.join(here, "audio", vid + ".json")))["clips"]
o = json.load(open(os.path.join(here, "out", vid + ".json")))
src_a = os.path.join(here, "audio", vid + ".mp3")
src_v = os.path.join(here, "out", vid + ".webm")
outdir = os.path.join(here, os.environ.get("FINAL_DIR", "final"))   # FINAL_DIR=final_new stages new films next to the old ones
os.makedirs(outdir, exist_ok=True)
dst = os.path.join(outdir, vid + ".mp4")
trim = o.get("trim", 0)
FPS = 25

def read_px(crop):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{trim:.3f}", "-i", src_v, "-vf", f"fps={FPS},crop={crop},scale=1:1", "-pix_fmt", "rgb24", "-f", "rawvideo", "-"],
                         capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.uint8).reshape(-1, 3).astype(int)

pa = read_px("4:4:2:2")
pb = read_px("4:4:10:2")
n = min(len(pa), len(pb)); pa, pb = pa[:n], pb[:n]
D = n / FPS
cls = [1 if (r > 200 and g < 90 and b > 200) else 2 if (g > 200 and r < 90 and b < 90) else 0 for r, g, b in pa]
events, prev = [], 0
for i, c in enumerate(cls):
    if c and c != prev and (i + 1 >= n or cls[i + 1] == c):
        events.append(i / FPS); prev = c
nseg = len(o["starts"])
if len(events) < nseg:
    sys.exit(f"{vid}: found {len(events)} marker flips, need {nseg}: {events}")
# dead stretches: while the app is busy (recording slows it down) the film shows almost no change for many seconds.
# Find them by frame differencing (5 fps) and time-lapse them to FAST_OUT seconds each.
rawg = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{trim:.3f}", "-i", src_v, "-vf", "fps=5,scale=320:180,format=gray", "-f", "rawvideo", "-"], capture_output=True).stdout
gfr = np.frombuffer(rawg, dtype=np.uint8).reshape(-1, 180, 320).astype(float)
dif = np.abs(np.diff(gfr, axis=0)).mean(axis=(1, 2))
act = [i / 5 for i, x in enumerate(dif) if x >= 1.2] 
act = [0.0] + act + [D]
fast = []
for t0, t1 in zip(act, act[1:]):
    if t1 - t0 >= 6.0 and t0 > 0.5:
        fast.append((t0 + 0.4, t1 - 0.4))
# never let a time-lapse swallow a caption flip: cut the stretches around every flip
split = []
for s_, e_ in fast:
    pos = s_
    for f in sorted(x for x in events if s_ < x < e_):
        if f - 0.5 > pos: split.append((pos, f - 0.5))
        pos = f + 0.5
    if e_ > pos: split.append((pos, e_))
fast = [(s_, e_) for s_, e_ in split if e_ - s_ >= 2.0 and e_ <= D - 0.4]
bg = pa[0]

def out_nohold(t):
    """input time -> output time with the fast stretches shortened (no holds yet)"""
    acc = 0.0
    for s, e in fast:
        if t <= s: break
        ln = e - s
        if t >= e: acc += ln - FAST_OUT
        else: acc += (t - s) * (1 - FAST_OUT / ln)
    return t - acc

holds = []   # (input time, extra seconds)
def hold_before(t):
    return sum(h for ht, h in holds if ht < t)
clip_len = [a[st["clip"]][1] - a[st["clip"]][0] for st in o["starts"]]
for k in range(nseg):
    start_out = out_nohold(events[k]) + hold_before(events[k])
    end_in = events[k + 1] if k + 1 < nseg else None
    need_end = start_out + LEAD + clip_len[k] + TAIL
    if end_in is not None:
        have_end = out_nohold(end_in) + hold_before(end_in)
        if have_end < need_end:
            holds.append((max(end_in - 0.08, events[k]), need_end - have_end))
    else:
        have_end = out_nohold(D) + hold_before(D)
        if have_end < need_end:
            holds.append((D - 0.08, need_end - have_end))   # end hold
holds.sort()
# pieces: (a, b, speed, hold)
marks = sorted([(s, 0, ("f", s, e)) for s, e in fast] + [(t, 1, ("h", t, h)) for t, h in holds])
pieces, t = [], 0.0
for _, _, m in marks:
    if m[0] == "f":
        if m[1] > t: pieces.append((t, m[1], 1.0, 0.0))
        pieces.append((m[1], m[2], (m[2] - m[1]) / FAST_OUT, 0.0)); t = m[2]
    else:
        ht = max(m[1], t)
        if ht > t: pieces.append((t, ht, 1.0, 0.0))
        pieces.append((ht, ht + 0.04, 1.0, m[2])); t = ht + 0.04
if t < D: pieces.append((t, D, 1.0, 0.0))
total_out = sum((b - a_) / sp + h for a_, b, sp, h in pieces)

def out_time(tin):
    return out_nohold(tin) + hold_before(tin)

vf = [f"[0:v]drawbox=x=0:y=0:w=16:h=8:color=0x{bg[0]:02x}{bg[1]:02x}{bg[2]:02x}:t=fill,split={len(pieces)}" + "".join(f"[s{i}]" for i in range(len(pieces)))]
for i, (a_, b, sp, h) in enumerate(pieces):
    f = f"[s{i}]trim=start={a_:.3f}:end={b:.3f},setpts=(PTS-STARTPTS)/{sp:.5f}"
    if h > 0: f += f",tpad=stop_mode=clone:stop_duration={h:.3f}"
    vf.append(f + f"[p{i}]")
vf.append("".join(f"[p{i}]" for i in range(len(pieces))) + f"concat=n={len(pieces)}:v=1:a=0,fps={FPS}[vout]")
parts, labels = [], []
for k, st in enumerate(o["starts"]):
    c = a[st["clip"]]
    delay = int((out_time(events[k]) + LEAD) * 1000)
    parts.append(f"[1:a]atrim={c[0]}:{c[1]},asetpts=PTS-STARTPTS,adelay={delay}|{delay},volume=1.2[a{k}]")
    labels.append(f"[a{k}]")
fc = ";".join(vf) + ";" + ";".join(parts) + ";" + "".join(labels) + f"amix=inputs={len(labels)}:normalize=0,apad=whole_dur={total_out:.3f}[aout]"
cmd = ["ffmpeg", "-y", "-ss", f"{trim:.3f}", "-i", src_v, "-i", src_a, "-filter_complex", fc, "-map", "[vout]", "-map", "[aout]",
       "-t", f"{total_out:.3f}", "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", dst]
json.dump({'speech_start': [out_time(events[k]) + LEAD for k in range(nseg)], 'total': total_out}, open(os.path.join(here, 'out', vid + '.sync.json'), 'w'))
r = subprocess.run(cmd, capture_output=True, text=True)
print(vid, "ok" if r.returncode == 0 else r.stderr[-2500:], "| flips", [round(e, 1) for e in events[:nseg + 1]], "| fast", [(round(s, 1), round(e, 1)) for s, e in fast], "| holds", [(round(t, 1), round(h, 2)) for t, h in holds], "| out", round(total_out, 1), "s")
