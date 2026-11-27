# Which files each input gives, as on the Converter page, for the page, the command line and the
# reference files alike. outputs() lists them; each file is made only when asked (made()).
#   GraphML: CellDesigner in its four layouts (celldesigner.LAYOUTS: straight, straight & bends,
#            advanced, as drawn); SBGN-ML, also for Newt (newt_layout); GraphML (corrected) for a map drawn
#            with other shapes; GraphML (marked) when it breaks a rule (the problems left out)
#   CellDesigner: GraphML, straight and advanced; SBGN-ML, also for Newt
#   SBGN-ML, Newt: GraphML; CellDesigner in its four layouts; each map of a file of several (-map2 ...)
#   CellDesigner, SBGN-ML, Newt: also GraphML (standard sizes) for a map drawn at another scale,
#            or for every map when standard (style.standard)
#   GraphML: GraphML (standard sizes) only when standard
#   GraphML, CellDesigner, SBGN-ML, Newt: SBML with layout (sbml.write: the SBGN-ML's drawing, the map's biology)
#   GraphML, SBGN-ML, Newt, an Activity Flow map: SBML-qual with layout (sbml.write_qual: its Boolean model, drawn)
import contextlib, io
from dataclasses import dataclass
from . import annotation, celldesigner, graphml, report, rules, sbgnml, sbml, style
from .layout import aligned, at_centres

LAYOUTS = ('straight', 'advanced')


@dataclass
class Output:
    ending: str     # after the input's base name: -advanced.xml
    label: str      # the page's button: CellDesigner (advanced)
    make: object    # () -> the file's text, or None when the input gives no such file
    red: bool = False  # the page's red button: the map with its problems marked


def made(o):
    # (text or None, messages): the file and what the converter said making it, or why it failed,
    # each message (kind, text); printed lines first, kind None (v1, run by tools/reference.py
    # whole, prints its messages)
    printed = io.StringIO()
    with report.collect() as said, contextlib.redirect_stdout(printed):
        try:
            text = o.make()
        except (Exception, SystemExit) as e:
            text = None
            said.append(('left out', 'Not converted: %s: %s' % (type(e).__name__, e)))
    return text, [(None, l) for l in printed.getvalue().splitlines()] + said


def standardised(read, program, asked):
    # GraphML (standard sizes), None for a map at the usual scale unless asked; the reader's messages
    # are the plain GraphML's
    with report.collect(), contextlib.redirect_stdout(io.StringIO()):
        m = read()
    t = style.standard(m, program, asked)
    return graphml.write(t) if t else None


def outputs(path, standard=False):
    ext = path.lower().rsplit('.', 1)[-1]
    # SBGN-ML, then for Newt; read() -> the map
    sbgn = lambda read: [Output('.sbgn', 'SBGN-ML', lambda: sbgnml.write(read())),
                         Output('-newt.sbgn', 'SBGN-ML (for Newt)', lambda: sbgnml.write(read(), True))]
    sb = lambda read: Output('.sbml', 'SBML', lambda: sbml.write(read()))
    qual = lambda read: Output('-qual.sbml', 'SBML-qual', lambda: sbml.write_qual(read()))  # None for a PD map
    std = lambda read, program: Output('-standard.graphml', 'GraphML (standard sizes)', lambda: standardised(read, program, standard))
    name = {'straight': 'straight', 'bends': 'straight & bends', 'advanced': 'advanced', 'drawn': 'as drawn'}
    cds = lambda read: [Output('-%s.xml' % l, 'CellDesigner (%s)' % name[l],
                               lambda l=l: (lambda m: celldesigner.write(m, annotation.from_graphml(m), l))(read()))
                        for l in celldesigner.LAYOUTS]
    if ext == 'graphml':
        try:
            with report.collect():
                found = rules.problems(graphml.read(path))
        except Exception:
            return [Output('', '', lambda: rules.problems(graphml.read(path)))]  # made() says why
        read = lambda: rules.clean(graphml.read(path), found)  # a fresh copy for each file

        def marked():
            with report.collect():
                m = graphml.read(path)
            for line in rules.lines(m, found):
                report.say('problem', line)
            return rules.mark(path, found)
        out = cds(read) + sbgn(read) + [sb(read), qual(read)] + \
              [Output('-corrected.graphml', 'GraphML (corrected)', lambda: graphml.corrected(read()))] + \
              ([Output('-standard.graphml', 'GraphML (standard sizes)', lambda: graphml.write(style.standardise(read()), soft=True))] if standard else [])
        return out + ([Output('-marked.graphml', 'GraphML (marked)', marked, red=True)] if found else [])
    if ext == 'xml':
        cd = lambda l: at_centres(aligned(celldesigner.read(path))) if l == 'straight' else aligned(celldesigner.read(path))
        return [Output('-%s.graphml' % l, 'GraphML (%s)' % l, lambda l=l: graphml.write(cd(l))) for l in LAYOUTS] + \
               [std(lambda: celldesigner.read(path), 'CellDesigner')] + \
               sbgn(lambda: cd('advanced')) + [sb(lambda: cd('advanced'))]
    # SBGN-ML: every map of the file, the second and later ones with -map2, -map3 ... before the ending
    try:
        n = len(sbgnml.maps(path))
    except Exception:
        n = 0
    if not n:  # not readable, or no map: made() says why
        return [Output('', '', lambda: sbgnml.read(path))]
    out = []
    for k in range(n):
        r = lambda k=k: sbgnml.read(path, k)
        one = [Output('.graphml', 'GraphML', lambda r=r: graphml.write(r())), std(r, 'Newt')] + cds(r) + [sb(r), qual(r)]
        out += one if not k else [Output('-map%d%s' % (k + 1, o.ending), 'Map %d: %s' % (k + 1, o.label), o.make, o.red) for o in one]
    return out
