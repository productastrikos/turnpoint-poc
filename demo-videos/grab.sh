#!/bin/bash
# grab.sh <video-id>: move the newest ElevenLabs download (.tmp) into audio/<id>.mp3 and split it into sentence clips
sleep 2
f=$(ls -t ~/Downloads/*.tmp 2>/dev/null | head -1)
[ -z "$f" ] && { echo "no download found"; exit 1; }
m=$(md5sum "$f" | cut -d' ' -f1)
for o in audio/*.mp3; do
  [ "$o" != "audio/$1.mp3" ] && [ "$(md5sum "$o" | cut -d' ' -f1)" = "$m" ] && { echo "DUPLICATE of $o - the old audio was downloaded, retry later"; rm -f "$f"; exit 2; }
done
mv "$f" "audio/$1.mp3"
for x in $(ls ~/Downloads/*.tmp 2>/dev/null); do rm -f "$x"; done
PYTHONIOENCODING=utf-8 python audiosplit.py "$1"
