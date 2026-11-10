"""alignsplit.py <video-id> [asr-python]: transcribe audio/<id>.mp3 (asr_words.py), align the words to the script in videos.py,
write audio/<id>.json (segment clips cut in the middle of the pause between segments) and print a pronunciation/word check."""
import sys, os, re, json, subprocess, difflib
from videos import VIDEOS

here = os.path.dirname(os.path.abspath(__file__))
ASR_PY = os.environ.get("ASR_PY", r"C:\Users\parth\AppData\Local\Temp\claude\d2543a742b5b2be7\5516574f-5398-49be-9084-7a09e79c0818\scratchpad\asrvenv\Scripts\python.exe")


def norm_tokens(text):
    out = []
    for w in re.split(r"[\s\-/]+", text.lower()):
        w = re.sub(r"[^a-z0-9']", "", w)
        if w:
            out.append(w)
    return out


def main(vid):
    mp3 = os.path.join(here, "audio", vid + ".mp3")
    wj = os.path.join(here, "audio", vid + ".words.json")
    env = dict(os.environ, PYTHONIOENCODING="utf-8")
    subprocess.run([ASR_PY, "-I", os.path.join(here, "asr_words.py"), mp3, wj], check=True, capture_output=True, env=env)
    words = json.load(open(wj, encoding="utf-8"))
    dur = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp3]).decode())
    # asr tokens with timings (split hyphenated words, keep the same timing)
    atok, atime = [], []
    for w, s, e in words:
        for t in norm_tokens(w):
            atok.append(t); atime.append((s, e))
    texts = [x[0] for x in VIDEOS[vid]() if x[0]]
    stok, seg_first = [], []
    for t in texts:
        seg_first.append(len(stok))
        stok.extend(norm_tokens(t))
    sm = difflib.SequenceMatcher(None, stok, atok, autojunk=False)
    smap = {}
    for a, b, n in sm.get_matching_blocks():
        for i in range(n):
            smap[a + i] = b + i
    matched = len(smap)
    # script token index -> asr token index (nearest matched neighbour)
    def asr_idx(i, direction):
        j = i
        while 0 <= j < len(stok) and j not in smap:
            j += direction
        return smap.get(j) if 0 <= j < len(stok) else None
    bounds = []
    for k in range(1, len(texts)):
        f = asr_idx(seg_first[k], +1)
        l = asr_idx(seg_first[k] - 1, -1)
        if f is None or l is None:
            raise SystemExit(f"cannot align segment {k}")
        gap_start, gap_end = atime[l][1], atime[f][0]
        bounds.append((gap_start + gap_end) / 2 if gap_end > gap_start else (gap_start + gap_end) / 2)
    clips, a0 = [], 0.0
    for b in bounds:
        clips.append([round(a0, 3), round(b, 3)])
        a0 = b
    clips.append([round(a0, 3), round(dur, 3)])
    json.dump({"duration": dur, "clips": clips}, open(os.path.join(here, "audio", vid + ".json"), "w"))
    # report
    miss_script = [stok[i] for i in range(len(stok)) if i not in smap]
    miss_asr = [atok[j] for j in range(len(atok)) if j not in set(smap.values())]
    print(f"{vid}: dur {dur:.2f}s, script tokens {len(stok)}, matched {matched} ({100*matched/len(stok):.1f}%)")
    print("  script words not heard as written:", miss_script)
    print("  extra / different words heard:   ", miss_asr)
    for k, (t, c) in enumerate(zip(texts, clips)):
        print(f"  seg {k}: {c[0]:6.2f}-{c[1]:6.2f}  {len(t)/(c[1]-c[0]):4.1f} cps  {t[:50]}")


if __name__ == "__main__":
    main(sys.argv[1])
