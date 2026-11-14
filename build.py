# Builds the atlas from maps/: every map file drawn as its own editor draws it, with the data a click shows.
#   python3 build.py
# maps/<id>.graphml (yEd) is drawn by renderers/yrender/yrender.js, maps/<id>.xml (CellDesigner) by
# renderers/converter/cdrender.js, through Node (renderers/render.js).
# Both give the same output, so the viewer (_includes/atlas-app.html) never knows the source:
#   downloads/<id>.svg and a copy of the map file;
#   atlas-data/<id>.json: {"nodes": [...]}, each clickable node's box in SVG pixels, label, class and properties
#     ([name, value] pairs), a process with references also its reaction (in, out, by) and references;
#   atlas-data/search.json: the search index of all maps;
#   _maps/<id>.md: the map's entry (front matter for the list and the downloads row, then its text); its v is a hash of
#     the picture, the click data and the text, so an open page fetches a map again only when it changed.
# Each map's entry says which legend the Legend window opens on: legend sbgn for a GraphML map, celldesigner for a
#   CellDesigner one. images/legend/celldesigner-legend.svg is a fixed file: the full CellDesigner legend's drawing,
#   made with the workbench's legend maps (only on the Metabolism Regulation Atlas, not in the demo: user, 2026-11-11).
# maps/<id>.md gives the entry: front matter title, group, order (and topic), its body the text under the map; with
#   newt: true a Newt link opens the map's SBGN-ML on the demo, minerva: <address> a MINERVA link.
# SBGN-ML (user, 2026-11-13: the viewer shows SBGN-ML too, "the GraphML based way"): a map whose maps/extra/<id>/ has an
#   .sbgn file gets that file drawn as well, read by the converter (renderers/converter/mapconv: sbgnml.read, the file's
#   own places and sizes) into GraphML and drawn by yrender.js, with its click data: downloads/<id>-sbgnml.svg and
#   atlas-data/<id>-sbgnml.json, named in the entry's sbgn; the viewer shows it when Settings' Source is SBGN-ML.
# The group SBGN-ML (user, 2026-11-14: "our converter's output from GraphML"): every map of the group GraphML written as
#   SBGN-ML by the converter's copy (advanced: the drawing kept, nothing adjusted for Newt) into downloads/<name>-sbgn.sbgn
#   and drawn back from that file as above, a map of its own with the GraphML map's title and text, so the formats stand
#   side by side and any difference from the GraphML drawing is ours to fix (reader, writer or yrender). Not edited: its
#   first download is the SBGN-ML file.
# The group SBGN-ML external (user, 2026-11-14: "import external collection ... go through them problem by problem"):
#   the Process Description maps of test-maps/sbgn-ml/pd/ (other people's and tools' files, unchanged; libsbgn's
#   validation error tests left out), each drawn from its file as above (downloaded from its own address there), a map
#   of its own named after its source and file, its text the source, path and licence from sources.tsv. A file that
#   cannot be drawn is said and left out. Edited in the viewer (user, 2026-11-14): the editor saves a map's edited copy
#   to maps/sbgn-ml/pd/<its path>, which is then drawn in its place (downloaded from downloads/<id>.sbgn or .nwt), the
#   file in test-maps/ staying unchanged; atlas-data/<id>.graphml, the converter's GraphML of the file drawn, is what
#   the editor edits it as (entry's edit_base; edit_path, where it saves).
# maps/extra/<id>/ (optional): more files for a map's download row, copied to downloads/ under their own names and
#   labelled by ending (.graphml GraphML, .xml CellDesigner, .sbgn SBGN-ML, -sbml.xml SBML, .png PNG, .csv Annotation):
#   the full set of the official site, for every map (user, 2026-11-11: glycolysis first, then all, "why only two
#   downloads"); a CellDesigner map gets the official GraphML, a GraphML map the official CellDesigner file.
# A node is clickable when it has annotation, a process when it has references (as on the Metabolism Regulation
# Atlas). The panel's names, function, location and cross-references come from UniProt, HGNC and ChEBI, and the
# citations from PubMed, fetched once per identifier and cached (databases.py); a node whose identifier field holds
# several IDs (a family drawn as one node in a CellDesigner file) shows only what the file holds.
# python3 build.py --refresh fetches every cached entry again. Needs lxml, Node and @xmldom/xmldom (npm install).
import collections, glob, hashlib, json, os, re, shutil, sys
from urllib.parse import unquote
from lxml import etree

ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(ROOT, 'renderers', 'converter'))   # the converter's plain_name
# The drawings come from the JavaScript renderers (yrender.js, cdrender.js: the masters since 2026-11-13, user), run by
# Node through renderers/render.js, started once for the whole build; every fill and name gets its role's class beside
# its colour, for the viewer's Map colours (Settings), and 'colours' in a map's entry says its picture has them.
import subprocess  # noqa: E402
_node = None


