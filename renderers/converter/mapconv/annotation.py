# MIRIAM annotation of a map's labels: label -> (family, [urn]). A family is written as
# bqbiol:hasVersion, one entity as bqbiol:is.
# Read from the GraphML's node properties as annotate.py writes them (HGNC symbol, HGNC,
# UniProt, ChEBI; Member annotation for a family). A map without them (not annotated):
# from the node links to ChEBI and UniProt.
import json, re, urllib.parse

LINK = [(r'chebiId=(CHEBI:\d+)', lambda x: ['urn:miriam:obo.chebi:' + x.replace(':', '%3A')]),
        (r'uniprot(?:kb)?/(\w+)', lambda x: ['urn:miriam:uniprot:' + x])]


def miriam(p):
    # the URNs of one entity's properties
    if p.get('ChEBI'):  # CellDesigner drops other ChEBI forms when it saves
        return ['urn:miriam:obo.chebi:' + p['ChEBI'].replace(':', '%3A')]
    out = ['urn:miriam:hgnc.symbol:' + p['HGNC symbol']] if p.get('HGNC symbol') else []  # CellDesigner: UniProt alone
    if p.get('HGNC'): out.append('urn:miriam:hgnc:' + p['HGNC'].replace('HGNC:', ''))
    if p.get('UniProt'): out.append('urn:miriam:uniprot:' + p['UniProt'])
    return out


def uses_links(diagram):
    # a map without identifier properties (not annotated): its node links to ChEBI and UniProt are read instead
    return not any(d.data.get(k) for d in diagram.nodes.values() for k in ('ChEBI', 'HGNC symbol', 'Member annotation'))


def of_node(p, links=False):
    # (family, [urn]) of one node's properties, None without any
    if p.get('Member annotation'):
        return True, [u for m in json.loads(p['Member annotation']) for u in miriam(dict(m['props']))]
    if p.get('ChEBI') or p.get('HGNC symbol'):
        return False, miriam(p)
    if links:
        for pat, urns in LINK:
            hit = re.search(pat, p.get('url', ''))
            if hit:
                return False, urns(hit.group(1))
    return None


def from_graphml(diagram):
    out, links = {}, uses_links(diagram)
    for d in diagram.nodes.values():
        lab = ' '.join(d.labels[0].split()) if d.labels else ''
        if lab and lab not in out:
            a = of_node(d.data, links)
            if a:
                out[lab] = a
    return out


def to_properties(family, uris):
    # inverse of miriam(): node properties from an entity's URNs; a family's URNs are its
    # members' one after another, each starting with an HGNC symbol or a ChEBI id
    members = []
    for u in uris:
        db, _, x = u.rpartition(':')
        if db in ('urn:miriam:hgnc.symbol', 'urn:miriam:obo.chebi') or not members:
            members.append({})
        k = {'urn:miriam:hgnc.symbol': 'HGNC symbol', 'urn:miriam:hgnc': 'HGNC', 'urn:miriam:uniprot': 'UniProt',
             'urn:miriam:obo.chebi': 'ChEBI'}.get(db)
        if k: members[-1][k] = 'HGNC:' + x if k == 'HGNC' else x.replace('%3A', ':')
    if not family:  # one entity: every URN its own, whatever their order (MINERVA lists RefSeq first)
        return {k: v for m in reversed(members) for k, v in m.items()}
    order = ['HGNC', 'HGNC symbol', 'UniProt', 'ChEBI']  # as annotate.py lists them
    return {'Members': '; '.join(m.get('HGNC symbol', m.get('ChEBI', '')) for m in members),
            'Member annotation': json.dumps([{'symbol': m.get('HGNC symbol', ''), 'props': [[k, m[k]] for k in order if k in m]}
                                             for m in members], ensure_ascii=False)}


def units(p):
    # the property Unit of information, one per line: what tells a form apart that the drawing
    # does not show (a cleavage fragment, "C-terminal fragment"), so the one unit CellDesigner draws stays free for N:x
    return [' '.join(x.split()) for x in (p.get('Unit of information') or '').splitlines() if x.strip()]


