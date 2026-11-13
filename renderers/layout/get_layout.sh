#!/bin/sh
# Takes complex_pack.py and snap_grid.py from a clone of the layout skill (their master, kept in a private repository):
#   sh renderers/layout/get_layout.sh <path to that clone>
# Each copy starts with a line naming the commit it was taken from; the copies are never edited here. The editor runs
# them as layout.js (JavaScript): a new copy is made there too, then node tests/layout-compare.js shows it gives the same.
set -e
src=$1/.claude/skills/sbgn-human-like-layout
c=$(git -C "$1" log -1 --format='%h %cs')
for f in complex_pack.py snap_grid.py; do
  { echo "# Copy of the layout skill's $f at $c; its master is in the skill, never edited here."; cat "$src/$f"; } > "renderers/layout/$f"
done
echo "copied at $c"
