# The biology of a map (model.Biology) from its drawing: which glyphs draw one entity, and the
# reactions and influences between entities. The entity key:
# two glyphs are one entity when they have the same identity, state,
# compartment and glyph class. Identity: an identifier where the glyph has one (proteins, genes,
# RNA: HGNC ID, else UniProt, else HGNC symbol; metabolites: ChEBI, conjugate acid and base
# joined), else the normalised label, which joins an annotated entity when it points to exactly
# one identifier. Complexes by their members, families by their members' identifiers. A chain
# length in the label (N:n, N:n+1) counts as the multimer count does.
import collections, json, os, re, urllib.parse
from .celldesigner import CLASS, MOD, cd_class, plain_name, is_structural
from .graphml import EQUIV
from .annotation import NOT_THE_BOX, bags, units as hidden_units
from .model import HEADS, Annotation, Biology, Entity, Influence, Member, Reaction, StateVariable, UnitOfInformation

PROCESSES = ('Process', 'OmittedProcess', 'UncertainProcess')
# ChEBI IDs linked as conjugate acid and base, one group per molecule (tools/conjugates.py)
TABLE = os.path.join(os.path.dirname(__file__), 'conjugates.json')
CONJUGATE = {}
if os.path.exists(TABLE):
    with open(TABLE, encoding='utf-8') as f:
        CONJUGATE = {c: g[0] for g in json.load(f)['groups'] for c in g}


def label(d):
    return ' '.join(plain_name(d.labels[0]).split()) if d.labels else ''


def identifier(p, kind):
    # an entity's identifier from its properties (graphml node data, or read from MIRIAM)
    if kind == 'SimpleChemical':
        return ('chebi', CONJUGATE.get(p['ChEBI'], p['ChEBI'])) if p.get('ChEBI') else None
    for k in ('HGNC', 'UniProt', 'HGNC symbol'):
        if p.get(k):
            return (k.lower(), p[k])
    return None


# namespaces whose keys say what a box is, a gene product or a molecule (the identifiers book's role table); the others
# (GO, PubMed, Reactome's forms in a place, ...) describe it and never join boxes
NAMES_THE_BOX = {'hgnc', 'hgnc.symbol', 'uniprot', 'ncbigene', 'ensembl', 'refseq', 'chebi', 'kegg.compound',
                 'pubchem.compound', 'inchikey', 'complexportal'}
RENAMED = {'entrez.gene': 'ncbigene', 'obo.chebi': 'chebi'}


def keys(d):
    # (the box's keys {(namespace, accession)}, whether they all come from isVersionOf): its four properties and the
    # links kept as read (Identifiers) of a namespace that names the box, under a qualifier that says what it is; a
    # family's hasVersion and a set's hasPart name its members, not the box
    out = {(ns, d.data[k]) for k, ns in (('HGNC', 'hgnc'), ('UniProt', 'uniprot'), ('HGNC symbol', 'hgnc.symbol')) if d.data.get(k)}
    if d.data.get('ChEBI'):
        out.add(('chebi', d.data['ChEBI']))
    weak = not out
    for _, q, links in bags(d.data):
        if q in NOT_THE_BOX or q in ('hasVersion', 'hasPart'):
            continue
        for u in links:
            db, _, x = u[len('urn:miriam:'):].partition(':') if u.startswith('urn:miriam:') else ('', '', '')
            db = RENAMED.get(db, db)
            if db in NAMES_THE_BOX:
                out.add((db, urllib.parse.unquote(x) if db != 'hgnc' else 'HGNC:' + urllib.parse.unquote(x)))
                weak = weak and q == 'isVersionOf'
    out = {(ns, CONJUGATE.get(x, x)) if ns == 'chebi' else (ns, x) for ns, x in out}
    if d.kind == 'SimpleChemical':  # a metabolite by its molecule's keys only
        out = {(ns, x) for ns, x in out if ns in ('chebi', 'kegg.compound', 'pubchem.compound', 'inchikey')}
    return frozenset(out), weak and bool(out)


def identities(N, glyphs, label):
    # one identity per glyph with keys: two glyphs are one when they share a key and, in every namespace both have,
    # hold the same keys (two UniProt accessions keep them apart, so do a family and one of its members); glyphs of
    # different names join only when neither has its keys from isVersionOf alone (such files write a form in its name)
    own = {i: keys(N[i]) for i in glyphs}
    own = {i: v for i, v in own.items() if v[0]}
    up, held = {i: i for i in own}, {i: own[i][0] for i in own}
    def top(i):
        while up[i] != i:
            up[i] = up[up[i]]; i = up[i]
        return i
    def fits(a, b):
        ns = lambda k: {x for x, _ in k}
        return all({k for k in held[a] if k[0] == n} == {k for k in held[b] if k[0] == n} for n in ns(held[a]) & ns(held[b]))
    by_key = collections.defaultdict(list)
    for i in sorted(own, key=lambda i: [int(x) if x.isdigit() else x for x in re.split(r'(\d+)', i)]):
        for k in sorted(own[i][0]):
            for j in by_key[k]:  # one glyph per group and name: a shared key held by hundreds (water) stays linear
                a, b = top(i), top(j)
                if a != b and fits(a, b) and (label(N[i]) == label(N[j]) or not (own[i][1] or own[j][1])):
                    up[b] = a; held[a] = held[a] | held[b]
            if not any(top(j) == top(i) and label(N[j]) == label(N[i]) for j in by_key[k]):
                by_key[k].append(i)
    # a group with keys from isVersionOf alone holds one name (above), which tells it from another of the same keys
    named = {top(i): label(N[i]) for i in own if own[i][1]}
    return {i: ('ids', tuple(sorted(held[top(i)]))) + ((named[top(i)],) if top(i) in named else ()) for i in own}


