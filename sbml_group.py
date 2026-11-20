# The group SBML with layout, an optional part of the build (build.py takes it when this file is there): the SBML files
# of test-maps/sbml/ with sources.tsv (other people's and tools' files, unchanged), each drawn from its file's own
# layout by the converter's SBML reader (renderers/converter/mapconv/sbml.py) and yrender, as SBGN-ML is drawn; its text
# the source, address and licence. Edited for its layout alone (layout_only; renderers/converter/sbml_edit.js): the
# editor saves its edited copy to maps/sbml/<the file's name>, which is then drawn in its place (downloaded from
# downloads/<id>.<ending>), the file in test-maps/ unchanged; atlas-data/<id>.graphml, the converter's GraphML of the
# file drawn, is what the editor edits it as. A file without a layout or without species glyphs is said and left out.
# Files listed to compare with them (an SBGN-ML or CellDesigner file of the same map) are drawn beside them as their own
# format is drawn, view only.
# Removing this file and the reader leaves the viewer without SBML.
import csv, os, re, shutil


def maps(build):
    from mapconv import sbml
    base = os.path.join(build.ROOT, 'test-maps', 'sbml')
    if not os.path.exists(os.path.join(base, 'sources.tsv')):
        return []
    rows = [r for r in csv.DictReader(open(os.path.join(base, 'sources.tsv'), encoding='utf-8'), delimiter='\t')
            if r['file'].endswith(('.sbml', '.xml', '.sbgn'))]
    out, seen = [], {}
    def place(r, k):   # a pair to compare (sources.tsv's pair: its number and name) first in the group, named after it; the rest by the table
        pr = (r.get('pair') or '').strip()
        if not pr:
            return os.path.splitext(r['file'])[0], 2000 + k
        n, _, name = pr.partition(' ')
        seen[n] = seen.get(n, -1) + 1
        return 'Pair %s: %s' % (n, name), -100 + 10 * int(n) + seen[n]
    for k, r in enumerate(rows):
        title, order = place(r, k)
        sid = 'sbml-' + re.sub(r'[^a-z0-9]+', '-', os.path.splitext(r['file'])[0].lower()).strip('-')
        build.db.current = sid
        f = os.path.join(base, r['file'])
        if r['file'].endswith('.sbgn') or r['packages'] == 'celldesigner':   # a file to compare with, as sources.tsv says
            got = compare(build, f, sid + '-' + r['file'].rsplit('.', 1)[1], 'From %s (%s), %s. Unchanged, beside its SBML to compare.' % (r['source'], r['url'], r['licence']), title, order)
            out += [got] if got else []
            continue
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
        e = build.entry_of(title, 'SBML with layout', order, d, layout_only=True)
        e['downloads'][0]['label'] = 'SBML'
        out.append((sid, e, build.search_entries(sid, nodes), body))
    return out


def compare(build, f, sid, body, name, order):
    # an SBGN-ML or CellDesigner file listed beside an SBML one, drawn as its format is drawn on the site, view only
    if f.endswith('.sbgn'):
        d, nodes = build.converted(f, sid, body)
        if not d:
            return None
        label, legend = 'SBGN-ML', 'sbgn'
    else:
        try:
            nodes = build.celldesigner(f, os.path.join(build.ROOT, 'downloads', sid + '.svg'))
        except Exception as e:
            print('warning: %s not drawn, left out: %s' % (os.path.relpath(f, build.ROOT), e))
            return None
        d = build.drawn(sid, nodes, body.encode())
        label, legend = 'CellDesigner', 'celldesigner'
    d['file'] = '/test-maps/sbml/' + os.path.basename(f)
    e = build.entry_of(name, 'SBML with layout', order, d, legend=legend)
    e['downloads'][0]['label'] = label
    return sid, e, build.search_entries(sid, nodes), body
