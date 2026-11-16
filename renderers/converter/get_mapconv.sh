#!/bin/sh
# The converter's package, copied from the converter's repository (its master; never edited here): the modules
# cdrender, cd_edit and the build's SBGN-ML drawing import. VERSION: the date and the converter's commit, -dirty when
# its working tree had changes.
#   sh renderers/converter/get_mapconv.sh <the converter's repository>
set -e
src="$1/mapconv"; dst="$(dirname "$0")/mapconv"
files="annotation.py biology.py cd_layout.py cd_tidy.py celldesigner.py conjugates.json graphml.py layout.py model.py
newt_layout.py report.py routes.py rules.py sbgnml.py style.py yed.graphml"
for f in $files; do [ -f "$src/$f" ] || { echo "$src/$f missing: nothing copied"; exit 1; }; done
for f in $files; do cp "$src/$f" "$dst/$f"; done
d=$(git -C "$1" diff --quiet HEAD -- mapconv || echo -dirty)
echo "$(date -u +%Y%m%d) $(git -C "$1" rev-parse --short HEAD)$d" > "$dst/VERSION"