def sites(p, states):
    # the node property PTM's sites (P@S1177) given to the state variables that show only their value, in the order
    # drawn, each to the first unused site of its value; returns each state's site ('' for none) and the sites no
    # state variable takes (more sites than circles: kept as a note, PTM)
    left = (p.get('PTM') or '').split()
    out = []
    left = [x for x in left if x not in states]  # the sites a circle shows itself first
    for txt in states:
        v, at, var = txt.partition('@')
        if at:
            out.append(var); continue
        k = next((j for j, x in enumerate(left) if v and x.partition('@')[0] == v), None)
        out.append(left.pop(k).partition('@')[2] if k is not None else '')
    return out, left


# SBGN classes a CellDesigner phenotype stands for, kept there as the note line 'SBGN class: submap' (written and read by
# the CellDesigner writer and reader only) so a round trip gives them back: CellDesigner has one glyph for phenotype, submap
# and perturbing agent, and its arcs cannot tell them apart. Arcs leaving them are SBGN's own (no warning)
PHENOTYPE_CLASSES = ('submap', 'perturbing agent')


def notes(p, undrawn=()):
    # what MIRIAM cannot hold, as note lines: a family's name ("Family: ERK1/2"), its members' sites
    # ('MAPK3: P@T202 P@Y204') and the entity's own sites no state variable holds ('PTM: P@Y1189 P@Y1190')
    lines = ['Family: ' + ' '.join(p['Family'].split())] if p.get('Family') else []
    lines += ['PTM: ' + ' '.join(undrawn)] if undrawn else []
    # units not drawn, on one line: CellDesigner keeps only the first line of a complex member's note
    lines += ['Unit of information: ' + '; '.join(units(p))] if units(p) else []
    for m in json.loads(p.get('Member annotation') or '[]'):
        ptm = ' '.join((dict(m['props']).get('PTM') or '').split())
        if ptm:
            lines.append('%s: %s' % (m['symbol'], ptm))
    return lines


def from_notes(text, p):
    # inverse of notes(): the properties with the family's name, its members' sites and the units not drawn
    members = json.loads(p.get('Member annotation') or '[]')
    out = dict(p)
    for line in (text or '').splitlines():
        k, _, v = line.strip().partition(': ')
        if k == 'Family' and v:
            out['Family'] = v
        if k == 'PTM' and v and all(re.fullmatch(r'[^@\s]*@\S+', x) for x in v.split()):  # sites only, not free text
            out['PTM'] = '\n'.join(dict.fromkeys((out.get('PTM') or '').split() + v.split()))
        if k == 'Unit of information' and v:
            out['Unit of information'] = '\n'.join(units(out) + [u.strip() for u in v.split('; ') if u.strip()])
        for m in members:
            if m['symbol'] == k and v:
                m['props'] = [x for x in m['props'] if x[0] != 'PTM'] + [['PTM', v]]
                out['Member annotation'] = json.dumps(members, ensure_ascii=False)
    return out



# References on a process: the node property References, prefix:id separated by spaces
# (pubmed:12456591 doi:10.1016/j.jaci.2020.12.155), as MINERVA maps hold them on the reaction (MIRIAM
# isDescribedBy, one bag each); a bare number is a PMID, a bare 10.x a DOI.
def references(text):
    out = []
    for x in re.split(r'[\s,;]+', text or ''):
        db, _, i = ('doi', '', x) if x.lower().startswith('10.') else x.partition(':') if ':' in x else ('', '', x)
        db = {'pmid': 'pubmed', '': 'pubmed' if i.isdigit() else ''}.get(db.lower(), db.lower())
        if db and i:
            out.append('urn:miriam:%s:%s' % (db, urllib.parse.quote(i, safe='')))
    return out


def from_references(urns):  # inverse of references(): the property's text
    return ' '.join('%s:%s' % (db, urllib.parse.unquote(i)) for db, _, i in
                    (u[len('urn:miriam:'):].partition(':') for u in urns if u.startswith('urn:miriam:')))
