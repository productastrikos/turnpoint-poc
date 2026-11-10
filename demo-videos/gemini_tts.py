"""Gemini text-to-speech helper for the v3 demo videos (ASCII only).

The API key is NEVER stored: it is read from the environment variable GEMINI_API_KEY.
One clip per sentence, cached on disk: audio_gemini/<video-id>/NN.wav (24 kHz mono 16-bit).
Style is steered with a prefix that is part of the request but is not narrated; clip durations are checked
against the sentence length to prove the prefix was not read aloud.
"""
import os, sys, json, time, base64, subprocess, wave, urllib.request, urllib.error

here = os.path.dirname(os.path.abspath(__file__))
MODEL = os.environ.get("GEMINI_TTS_MODEL", "gemini-2.5-flash-preview-tts")
VOICE = os.environ.get("GEMINI_TTS_VOICE", "Achird")
# Style prefix: gemini-2.5-* TTS follows it silently. gemini-3.x TTS READ IT ALOUD in testing, so there it is empty by default
# (override with GEMINI_TTS_STYLE; always check clip duration against sentence length).
STYLE = os.environ.get("GEMINI_TTS_STYLE", "" if "gemini-3" in MODEL else "Say in a relaxed, natural, conversational tone, like a colleague walking a friend through a screen, at an easy pace: ")
URL = "https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent"
RATE = 24000


def _request(text, voice, model):
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        sys.exit("GEMINI_API_KEY is not set")
    body = {"contents": [{"parts": [{"text": (STYLE + text) if (STYLE and model == MODEL) else text}]}],
            "generationConfig": {"responseModalities": ["AUDIO"],
                                 "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice}}}}}
    req = urllib.request.Request(URL % model, data=json.dumps(body).encode(), headers={"Content-Type": "application/json", "x-goog-api-key": key})
    delay = 4
    last = None
    for attempt in range(8):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                j = json.load(r)
            parts = j["candidates"][0]["content"]["parts"]
            data = [p["inlineData"] for p in parts if "inlineData" in p]
            if data:
                raw = base64.b64decode(data[0]["data"])
                if raw[:4] == b"RIFF":    # gemini-3.x returns a WAV container, 2.5 returns raw L16 PCM
                    import io
                    with wave.open(io.BytesIO(raw)) as w:
                        global RATE
                        RATE = w.getframerate()
                        return w.readframes(w.getnframes())
                return raw
            last = "no audio in response"
        except urllib.error.HTTPError as e:
            last = "HTTP %s" % e.code
            if e.code not in (429, 500, 502, 503, 504):
                raise RuntimeError("TTS HTTP %s: %s" % (e.code, e.read()[:200]))
        except Exception as e:  # network hiccup
            last = str(e)[:100]
        print("   TTS retry %d (%s), wait %ds" % (attempt + 1, last, delay), flush=True)
        time.sleep(delay)
        delay = min(delay * 2, 60)
    raise RuntimeError("TTS failed: " + str(last))


def _write_wav(path, pcm):
    with wave.open(path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(RATE); w.writeframes(pcm)


def _trim_silence(path):
    """Trim leading/trailing silence so the click-to-voice timing is predictable (keeps a short natural tail)."""
    tmp = path + ".tmp.wav"
    f = "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.12,areverse"
    r = subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", path, "-af", f, "-ar", str(RATE), "-ac", "1", tmp], capture_output=True)
    if r.returncode == 0 and os.path.getsize(tmp) > 2000:
        os.replace(tmp, path)
    elif os.path.exists(tmp):
        os.remove(tmp)


def duration(path):
    with wave.open(path) as w:
        return w.getnframes() / w.getframerate()


def clip(text, out, voice=None, model=None, force=False):
    """Make (or reuse) one wav clip. Returns its duration in seconds."""
    if os.path.exists(out) and not force:
        return duration(out)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    pcm = _request(text, voice or VOICE, model or MODEL)
    _write_wav(out, pcm)
    _trim_silence(out)
    return duration(out)


def build_video(vid, sentences, voice=None, model=None):
    """Generate all sentence clips of a video, concatenate them into audio_gemini/<vid>/all.wav and write
    audio_gemini/<vid>/clips.json = {"clips": [[start, end], ...]} in the format mux3.py expects."""
    d = os.path.join(here, "audio_gemini", vid)
    clips, pos, pcm_all = [], 0.0, b""
    for i, s in enumerate(sentences):
        p = os.path.join(d, "%02d.wav" % (i + 1))
        dur = clip(s, p, voice, model)
        words = len(s.split())
        print("   %s %02d  %5.2fs  %4.1f words/s  %s" % (vid, i + 1, dur, words / dur, s[:60]), flush=True)
        with wave.open(p) as w:
            pcm = w.readframes(w.getnframes())
        clips.append([round(pos, 3), round(pos + dur, 3)])
        pcm_all += pcm + b"\x00\x00" * int(RATE * 0.25)   # 0.25 s gap between clips inside all.wav
        pos += dur + 0.25
    _write_wav(os.path.join(d, "all.wav"), pcm_all)
    json.dump({"clips": clips, "voice": voice or VOICE, "model": model or MODEL}, open(os.path.join(d, "clips.json"), "w"))
    return clips
