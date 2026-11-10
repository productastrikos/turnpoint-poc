"""audiosplit.py <video-id>: find the spoken sentences inside audio/<id>.mp3 and save their intervals to audio/<id>.json."""
import sys, re, json, subprocess, os
from videos import VIDEOS

here = os.path.dirname(os.path.abspath(__file__))


def split(vid, n=None):
    f = os.path.join(here, "audio", vid + ".mp3")
    if n is None:
        n = len([s for s in VIDEOS[vid]() if s[0]])
    dur = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).decode())
    out = subprocess.run(["ffmpeg", "-i", f, "-af", "silencedetect=noise=-33dB:d=0.12", "-f", "null", "-"], capture_output=True, text=True).stderr
    starts = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", out)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", out)]
    gaps = [(s, e) for s, e in zip(starts, ends) if s > 0.25 and e < dur - 0.1]
    # Align SENTENCES to pauses (dynamic programming): every sentence should take about len/cps seconds. Segment boundaries are
    # then the pauses after the last sentence of each segment. Much more robust than guessing one pause per segment.
    texts = [x[0] for x in VIDEOS[vid]() if x[0]]
    sents, seg_end = [], []          # sentence texts; index of the last sentence of each segment
    for t in texts:
        parts = [p for p in re.split(r"(?<=[.?!]) +", t.strip()) if p]
        sents.extend(parts)
        seg_end.append(len(sents) - 1)
    lens = [len(x) for x in sents]
    S, G = len(sents), len(gaps)
    lead = gaps[0][0] if False else 0.0
    cps = sum(lens) / max(dur - 0.3, 1)
    INF = 1e18
    # best[k][j] = min cost with sentence k ending at gap j (k = 0..S-2), start of sentence 0 at 0.0
    best = [[INF] * G for _ in range(max(S - 1, 1))]
    back = [[-1] * G for _ in range(max(S - 1, 1))]
    for j in range(G):
        d = gaps[j][0] - 0.0
        best[0][j] = (d - lens[0] / cps) ** 2 - 0.2 * (gaps[j][1] - gaps[j][0])
    for k in range(1, S - 1):
        for j in range(G):
            for i in range(j):
                if best[k - 1][i] >= INF:
                    continue
                d = gaps[j][0] - gaps[i][1]
                c = best[k - 1][i] + (d - lens[k] / cps) ** 2 - 0.2 * (gaps[j][1] - gaps[j][0])
                if c < best[k][j]:
                    best[k][j], back[k][j] = c, i
    final_cost, jj = INF, -1
    for j in range(G):
        if S - 2 >= 0 and best[S - 2][j] < INF:
            d = dur - gaps[j][1]
            c = best[S - 2][j] + (d - lens[S - 1] / cps) ** 2
            if c < final_cost:
                final_cost, jj = c, j
    chosen = [None] * max(S - 1, 0)
    k = S - 2
    while k >= 0 and jj >= 0:
        chosen[k] = jj
        jj = back[k][jj]
        k -= 1
    cut = [gaps[chosen[e]] for e in seg_end[:-1]]
    clips = []
    a0 = 0.0
    for s0, e0 in cut:
        clips.append([round(a0, 3), round(s0 + 0.05, 3)])
        a0 = max(e0 - 0.05, s0)
    clips.append([round(a0, 3), round(dur, 3)])
    json.dump({"duration": dur, "clips": clips}, open(os.path.join(here, "audio", vid + ".json"), "w"))
    return dur, clips, gaps


if __name__ == "__main__":
    d, c, g = split(sys.argv[1])
    print("dur", d, "clips", c, "gaps found", len(g))
