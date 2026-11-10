#!/bin/bash
# all.sh id...: record + mux each video (needs the app on :5173 and audio/<id>.mp3 + .json). Scratch goes to raw/ and out/ - delete them after.
for v in "$@"; do
  PYTHONIOENCODING=utf-8 MSYS_NO_PATHCONV=1 python run.py $v rec 2>&1 | grep -E "MISS|ERROR|done in"
  python mux.py $v
done