def own_identity(d):
    # the identity a family's annotation gives (its members' identifiers), or None; other glyphs: identities()
    if d.kind not in ('Macromolecule', 'NucleicAcidFeature', 'SimpleChemical') or not d.data.get('Member annotation'):
        return None
    ms = [identifier(dict(m['props']), d.kind) for m in json.loads(d.data['Member annotation'])]
    return ('family', tuple(sorted(ms))) if ms and all(ms) else None


# what a glyph states besides its entity key (a shape and its arcs are not all
# the biology a map conveys), as records (model.StateVariable, ...); node properties that are not
# biology: Orientation (yEd), notes
IDS = ('HGNC', 'HGNC symbol', 'UniProt', 'ChEBI')


def state_variables(d):
    # the drawn state variables, each with its site: on the variable (P@S505), or from the property
    # PTM (P@S505 per modified site, the Atlas maps), given to the unsited ones of that value in turn
    svs = [StateVariable(*txt.split('@', 1)) if '@' in txt else StateVariable(txt) for txt, _, _ in d.states]
    for s in (d.data.get('PTM') or '').split():
        v, site = s.split('@', 1) if '@' in s else (s, None)
        k = next((k for k, x in enumerate(svs) if x == StateVariable(v)), None)
        if k is None:
            svs.append(StateVariable(v, site))  # a site the drawing does not show
        else:
            svs[k] = StateVariable(v, site)
    return svs


def unit(u):
    return UnitOfInformation(u.split(':', 1)[1], 'ct') if u.startswith('ct:') else UnitOfInformation(u)


def annotations(p, qualifier='is'):
    return {Annotation(qualifier, k, ' '.join(p[k].split())) for k in IDS if p.get(k)}


def family_members(d):
    recs = json.loads(d.data.get('Member annotation') or '[]')
    if recs:
        return {Member(m.get('symbol'), tuple(sorted(annotations(dict(m['props']), 'hasVersion'))),
                       tuple(sorted((dict(m['props']).get('PTM') or '').split()))) for m in recs}
    return {Member(x.strip()) for x in (d.data.get('Members') or '').split(';') if x.strip()}


