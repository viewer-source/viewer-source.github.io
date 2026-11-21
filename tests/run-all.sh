#!/bin/sh
# Every test that runs without a browser, in one list: the workflow Compare renderers runs it, and so does the release
# before anything is published. Run from the viewer's root after `python3 build.py` (some tests read downloads/), with
# the demo and test maps in maps/, test-maps/ and parked/ (the site's data). Every test runs; the exit is 1 when any
# failed, and the last lines name them.
#   sh tests/run-all.sh
failed=''
t() {
  echo "::group::$*"
  if "$@"; then echo "::endgroup::"; else echo "::endgroup::"; echo "::error::failed: $*"; failed="$failed
  $*"; fi
}
t node tests/yrender-compare.js python3
t node tests/layout-compare.js python3
t node tests/cd-compare.js python3
t node tests/cd-live.js
t node tests/cd-snap-redo.js
t node tests/cd-fit.js
t node tests/cd-modifier-spot.js
t node tests/cd-reconnect.js python3
t node tests/cd-make-main.js python3
t node tests/cd-square.js
t node tests/sbgn-edit.js python3
t node tests/sbml-edit.js parked/sbml
t node tests/sbml-edit.js tests/sbml-cases
t node tests/sbgn-reconnect.js python3
t node tests/sbgn-create.js python3
t node tests/sbgn-connect.js python3
t node tests/sbgn-af.js python3
t node tests/sbgn-restyle.js python3
t node tests/sbgn-join.js python3
t node tests/cd-join.js python3
t node tests/sbgn-names.js python3
t node tests/sbgn-stack.js python3
t node tests/membership.js python3
if [ -n "$failed" ]; then echo "Failed:$failed"; exit 1; fi
echo "All tests passed."
