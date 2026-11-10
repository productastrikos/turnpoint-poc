"""run_v3.py <video-id> dry|rec|draft  (v3: Gemini per-sentence clips in audio_gemini/<id>/clips.json, scripts in videos_v3.py)
   dry   = no recording, fast (checks every click still lands)
   rec   = record at 1920x1080, paced to the sentence clips in audio/<id>.json (needs the ElevenLabs audio)
   draft = record silent, paced to an estimated speaking rate (no audio needed): writes draft/<id>.mp4
"""
import sys, os, time, glob, shutil, json, subprocess
from lib import Demo
from videos_v3 import VIDEOS

here = os.path.dirname(os.path.abspath(__file__))
LEAD = 0.7          # the click lands first, the sentence starts this many seconds after the segment starts
CPS = 14.5          # estimated characters spoken per second (draft mode only)


def main():
    for sub in ('out', 'raw'):
        os.makedirs(os.path.join(here, sub), exist_ok=True)
    vid, mode = sys.argv[1], sys.argv[2]
    rec = mode in ("rec", "draft")
    segs = VIDEOS[vid]()
    clips = []
    if mode == "rec":
        clips = json.load(open(os.path.join(here, "audio_gemini", vid, "clips.json")))["clips"]
    d = Demo(vid, record=rec)
    d.login()
    d.vt0 = time.time()          # the film starts here: everything before is the login
    trim = d.vt0 - d.t0
    log, ci = [], 0
    for speech, fn, cap in segs:
        d.cap(cap or speech)
        start = time.time() - d.vt0
        dur = 0
        if speech:
            if mode == "rec":
                dur = clips[ci][1] - clips[ci][0]
            elif mode == "draft":
                dur = len(speech) / CPS
            if rec:
                log.append({"clip": ci, "start": round(start + LEAD, 3)})
            ci += 1
        try:
            fn(d)
        except Exception as e:
            print("   SCENE ERROR:", type(e).__name__, str(e)[:200])
        if rec:
            hold = (dur + LEAD + 0.8) if speech else 2.2
            d.until_v(start + hold)
        print(f"  seg ({'voice' if speech else 'silent'}) {start:5.1f}s -> {time.time()-d.vt0:5.1f}s")
    d.cap("")
    d.wait(3500)   # idle so the recorder can flush its last frames
    total = time.time() - d.vt0
    errs = [e for e in d.errors if "favicon" not in e]
    if rec:
        d.page.screenshot(path=os.path.join(here, "out", vid + ".png"))
    d.close()
    print(f"{vid}: {mode} done in {total:.1f}s misses={d.misses} errors={errs[:4]}")
    if rec:
        files = sorted(glob.glob(os.path.join(here, "raw", vid, "*.webm")), key=os.path.getmtime)
        shutil.copy(files[-1], os.path.join(here, "out", vid + ".webm"))
        json.dump({"starts": log, "total": total, "trim": trim}, open(os.path.join(here, "out", vid + ".json"), "w"))
    if mode == "draft":
        os.makedirs(os.path.join(here, "draft"), exist_ok=True)
        dst = os.path.join(here, "draft", vid + ".mp4")
        subprocess.run(["ffmpeg", "-y", "-ss", f"{trim:.3f}", "-i", os.path.join(here, "out", vid + ".webm"), "-c:v", "libx264", "-preset", "medium",
                        "-crf", "21", "-pix_fmt", "yuv420p", "-an", dst], capture_output=True)
        print("draft ->", dst)


main()