def build(m):
    N = m.nodes
    comps = {i for i, d in N.items() if d.kind == 'Compartment'}
    ents = [i for i, d in N.items() if d.kind in CLASS]
    is_ent = set(ents)
    members = collections.defaultdict(list)
    for i in ents:
        if N[i].parent in is_ent:
            members[N[i].parent].append(i)

    def comp(i):
        q = N[i].parent
        while q is not None and q not in comps:
            q = N[q].parent
        return label(N[q]) if q else 'default'

    def state(i):
        d = N[i]; mods, lig = [], []
        if d.kind in ('Macromolecule', 'Complex'):
            for txt, _, _ in d.states:
                if is_structural(txt):
                    lig.append(txt)
                elif txt.split('@')[0]:
                    mods.append(txt.split('@')[0])
        return tuple(sorted(mods)), tuple(sorted(set(lig)))

    # glyph class: the class, the multimer count, a chain length written in the label (glycogen:
    # glucose (N:n) and (N:n+1): one ChEBI, two entities), a dashed border
    # (hypothetical, a property of the CellDesigner species), and the units of information not drawn (the property
    # Unit of information: two fragments of one protein, one identifier), and what a phenotype stands for (a submap
    # and a phenotype with one name stay two, as CellDesigner draws both as its phenotype)
    cls = lambda i: (cd_class(N[i]), N[i].count) + tuple(re.findall(r'\(N:([^)]+)\)\s*$', label(N[i]))) + \
        (('hypothetical',) if N[i].dashed else ()) + tuple(sorted(hidden_units(N[i].data))) + \
        (('submap' if N[i].kind == 'Submap' else N[i].data.get('SBGN class') or '',) if cd_class(N[i]) == 'PHENOTYPE' else ())
    # identities: an identifier, or a label joining the one identifier it is given elsewhere
    ident = {i: own_identity(N[i]) for i in ents if N[i].kind != 'Complex'}
    ident.update(identities(N, [i for i, x in ident.items() if x is None and
                                N[i].kind in ('Macromolecule', 'NucleicAcidFeature', 'SimpleChemical')], label))
    seen = collections.defaultdict(set)
    for i, x in ident.items():
        if x: seen[label(N[i]), cls(i), state(i), comp(i)].add(x)
    shown = lambda x: ' '.join(a for _, a in x[1]) if x[0] == 'ids' else x[0]
    notes = ['%s: %d identifiers (%s), %d entities' % (k[0], len(v), ', '.join(sorted(shown(x) for x in v)), len(v))
             for k, v in seen.items() if len(v) > 1 and k[0]]
    for i, x in ident.items():
        if x is None:
            v = seen.get((label(N[i]), cls(i), state(i), comp(i)), ())
            # a source or sink has no name: one per compartment
            ident[i] = next(iter(v)) if len(v) == 1 else ('label', '' if cls(i)[0] == 'DEGRADED' else label(N[i]))

    def inner(i):  # the key without the compartment: what a member adds to its complex
        if N[i].kind == 'Complex':
            ms = members.get(i)
            x = ('complex', tuple(sorted(inner(j) for j in ms))) if ms else ('label', label(N[i]))
        else:
            x = ident[i]
        return (x, cls(i), state(i))
    key = {i: (comp(i),) + inner(i) for i in ents}
    first = {}  # glyphs the file draws as one species are one entity, whatever their key
    for i in ents:
        if N[i].species:
            key[i] = first.setdefault(N[i].species, key[i])

    entities, glyph = {}, {}
    for i in ents:
        e = entities.get(key[i])
        if e is None:
            e = entities[key[i]] = Entity(id=i, key=key[i], glyphs=[])
        e.glyphs.append(i)
        d = N[i]
        svs = collections.Counter(state_variables(d))
        e.state_variables = tuple(sorted((collections.Counter(e.state_variables) | svs).elements(), key=lambda s: (s.value, s.variable or '')))
        e.names = e.names | ({label(d)} if label(d) else set())
        e.units = e.units | {unit(u) for u in d.units if not re.fullmatch(r'N:\d+', u)}  # N:x: the count, in the key
        e.annotations = e.annotations | annotations(d.data)
        e.family = e.family or d.data.get('Family')
        e.members = e.members | family_members(d)
        glyph[i] = e.id
    by_id = {e.id: e for e in entities.values()}
    for c, ms in members.items():
        for j in ms:
            by_id[glyph[j]].inside = glyph[c]

    reactions, influences = [], []
    other = lambda a, x: a.target if a.source == x else a.source
    for p, d in N.items():
        if d.kind not in PROCESSES:
            continue
        at = [a for a in m.arcs if p in (a.source, a.target)]
        cons = [glyph[other(a, p)] for a in at if a.head is None and other(a, p) in glyph]
        prod = [glyph[a.target] for a in at if a.source == p and a.head == 'production' and a.target in glyph]
        mods = [(glyph[a.source], a.head, a.dashed) for a in at if a.target == p and a.head in MOD and a.source in glyph]
        # a gate's inputs: the entities joined to it by plain arcs, either way
        gates = [(label(N[a.source]).upper(), [glyph[other(b, a.source)] for b in m.arcs if a.source in (b.source, b.target)
                  and b.head is None and other(b, a.source) in glyph], a.head, a.dashed)
                 for a in at if a.target == p and N[a.source].kind == 'Operator']
        reactions.append(Reaction(id=p, reactants=cons, products=prod, modifiers=mods, gates=gates))
    for a in m.arcs:
        s = N[a.source]
        if a.source in glyph and a.target in glyph and a.head in HEADS:
            influences.append(Influence(id=a.id, sources=[glyph[a.source]], target=glyph[a.target], head=a.head, dashed=a.dashed))
        elif s.kind == 'Operator' and label(s) == EQUIV and a.target in glyph and a.head is None:
            # an equivalence: the members, the generic entity
            ins = [other(b, a.source) for b in m.arcs if a.source in (b.source, b.target) and b is not a]
            influences.append(Influence(id=a.id, sources=[glyph[i] for i in ins if i in glyph], target=glyph[a.target],
                                        head=None, gate=EQUIV))
        elif s.kind == 'Operator' and a.target in glyph and a.head in HEADS:  # a gate on arcs between entities
            ins = [other(b, a.source) for b in m.arcs if a.source in (b.source, b.target) and b.head is None]
            influences.append(Influence(id=a.id, sources=[glyph[i] if i in glyph else (label(N[i]).upper(),) for i in ins],
                                        target=glyph[a.target], head=a.head, gate=label(s).upper(), dashed=a.dashed))
    def around(c):
        q = N[c].parent
        while q is not None and q not in comps:
            q = N[q].parent
        return label(N[q]) if q else None
    return Biology(entities=by_id, reactions=reactions, influences=influences, glyph=glyph, notes=notes,
                   compartments={label(N[c]): around(c) for c in comps})
