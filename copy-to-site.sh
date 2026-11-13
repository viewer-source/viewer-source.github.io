#!/bin/sh
# Gives a site the viewer: sh copy-to-site.sh <clone of the site's repository>
# Copies only the viewer (atlas-app.html, atlas-tags.css, its look in look-lines.css and look-view.css, the editor's editor/ and the four renderers it runs in renderers/ (loaded only where --m2-edit is on), and the legend card into images/legend/) into the site's _includes/ and writes _includes/VERSION
# (this repository and its commit). The site's own header, styles, tab icon and pages are not touched.
set -e
site=$1
here=$(dirname "$0")
cp "$here/_includes/atlas-app.html" "$here/_includes/atlas-tags.css" "$here/_includes/look-lines.css" "$here/_includes/look-view.css" "$site/_includes/"
rm -f "$site/_includes/atlas-edit.js"   # the editor before it moved into editor/ (2026-11-13)
rm -rf "$site/editor" && cp -r "$here/editor" "$site/editor"   # the editor, loaded by the viewer only where --m2-edit is on
for f in yrender/yrender.js converter/cdrender.js converter/cd_edit.js layout/layout.js; do   # the renderers the editor runs, of the same commit
  mkdir -p "$site/renderers/$(dirname $f)" && cp "$here/renderers/$f" "$site/renderers/$f"
done
mkdir -p "$site/images/legend" && cp "$here"/images/legend/* "$site/images/legend/"   # the legend card the viewer opens
git -C "$here" log -1 --format='viewer-source/viewer-source.github.io %h %cs' > "$site/_includes/VERSION"
cat "$site/_includes/VERSION"
grep -q '"v":' "$site"/pages/*index.json "$site"/index.json 2>/dev/null || echo 'note: the site'"'"'s map index has no "v" field (each map'"'"'s version); add it as in index.json here'
