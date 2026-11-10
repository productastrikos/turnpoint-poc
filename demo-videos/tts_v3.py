"""tts_v3.py <video-id> ...: Gemini voice-over clips for the v3 videos. Needs env GEMINI_API_KEY (never stored)."""
import sys
import gemini_tts as g
from videos_v3 import VIDEOS

for vid in sys.argv[1:]:
    sentences = [s for s, fn, cap in VIDEOS[vid]()]
    g.build_video(vid, sentences)
