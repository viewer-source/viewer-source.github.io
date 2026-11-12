# The layout skill's tools for the editor (user, 2026-11-12): run on the map's text, and only the attributes they change
# written back into that text, the rest byte for byte (the editor's rule: yEd opens the file as before).
#   tidy(text, 'grid')            the whole map onto the grid (snap_grid.snap: complexes packed first, compartments fitted)
#   tidy(text, 'pack', ids)       the complexes with these node ids, or round them, packed (all when ids is empty), the groups fitted;
#                                 -1 changes when none of them is or sits in a complex
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


def tidy(text, what, ids=()):
    root = etree.fromstring(text.encode('utf-8'))
    els = list(root.iter(etree.Element))
    before = [dict(e.attrib) for e in els]
    if what == 'grid':
        snap_grid.snap(root)
    else:
        complex_pack.pack(root)
    after = [dict(e.attrib) for e in els]
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