def render(kind, src):
    global _node
    if _node is None:
        _node = subprocess.Popen(['node', os.path.join(ROOT, 'renderers', 'render.js')], stdin=subprocess.PIPE,
                                 stdout=subprocess.PIPE, text=True, encoding='utf-8', bufsize=1)
    _node.stdin.write(json.dumps({'kind': kind, 'src': src}) + '\n'); _node.stdin.flush()
    line = _node.stdout.readline()
    if not line:   # the renderer is gone: stop the build, never a map after another left out quietly
        sys.exit('the renderer stopped (node %s)' % _node.poll())
    r = json.loads(line)
    if 'error' in r:
        raise SystemExit('%s: %s' % (src, r['error']))
    return r


def floats(v):   # the click data's numbers as the Python renderer gave them (12.0, not 12, in the JSON written)
    return [floats(x) for x in v] if isinstance(v, list) else float(v) if isinstance(v, (int, float)) else v
from mapconv.celldesigner import plain_name  # noqa: E402
import databases as db  # noqa: E402
from databases import realizer, first_label, search_entries  # noqa: E402

FIELDS = db.FIELDS
PROCESSES = ('Process', 'OmittedProcess', 'UncertainProcess', 'Association', 'Dissociation')


# ---------- yEd GraphML ----------
GN, YN = '{http://graphml.graphdrawing.org/xmlns}', '{http://www.yworks.com/xml/graphml}'


def graphml(src, out_svg):
    r = render('yed', src)
    if r['errors']:   # as yrender: a map it cannot draw stops the build, nothing written
        raise SystemExit(f'{src}: cannot draw, nothing written\n  ' + '\n  '.join(r['errors']))
    open(out_svg, 'w', encoding='utf-8').write(r['svg'])
    tx, ty = (float(v) for v in re.search(r'translate\((-?[\d.]+),(-?[\d.]+)\)', open(out_svg).read()).groups())
    root = etree.parse(src).getroot()
    keys = {k.get('id'): k.get('attr.name') for k in root.findall(GN + 'key') if k.get('for') == 'node'}
    label = {n.get('id'): first_label(realizer(n)) for n in root.iter(GN + 'node')}
    arrow = lambda e: next((a.get('target', 'none') for a in e.iter(YN + 'Arrows')), 'none')
    arcs = [(e.get('source'), e.get('target'), arrow(e)) for e in root.iter(GN + 'edge')]
    nodes = []
    for n in root.iter(GN + 'node'):
        data = {keys.get(d.get('key')): (d.text or '').strip() for d in n.findall(GN + 'data') if d.get('key') in keys}
        gn = realizer(n)
        if gn is None:
            continue
        kind = (gn.get('configuration') or '').replace('com.yworks.sbgn.', '')
        geo = gn.find(YN + 'Geometry')
        x, y, w, h = (float(geo.get(a)) for a in ('x', 'y', 'width', 'height'))
        if kind in PROCESSES:
            if data.get('References'):
                nid = n.get('id')
                nodes.append(process(kind, [x + tx + w / 2, y + ty + h / 2],
                                     [label[s] for s, t, a in arcs if t == nid and a == 'none'],
                                     [label[t] for s, t, a in arcs if s == nid],
                                     [label[s] for s, t, a in arcs if t == nid and a != 'none'],
                                     db.references(data['References'])))
            continue
        own = {f: data[f] for f in FIELDS if data.get(f)}
        if not own:
            continue
        node = {'label': first_label(gn), 'class': kind, 'box': [round(x + tx, 1), round(y + ty, 1), round(w, 1), round(h, 1)],
                'props': record(own)}
        # a family's members, by their HGNC symbols in Members; a member's sites (PTM) from Member annotation
        old = {m['symbol']: dict(m['props']) for m in json.loads(data.get('Member annotation') or '[]')}
        symbols = [x.strip() for x in data.get('Members', '').split(';') if x.strip()] or list(old)
        members = [{'symbol': sym, 'props': record(dict({k: v for k, v in old.get(sym, {}).items() if k in FIELDS}, **{'HGNC symbol': sym}))}
                   for sym in symbols]
        if members:
            node['members'] = members
        nodes.append(node)
    return nodes


