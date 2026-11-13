# The layout skill's tools for the editor (user, 2026-11-12): run on the map's text, and only the attributes they change
# written back into that text, the rest byte for byte (the editor's rule: yEd opens the file as before).
#   tidy(text, 'grid')            the whole map onto the grid (snap_grid.snap: complexes packed first, compartments fitted)
#   tidy(text, 'pack', ids)       the complexes with these node ids, or round them, packed (all when ids is empty), the groups fitted;
#                                 -1 changes when none of them is or sits in a complex
#   tidy(text, 'fit', {'resize': [id, x, y, w, h], 'moved': [ids]})
#                                 compartments are containers (user, 2026-11-12): the one resized gets its new box, never
#                                 smaller than what it holds; the compartments round it and round the nodes moved grow to
#                                 hold them, never shrink; their BorderInsets fitted (and those of the complexes round the
#                                 nodes moved), so yEd keeps the boxes. Nodes keep their sizes.
#   keep_ports                    a CellDesigner map (the GraphML the converter's cd_edit makes of it): every line keeps
#                                 its ports, as CellDesigner keeps a line's connection point on the node (one of its 16)
#                                 and moves it with the node, so a tool moving or resizing nodes never changes where a
#                                 line meets them (snap_grid's straightened ports had turned ENE into E)
# Returns [new text, how many attributes changed]. The tools change attributes only, never add or remove elements, so the
# n-th start tag of the text is the n-th element lxml reads.
import re
from lxml import etree
import complex_pack, snap_grid

TAG = re.compile(r'<!--.*?-->|<!\[CDATA\[.*?\]\]>|<\?.*?\?>|<![^>]*>|</[^>]*>|<([^\s/>!?]+)([^>]*)>', re.S)


def num(v):  # as the editor writes a number: at most three decimals, no trailing zeros
    try:
        f = round(float(v), 3)
    except ValueError:
        return v
    return str(int(f)) if f == int(f) else repr(f)


def is_compartment(n):
    return n.get('yfiles.foldertype') == 'group' and not complex_pack.is_complex(n)


def fit(root, resize=None, moved=()):
    G, NS, cp = complex_pack.G, complex_pack.NS, complex_pack
    byid = {n.get('id'): n for n in root.iter(G + 'node')}
    gone = {byid[i] for i in moved if i in byid}
    gone = {d for n in gone for d in n.iter(G + 'node')}   # a group moves with what it holds
    grow, insets, sized = [], [], None
    if resize and resize[0] in byid and is_compartment(byid[resize[0]]):
        sized = byid[resize[0]]
        w, h = max(float(resize[3]), 20.0), max(float(resize[4]), 20.0)
        cp.set_box(sized, [float(resize[1]), float(resize[2]), w, h])
        grow.append(sized)
        grow += [a for a in sized.iterancestors(G + 'node') if is_compartment(a)]
    for n in gone:
        for a in n.iterancestors(G + 'node'):
            if a in gone:
                continue
            (grow if is_compartment(a) else insets).append(a)
    grow = sorted(set(grow), key=lambda g: -len(list(g.iterancestors())))   # innermost first
    for g in grow:
        if not cp.members(g):
            continue
        x, y, w, h = cp.box(g)
        now = {k: min(v, 0.0) for k, v in cp.room(g, cp.realizer(g))[1].items()}
        if any(now.values()):
            x0, y0 = x + now['left'], y + now['top']
            x1, y1 = x + w - now['right'], y + h - now['bottom']
            cp.set_box(g, [x0, y0, x1 - x0, y1 - y0])
    for g in set(grow) | set(insets):   # as complex_pack.fit_insets, for these groups only
        if not cp.members(g):
            continue
        for r in g.find('g:data/y:ProxyAutoBoundsNode/y:Realizers', NS):
            i, need = cp.room(g, r)
            if need['top'] < 0 and r is cp.realizer(g):
                ins = r.find('y:Insets', NS); t = max(i['top'] + need['top'], 0.0)
                ins.set('top', str(int(round(t)))); ins.set('topF', repr(t))
            bi = r.find('y:BorderInsets', NS)
            if bi is None:
                continue
            for k, v in need.items():
                v = max(v, 0.0)
                bi.set(k, str(int(round(v)))); bi.set(k + 'F', repr(v))


def tidy(text, what, ids=(), keep_ports=False):
    root = etree.fromstring(text.encode('utf-8'))
    els = list(root.iter(etree.Element))
    before = [dict(e.attrib) for e in els]
    if what == 'grid':
        snap_grid.snap(root)
    elif what == 'fit':
        fit(root, ids.get('resize'), ids.get('moved') or ())
    else:
        complex_pack.pack(root)
    after = [dict(e.attrib) for e in els]
    if keep_ports:
        PATH = '{http://www.yworks.com/xml/graphml}Path'
        after = [b if e.tag == PATH else a for e, a, b in zip(els, after, before)]
    if what == 'pack' and ids:   # only the complexes chosen: what they hold, the ends of their arcs, the groups round them
        G = complex_pack.G
        chosen = []   # a complex chosen, or the complex round a member chosen
        for n in root.iter(G + 'node'):
            if n.get('id') in ids:
                c = next((a for a in [n] + list(n.iterancestors(G + 'node')) if complex_pack.is_complex(a)), None)
                if c is not None and c not in chosen:
                    chosen.append(c)
        if not chosen:
            return [text, -1]
        keep = set()
        for n in chosen:
            keep.update(n.iter(etree.Element))
            for a in n.iterancestors(G + 'node'):
                keep.update(a.find('g:data', complex_pack.NS).iter(etree.Element))
        inside = {d.get('id') for n in chosen for d in n.iter(G + 'node')}
        for e in root.iter(G + 'edge'):
            if e.get('source') in inside or e.get('target') in inside:
                keep.update(e.iter(etree.Element))
        after = [a if e in keep else b for e, a, b in zip(els, after, before)]
    out, k, at, changed = [], -1, 0, 0
    for m in TAG.finditer(text):
        if m.group(1) is None:
            continue
        k += 1
        new = {a: v for a, v in after[k].items() if before[k].get(a) != v and num(v) != num(before[k].get(a, ''))}
        if not new:
            continue
        tag = m.group(0)
        for a, v in new.items():
            q = re.search(r'(\s%s=")[^"]*(")' % re.escape(a.split('}')[-1]), tag)
            tag = tag[:q.start()] + q.group(1) + num(v) + q.group(2) + tag[q.end():] if q else tag.replace(m.group(1), m.group(1) + ' %s="%s"' % (a, num(v)), 1)
            changed += 1
        out.append(text[at:m.start()]); out.append(tag); at = m.end()
    out.append(text[at:])
    return ['' .join(out), changed]
