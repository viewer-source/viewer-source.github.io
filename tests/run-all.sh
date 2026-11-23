#!/bin/sh
# Every test that runs without a browser, in one list: the workflow Compare renderers runs it, and so does the release
# before anything is published. Run from the viewer's root after `python3 build.py` (some tests read downloads/), with
# the demo and test maps in maps/, test-maps/ and parked/ (the site's data), and BASE an earlier release's checkout
# for the comparisons (tests/compare.js; without it they run their own checks only). Every test runs; the exit is 1 when any
# failed, and the last lines name them.
#   sh tests/run-all.sh       every test
#   sh tests/run-all.sh 2     only part 2 of 4: the release runs the four parts at once on four machines (about 5 min
#                             in place of 18). The number before each test is its part, chosen so each part takes about
#                             4.5 min on GitHub (cd-make-main alone 4 min, so more parts would not be faster); a new
#                             test goes into the part with the least time, by the times in notes/tests-on-github.md.
part="$1"
case "$part" in ''|1|2|3|4) ;; *) echo "::error::no part $part (1 to 4)"; exit 1;; esac
failed=''; ran=0
t() {
  p=$1; shift
  case "$p" in 1|2|3|4) ;; *) echo "::error::no part for: $p $*"; failed="$failed
  $p $*"; return;; esac
  if [ -n "$part" ] && [ "$p" != "$part" ]; then return; fi
  ran=$((ran + 1))
  echo "::group::$*"
  if "$@"; then echo "::endgroup::"; else echo "::endgroup::"; echo "::error::failed: $*"; failed="$failed
  $*"; fi
}
t 1 node tests/yrender-compare.js python3
t 2 node tests/layout-compare.js
t 2 node tests/no-page.js python3
t 1 node tests/cd-compare.js
t 2 node tests/cd-live.js
t 4 node tests/cd-snap-redo.js
t 4 node tests/cd-fit.js
t 4 node tests/cd-modifier-spot.js
t 3 node tests/cd-reconnect.js
t 1 node tests/graphml-edit.js
t 1 node tests/cd-make-main.js
t 4 node tests/cd-square.js
t 4 node tests/cd-metaid.js
t 3 node tests/sbgn-edit.js python3
t 4 node tests/sbml-edit.js parked/sbml
t 4 node tests/sbml-edit.js tests/sbml-cases
t 4 node tests/sbgn-reconnect.js python3
t 2 node tests/sbgn-create.js python3
t 3 node tests/sbgn-connect.js python3
t 4 node tests/sbgn-af.js python3
t 4 node tests/sbgn-restyle.js python3
t 4 node tests/sbgn-join.js python3
t 4 node tests/cd-join.js python3
t 4 node tests/sbgn-names.js python3
t 4 node tests/sbgn-stack.js python3
t 4 node tests/membership.js python3
t 4 node tests/one-element.js
if [ -n "$failed" ]; then echo "Failed:$failed"; exit 1; fi
echo "All $ran tests passed${part:+ (part $part)}."