def record(own):
    # the panel's fields: fetched where every identifier is single, else only what the file holds
    if any(',' in own.get(k, '') for k in ('HGNC', 'HGNC symbol', 'UniProt', 'ChEBI')):
        return [[f, own[f]] for f in FIELDS if own.get(f)]
    return db.record(own)


def process(kind, at, ins, outs, by, refs):
    # a process glyph is small: a click a little outside it still finds it
    return {'label': '', 'class': kind, 'box': [round(at[0] - 12, 1), round(at[1] - 12, 1), 24, 24], 'props': [],
            'reaction': {'in': ins, 'out': outs, 'by': by}, 'references': refs}


# ---------- CellDesigner ----------
C = '{http://www.sbml.org/2001/ns/celldesigner}'
S = '{http://www.sbml.org/sbml/level2/version4}'
RDF = '{http://www.w3.org/1999/02/22-rdf-syntax-ns#}'
# MIRIAM namespaces to the viewer's fields (others are kept under their own name; the panel shows the ones it knows)
FIELD = {'uniprot': 'UniProt', 'hgnc': 'HGNC', 'hgnc.symbol': 'HGNC symbol', 'obo.chebi': 'ChEBI', 'chebi': 'ChEBI',
         'ncbigene': 'Entrez', 'entrez.gene': 'Entrez', 'ensembl': 'Ensembl', 'refseq': 'RefSeq', 'kegg.compound': 'KEGG',
         'hmdb': 'HMDB', 'lipidmaps': 'LIPID MAPS'}
CLASS = {'PROTEIN': 'Macromolecule', 'RECEPTOR': 'Macromolecule', 'ION_CHANNEL': 'Macromolecule',
         'TRUNCATED': 'Macromolecule', 'SIMPLE_MOLECULE': 'SimpleChemical', 'ION': 'SimpleChemical',
         'DRUG': 'SimpleChemical', 'GENE': 'NucleicAcidFeature', 'RNA': 'NucleicAcidFeature',
         'ANTISENSE_RNA': 'NucleicAcidFeature', 'COMPLEX': 'Complex', 'PHENOTYPE': 'Phenotype',
         'UNKNOWN': 'UnspecifiedEntity', 'DEGRADED': 'SourceAndSink'}


def miriam(e):
    out = []
    for li in e.iter(RDF + 'li'):
        m = re.match(r'urn:miriam:([^:]+):(.+)$', li.get(RDF + 'resource') or '')
        if m and (m.group(1), unquote(m.group(2)).strip()) not in out:
            out.append((m.group(1), unquote(m.group(2)).strip()))
    return out


def name(n):
    return ' '.join(plain_name(n or '').replace('_br_', ' ').split())


