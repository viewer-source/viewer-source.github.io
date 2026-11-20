# The group SBML with layout, an optional part of the build (build.py takes it when this file is there): the SBML files
# of test-maps/sbml/ with sources.tsv (other people's and tools' files, unchanged), each drawn from its file's own
# layout by the converter's SBML reader (renderers/converter/mapconv/sbml.py) and yrender, as SBGN-ML is drawn, view
# only (no edit_path); its text the source, address and licence. A file without a layout or without species glyphs is
# said and left out. Removing this file and the reader leaves the viewer without SBML.
import csv, os, re


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
        body = 'From %s (%s), %s. Unchanged, drawn from its own layout.' % (r['source'], r['url'], r['licence'])
        d, nodes = build.converted(os.path.join(base, r['file']), sid, body, reader=sbml)
        if not d:
            continue
        d['file'] = '/test-maps/sbml/' + r['file']
        e = build.entry_of(os.path.splitext(r['file'])[0], 'SBML with layout', 2000 + k, d)
        e['downloads'][0]['label'] = 'SBML'
        out.append((sid, e, build.search_entries(sid, nodes), body))
    return out
