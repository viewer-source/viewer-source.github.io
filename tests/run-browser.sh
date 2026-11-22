#!/bin/sh
# The browser tests run at the end of each step of the restructuring, on the live page (by default the styles page),
# after the release of that step is live. The tests without a browser are in run-all.sh. Every test runs; the exit is
# 1 when any failed, and the last lines name them.
#   sh tests/run-browser.sh <clone of the site's data repository>
failed=''; ran=0
t() {
  ran=$((ran + 1)); echo "== $*"
  if "$@"; then :; else failed="$failed
  $*"; fi
}
t node tests/gestures.js
t node tests/palette-rows.js
t node tests/palette-style.js
t node tests/props-range.js
t node tests/repack-one.js
t node tests/repack-bottom.js
t node tests/cd-fit-live.js
t node tests/cd-line-own.js
t node tests/hostile-files.js
t node tests/save-paths.js https://viewer-source.github.io/styles/ "$1"
if [ -n "$failed" ]; then echo "Failed:$failed"; exit 1; fi
echo "All $ran browser tests passed."