def celldesigner(src, out_svg):
    r = render('cd', src)
    svg, hits = r['svg'], r['hits']
    for a in hits['aliases']:
        a['box'] = floats(a['box'])
    for h in hits['reactions'].values():
        h['lines'] = floats(h['lines'])
        if h['at'] is not None:
            h['at'] = floats(h['at'])
    open(out_svg, 'w', encoding='utf-8').write(svg)
    model = etree.parse(src).getroot().find(S + 'model')
    species = {}
    for s in list(model.iter(S + 'species')) + list(model.iter(C + 'species')):
        cls = s.findtext('.//' + C + 'class') or ''
        props = collections.defaultdict(list)
        for ns, i in miriam(s):
            if ns in ('obo.chebi', 'chebi') and not i.upper().startswith('CHEBI:'):
                i = 'CHEBI:' + i
            if ns == 'hgnc' and not i.upper().startswith('HGNC:'):
                i = 'HGNC:' + i
            props[FIELD.get(ns, ns)].append(i)
        species[s.get('id')] = {'label': name(s.get('name')), 'class': CLASS.get(cls, cls),
                                'props': record({f: ', '.join(props[f]) for f in FIELDS if f in props}) if props else []}
    nodes = [{'label': species[a['species']]['label'], 'class': species[a['species']]['class'], 'box': a['box'],
              'props': species[a['species']]['props']}
             for a in hits['aliases'] if species.get(a['species'], {}).get('props')]
    alias_name = {a['id']: species.get(a['species'], {}).get('label', '') for a in hits['aliases']}
    sp_name = lambda e: species.get(e.get('species') or e.get('reactant') or e.get('product') or '', {}).get('label') \
        or alias_name.get(e.get('alias'), '')
    for rx in model.iter(S + 'reaction'):
        x = rx.find(S + 'annotation/' + C + 'extension')
        refs = db.references(' '.join(ns + ':' + i for ns, i in miriam(rx) if ns in ('pubmed', 'doi')))
        at = hits['reactions'].get(rx.get('id'), {}).get('at')
        if x is None or not refs or not at:
            continue
        ins = [sp_name(e) for e in x.iterfind(C + 'baseReactants/' + C + 'baseReactant')] + \
              [sp_name(e) for e in x.iterfind(C + 'listOfReactantLinks/' + C + 'reactantLink')]
        outs = [sp_name(e) for e in x.iterfind(C + 'baseProducts/' + C + 'baseProduct')] + \
               [sp_name(e) for e in x.iterfind(C + 'listOfProductLinks/' + C + 'productLink')]
        by = [' and '.join(alias_name.get(a, '') for a in (m.get('aliases') or '').split(','))
              for m in x.iterfind(C + 'listOfModification/' + C + 'modification')
              if not (m.get('type') or '').startswith('BOOLEAN_LOGIC_GATE')]
        nodes.append(process('Process', at, ins, outs, by, refs))
    return nodes


# ---------- SBGN-ML ----------


