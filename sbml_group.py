# The group SBML with layout, an optional part of the build (build.py takes it when this file is there): the SBML files
# of test-maps/sbml/ with sources.tsv (other people's and tools' files, unchanged), each drawn from its file's own
# layout by the converter's SBML reader (renderers/converter/mapconv/sbml.py) and yrender, as SBGN-ML is drawn; its text
# the source, address and licence. Edited for its layout alone (layout_only; renderers/converter/sbml_edit.js): the
# editor saves its edited copy to maps/sbml/<the file's name>, which is then drawn in its place (downloaded from
# downloads/<id>.<ending>), the file in test-maps/ unchanged; atlas-data/<id>.graphml, the converter's GraphML of the
# file drawn, is what the editor edits it as. A file without a layout or without species glyphs is said and left out.
# Removing this file and the reader leaves the viewer without SBML.
import csv, os, re, shutil


def maps(build):
    from mapconv import sbml
    base = os.path.join(build.ROOT, 'test-maps', 'sbml')
    if not os.path.exists(os.path.join(base, 'sources.tsv')):
        return []
    rows = [r for r in csv.DictReader(open(os.path.join(base, 'sources.tsv'), encoding='utf-8'), delimiter='\t')
            if r['file'].endswith(('.sbml', '.xml'))]
    out = []
    for k, r in enumerate(rows):
        sid = 'sbml-' + re.sub(r'[^a-z0-9]+', '-', os.path.splitext(r['file'])[0].lower()).strip('-')
        build.db.current = sid
        mine = os.path.join(build.ROOT, 'maps', 'sbml', r['file'])   # its edited copy, where the editor saved one
        edited = os.path.exists(mine)
        body = 'From %s (%s), %s. %s' % (r['source'], r['url'], r['licence'], 'Edited in the viewer; the original is in test-maps/.' if edited else 'Unchanged, drawn from its own layout.')
        src = mine if edited else os.path.join(base, r['file'])
        d, nodes = build.converted(src, sid, body, keep=True, reader=sbml)
        if not d and edited:   # an edited copy that cannot be drawn: the file itself, so the map stays
            print('warning: %s not drawn, the file in test-maps/ shown instead' % os.path.relpath(mine, build.ROOT))
            edited, src = False, os.path.join(base, r['file'])
            body = body.replace('Edited in the viewer; the original is in test-maps/.', 'Unchanged, drawn from its own layout.')
            d, nodes = build.converted(src, sid, body, keep=True, reader=sbml)
        if not d:
            continue
        if edited:
            shutil.copy(mine, os.path.join(build.ROOT, 'downloads', sid + os.path.splitext(r['file'])[1]))
            d['file'] = '/downloads/' + sid + os.path.splitext(r['file'])[1]
        else:
            d['file'] = '/test-maps/sbml/' + r['file']
        d['src'] = build.blob_sha(src)   # the kept drawing waits for the build of its save
        d['edit_path'], d['edit_base'] = 'maps/sbml/' + r['file'], '/atlas-data/%s.graphml' % sid
        e = build.entry_of(os.path.splitext(r['file'])[0], 'SBML with layout', 2000 + k, d, layout_only=True)
        e['downloads'][0]['label'] = 'SBML'
        out.append((sid, e, build.search_entries(sid, nodes), body))
    return out
