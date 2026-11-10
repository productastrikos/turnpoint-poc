"""asr_words.py <audio.mp3> <out.json>: word timestamps with faster-whisper (small.en, CPU). Used only to check the voice-over:
pronunciation (did the ASR hear the words in the script?) and sentence boundaries. Needs a venv with faster-whisper installed;
run it as: <venv>/Scripts/python.exe -I asr_words.py ..."""
import sys, json, subprocess
import numpy as np
from faster_whisper import WhisperModel
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", sys.argv[1], "-f", "f32le", "-ac", "1", "-ar", "16000", "-"], capture_output=True).stdout
audio = np.frombuffer(raw, dtype=np.float32)
m = WhisperModel("small.en", device="cpu", compute_type="int8")
segs, info = m.transcribe(audio, word_timestamps=True, language="en", beam_size=5)
words = []
for s in segs:
    for w in s.words:
        words.append([w.word.strip(), round(w.start, 2), round(w.end, 2)])
json.dump(words, open(sys.argv[2], "w"))
print(len(words), "words")
print(" ".join(w[0] for w in words))