def drawn(name, nodes, extra=b''):
    # the click data of a drawing written beside its SVG; its size and its version (picture, click data and extra)
    svg = os.path.join(ROOT, 'downloads', name + '.svg')
    ann = os.path.join(ROOT, 'atlas-data', name + '.json')
    json.dump({'nodes': nodes}, open(ann, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    text = open(svg, encoding='utf-8').read()
    w, h = (int(float(v)) for v in re.search(r'<svg[^>]* width="([\d.]+)" height="([\d.]+)"', text).groups())
    v = hashlib.sha1(open(svg, 'rb').read() + open(ann, 'rb').read() + extra).hexdigest()[:10]
    return dict({'image': '/downloads/%s.svg' % name, 'annotation': '/atlas-data/%s.json' % name, 'width': w, 'height': h, 'v': v},
                **({'shapes': True} if 'class="sbgn-generic"' in text else {}))   # association or dissociation drawn


def sbgnml(src, name, body, keep=False):
    # the SBGN-ML file through the converter to GraphML, then drawn and read as a GraphML map into downloads/<name>.svg:
    # the drawing (drawn()) and its click data. A file the converter or the renderer cannot take is said and left out,
    # never stopping the build of the other maps. keep: the GraphML kept as atlas-data/<name>.graphml, the file the
    # editor edits the map as (renderers/converter/sbgn_edit.js)
    import contextlib, io, tempfile
    from mapconv import sbgnml as reader, graphml as writer, report
    tmp = None
    try:
        with report.collect(), contextlib.redirect_stdout(io.StringIO()):
            text = writer.write(reader.read(src))
        with tempfile.NamedTemporaryFile('w', suffix='.graphml', delete=False, encoding='utf-8') as f:
            f.write(text)
        tmp = f.name
        nodes = graphml(tmp, os.path.join(ROOT, 'downloads', name + '.svg'))
        if keep:
            shutil.copy(tmp, os.path.join(ROOT, 'atlas-data', name + '.graphml'))
    except (Exception, SystemExit) as e:
        print('warning: %s not drawn, left out: %s' % (os.path.relpath(src, ROOT), str(e).splitlines()[0] if str(e) else type(e).__name__))
        return None, []
    finally:
        if tmp:
            os.unlink(tmp)
    return drawn(name, nodes, body.encode()), nodes   # the text in its version too: the map's text is fetched with it


def sbgn_map(src, mid, fm, body):
    # the group SBGN-ML (header): the GraphML map src written by the converter as SBGN-ML and drawn back from it; its
    # entry and search entries, or none when the converter or the drawing fails (said, the build goes on)
    from mapconv import routes
    sid = re.sub(r'-graphml$', '', mid) + '-sbgn'
    outs = routes.outputs(src)   # a map the converter cannot read gives one route that says why
    out = next((o for o in outs if o.ending == '-advanced.sbgn'), outs[0])
    text, said = routes.made(out)
    if not text or out.ending != '-advanced.sbgn':
        print('warning: %s not written as SBGN-ML, left out: %s' % (mid, '; '.join(t for _, t in said[-1:]) or 'no route'))
        return None, []
    path = os.path.join(ROOT, 'downloads', sid + '.sbgn')
    with open(path, 'w', encoding='utf-8') as f:
        f.write(text)
    d, nodes = sbgnml(path, sid, body)
    if not d:
        os.unlink(path)   # no entry, so no file left behind
        return None, []
    d['file'] = '/downloads/' + os.path.basename(path)
    return (sid, entry_of(fm['title'], 'SBGN-ML', fm['order'] + 100, d, topic=fm['topic'])), search_entries(sid, nodes)


def examples():
    # the group SBGN-ML external (header): [(id, entry, search entries, text)]
    import csv
    pd = os.path.join(ROOT, 'test-maps', 'sbgn-ml', 'pd')
    src = {r['file']: r for r in csv.DictReader(open(os.path.join(ROOT, 'test-maps', 'sbgn-ml', 'sources.tsv'), encoding='utf-8'), delimiter='\t')}
    rels = sorted(os.path.relpath(f, pd) for f in glob.glob(os.path.join(pd, '**', '*'), recursive=True) if f.endswith(('.sbgn', '.nwt')))
    rels = [r for r in rels if 'validation' not in r.split(os.sep)]   # libsbgn's error tests left out
    name = lambda r: os.path.splitext(os.path.basename(r))[0].replace('_', ' ') + (' (Newt file)' if r.endswith('.nwt') else '')
    short = collections.Counter(name(r) for r in rels)
    out = []
    for k, rel in enumerate(rels):
        key = rel.replace(os.sep, '/')
        r = src['pd/' + key]
        sid = 'external-' + re.sub(r'[^a-z0-9]+', '-', key.lower()).strip('-')   # with its ending: a Newt .nwt beside its .sbgn
        db.current = sid
        # edited in the viewer (user, 2026-11-14): the edited copy in maps/sbgn-ml/pd/<the same path> is drawn in place of
        # the file, which stays unchanged in test-maps/; the editor saves there (edit_path) and edits the map as the
        # converter's GraphML of the file drawn (edit_base)
        mine = os.path.join(ROOT, 'maps', 'sbgn-ml', 'pd', rel)
        edited = os.path.exists(mine)
        body = 'From %s (%s), `%s`, %s. %s' % (r['source'], r['repository'], r['path_in_source'], r['licence'],
                                               'Edited in the viewer; the original is in test-maps/.' if edited else 'Unchanged, drawn from its own file.')
        src_file = mine if edited else os.path.join(pd, rel)
        d, nodes = sbgnml(src_file, sid, body, keep=True)
        if not d:
            continue
        if edited:
            shutil.copy(mine, os.path.join(ROOT, 'downloads', sid + os.path.splitext(rel)[1]))
            d['file'] = '/downloads/' + sid + os.path.splitext(rel)[1]
        else:
            d['file'] = '/test-maps/sbgn-ml/pd/' + key   # published as it is (test-maps/sbgn-ml/README.md)
        data = open(src_file, 'rb').read()
        d['src'] = hashlib.sha1(b'blob %d\0' % len(data) + data).hexdigest()   # as for a map of maps/: the kept drawing waits for its build
        d['edit_path'], d['edit_base'] = 'maps/sbgn-ml/pd/' + key, '/atlas-data/%s.graphml' % sid
        title = '%s: %s' % (key.split('/')[0], name(rel) if short[name(rel)] == 1 else '/'.join(key.split('/')[1:-1] + [name(rel)]))
        out.append((sid, entry_of(title, 'SBGN-ML external', 1000 + k, d), search_entries(sid, nodes), body))
    return out


def entry_of(title, group, order, d, **more):
    # a map's entry (_maps/<id>.md front matter) from its drawing (drawn() and its file): its first download the file
    return dict({'title': title, 'topic': title, 'tab': '', 'page': '', 'group': group, 'order': order, 'kind': 'map',
                 'draft': False, 'tag': '', 'image': d['image'], 'width': d['width'], 'height': d['height'], 'scale': 1,
                 'annotation': d['annotation'], 'image_error': '', 'v': d['v'], 'colours': True, 'legend': 'sbgn',
                 'downloads': [{'label': 'SBGN-ML', 'url': d['file']}, {'label': 'SVG', 'url': d['image']}]},
                **({'shapes': True} if d.get('shapes') else {}), **{k: d[k] for k in ('src', 'edit_path', 'edit_base') if k in d}, **more)


def write_entry(eid, e, body):
    with open(os.path.join(ROOT, '_maps', eid + '.md'), 'w', encoding='utf-8') as f:
        f.write('---\n' + ''.join('%s: %s\n' % (k, json.dumps(v, ensure_ascii=False)) for k, v in e.items()) + '---\n' + body + '\n')


# ---------- the atlas ----------


def entry(mid):
    # maps/<id>.md: front matter (simple "key: value" lines) and the text
    path = os.path.join(ROOT, 'maps', mid + '.md')
    meta, body = {}, ''
    if os.path.exists(path):
        _, head, body = open(path, encoding='utf-8').read().split('---\n', 2)
        meta = {k.strip(): v.strip().strip('"') for k, _, v in (l.partition(':') for l in head.splitlines() if ':' in l)}
    return meta, body.strip()


SITE = 'https://viewer-source.github.io'
ENDINGS = (('-sbml.xml', 'SBML'), ('.xml', 'CellDesigner'), ('.graphml', 'GraphML'), ('.sbgn', 'SBGN-ML'), ('.png', 'PNG'),
           ('.csv', 'Annotation'))


def extra(mid, meta):
    # maps/extra/<id>/: more downloads for one map, and its Newt and MINERVA links
    out = []
    for f in sorted(glob.glob(os.path.join(ROOT, 'maps', 'extra', mid, '*'))):
        name = os.path.basename(f)
        label = next((l for e, l in ENDINGS if name.lower().endswith(e)), None)
        if not label:
            continue
        shutil.copy(f, os.path.join(ROOT, 'downloads', name))
        out.append({'label': label, 'url': '/downloads/' + name})
    sbgn = [d['url'] for d in out if d['label'] == 'SBGN-ML']
    if meta.get('newt') == 'true' and sbgn:
        out.append({'label': 'Newt', 'url': 'http://web.newteditor.org/?URL=' + SITE + sbgn[0]})
    if meta.get('minerva'):
        out.append({'label': 'MINERVA', 'url': meta['minerva']})
    return out


def main():
    for d in ('downloads', 'atlas-data', '_maps'):
        shutil.rmtree(os.path.join(ROOT, d), ignore_errors=True)
        os.makedirs(os.path.join(ROOT, d))
    search = []
    sources = sorted(glob.glob(os.path.join(ROOT, 'maps', '*.graphml')) + glob.glob(os.path.join(ROOT, 'maps', '*.xml')))
    for src in sources:
        mid, ext = os.path.splitext(os.path.basename(src))
        db.current = mid
        svg = os.path.join(ROOT, 'downloads', mid + '.svg')
        nodes = (graphml if ext == '.graphml' else celldesigner)(src, svg)
        shutil.copy(src, os.path.join(ROOT, 'downloads', mid + ext))
        search += search_entries(mid, nodes)
        meta, body = entry(mid)
        d = drawn(mid, nodes, body.encode())
        w, h, v = d['width'], d['height'], d['v']
        # the source's git blob sha, as GitHub gives it on a save: the editor keeps its own drawing until the site's
        # build is of the very file it saved last, not of an earlier save (2026-11-12: builds of two saves overlapped)
        data = open(src, 'rb').read()
        sha = hashlib.sha1(b'blob %d\0' % len(data) + data).hexdigest()
        fm = {'title': meta.get('title', mid), 'topic': meta.get('topic', meta.get('title', mid)), 'tab': '', 'page': '',
              'group': meta.get('group', ''), 'order': int(meta.get('order', 0)), 'kind': 'map', 'draft': False, 'tag': '',
              'image': '/downloads/%s.svg' % mid, 'width': w, 'height': h, 'scale': 1,
              'annotation': '/atlas-data/%s.json' % mid, 'image_error': '', 'v': v, 'src': sha,
              'colours': True,  # the picture has the role classes (yrender.js and cdrender.js with classes on)
              'legend': 'sbgn' if ext == '.graphml' else 'celldesigner',  # the legend the Legend window opens on
              'downloads': [{'label': 'GraphML' if ext == '.graphml' else 'CellDesigner', 'url': '/downloads/%s%s' % (mid, ext)},
                            {'label': 'SVG', 'url': '/downloads/%s.svg' % mid}]}
        if d.get('shapes'):
            fm['shapes'] = True
        fm['downloads'] += extra(mid, meta)
        sb = sorted(glob.glob(os.path.join(ROOT, 'maps', 'extra', mid, '*.sbgn')))
        if sb:
            fm['sbgn'], found = sbgnml(sb[0], mid + '-sbgnml', body)
            search += [dict(e, s=1) for e in search_entries(mid, found)]
            if fm['sbgn']:
                fm['sbgn']['file'] = '/downloads/' + os.path.basename(sb[0])   # copied there by extra()
            else:
                del fm['sbgn']
        entries = [(mid, fm)]
        if ext == '.graphml' and fm['group'] == 'GraphML':
            own, found = sbgn_map(src, mid, fm, body)
            entries += [own] if own else []
            search += found
        for eid, e in entries:
            write_entry(eid, e, body)
        print('%s: %s, %d clickable' % (mid, 'yEd' if ext == '.graphml' else 'CellDesigner', len(nodes)))
    for sid, e, found, body in examples():
        search += found
        write_entry(sid, e, body)
        print('%s: SBGN-ML external' % sid)
    db.save()
    json.dump(search, open(os.path.join(ROOT, 'atlas-data', 'search.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, separators=(',', ':'))


if __name__ == '__main__':
    main()
