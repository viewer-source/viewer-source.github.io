    var PRESET = { 'nucleic acid feature ct:gene': ['nucleic acid feature', ['ct:gene']], 'nucleic acid feature ct:mRNA': ['nucleic acid feature', ['ct:mRNA']] };
    function baseKind(k) { return PRESET[k] ? PRESET[k][0] : k; }
    var PAL_PD = [    
      ['Entity pool nodes', [['macromolecule', 'Macromolecule', '<rect x="1.5" y="5" width="21" height="14" rx="3.5"/>'],
        ['simple chemical', 'Simple chemical', '<circle cx="12" cy="12" r="7"/>'],    
        ['nucleic acid feature ct:gene', 'Nucleic acid feature, ct:gene', '<path d="M1.5 5h21v9.5q0 4.5-4.5 4.5h-12q-4.5 0-4.5-4.5z"/><text x="12" y="13.8" text-anchor="middle" font-size="7">gene</text>'],
        ['nucleic acid feature ct:mRNA', 'Nucleic acid feature, ct:mRNA', '<path d="M1.5 5h21v9.5q0 4.5-4.5 4.5h-12q-4.5 0-4.5-4.5z"/><text x="12" y="13.8" text-anchor="middle" font-size="7">mrna</text>'],
        ['unspecified entity', 'Unspecified entity', '<ellipse cx="12" cy="12" rx="10.5" ry="7"/>'],
        ['complex', 'Complex', '<path d="M6 4h12l4 4v8l-4 4h-12l-4-4v-8z"/>'],
        ['perturbing agent', 'Perturbing agent', '<path d="M1.5 5h21l-3.5 7 3.5 7h-21l3.5-7z"/>'],
        ['source and sink', 'Empty set (source and sink)', '<circle cx="12" cy="12" r="8"/><path d="M4 20l16-16"/>']]],
      ['Process nodes', [['process', 'Process', '<rect x="5" y="5" width="14" height="14"/>'],
        ['omitted process', 'Omitted process', '<rect x="5" y="5" width="14" height="14"/><path d="M9 15l2.5-6M12.5 15l2.5-6" class="in"/>'],
        ['uncertain process', 'Uncertain process', '<rect x="5" y="5" width="14" height="14"/><path d="M9.8 10.2a2.2 2.2 0 1 1 3.2 2c-.7.4-1 .8-1 1.6" class="in"/><circle class="dot" cx="12" cy="16.4" r=".8"/>'],
        ['phenotype', 'Phenotype', '<path d="M6 5h12l4.5 7-4.5 7h-12l-4.5-7z"/>']]],
      ['Other nodes', [['compartment', 'Compartment', '<rect x="1.5" y="3" width="21" height="18" rx="4.5" stroke-width="2.2"/>'],
        ['submap', 'Submap', '<rect x="1.5" y="4" width="21" height="16"/>']]],
      ['Logical operators', [['and', 'AND', '<circle cx="12" cy="12" r="10"/><text x="12" y="14.7" text-anchor="middle" font-size="7.4" letter-spacing="-.1">AND</text>'],
        ['or', 'OR', '<circle cx="12" cy="12" r="10"/><text x="12" y="14.9" text-anchor="middle" font-size="8.2">OR</text>'],
        ['not', 'NOT', '<circle cx="12" cy="12" r="10"/><text x="12" y="14.7" text-anchor="middle" font-size="7.4" letter-spacing="-.1">NOT</text>'],
        ['equivalence', 'Equivalence', '<circle cx="12" cy="12" r="10"/><path d="M7.5 8.8h9M7.5 12h9M7.5 15.2h9" class="in"/>']]],
      ['Connecting arcs', [['consumption', 'Consumption / logic arc', '<path d="M3 12h18"/>'],
        ['production', 'Production', '<path d="M3 12h11"/><path d="M13 7.5l8 4.5-8 4.5z" fill="currentColor"/>'],
        ['modulation', 'Modulation', '<path d="M3 12h10"/><path d="M13 12l4-4 4 4-4 4z"/>'],
        ['stimulation', 'Stimulation', '<path d="M3 12h10"/><path d="M13 7.5l8 4.5-8 4.5z"/>'],
        ['catalysis', 'Catalysis', '<path d="M3 12h12"/><circle cx="18" cy="12" r="3"/>'],
        ['inhibition', 'Inhibition', '<path d="M3 12h17M20 6v12"/>'],
        ['necessary stimulation', 'Necessary stimulation', '<path d="M3 12h7M10 7v10"/><path d="M13 7.5l8 4.5-8 4.5z"/>']]]
    ];
    var PHENO = PAL_PD[1][1].filter(function (q) { return q[0] === 'phenotype'; })[0], OTHER = PAL_PD[2];
    var GATES_PD = PAL_PD[3][1], ARC_PD = {};
    PAL_PD[4][1].forEach(function (q) { ARC_PD[q[0]] = q; });
    var DELAY = ['delay', 'Delay', '<circle cx="12" cy="12" r="10"/><text x="12" y="17" text-anchor="middle" font-size="14" font-family="Times New Roman, serif" fill="currentColor" stroke="none">\u03c4</text>'];
    var INFL = [['stimulation', 'Positive influence'], ['inhibition', 'Negative influence'], ['modulation', 'Unknown influence'], ['necessary stimulation', 'Necessary stimulation']];
    var ACT = ['activity', 'Activity', '<rect x="1.5" y="5" width="21" height="14"/>'];
    var ACT_UNIT = { activity: '' }, ACT_NAME = {};    
    var ACTS = [ACT].concat([['macromolecule', 'Protein activity', '<rect x="10.5" y="2.5" width="10" height="5" rx="1.6"/>', 10.5, 20.5],
      ['simple chemical', 'Metabolite activity', '<circle cx="18" cy="5" r="2.5"/>', 15.5, 20.5],
      ['nucleic acid feature', 'Nucleic acid feature activity', '<path d="M10.5 2.5h10v3.4q0 1.6-1.6 1.6h-6.8q-1.6 0-1.6-1.6z"/>', 10.5, 20.5],
      ['complex', 'Complex activity', '<path d="M12 2.5h7l1.5 1.5v2l-1.5 1.5h-7l-1.5-1.5v-2z"/>', 10.5, 20.5],
      ['unspecified entity', 'Unspecified entity activity', '<ellipse cx="15.5" cy="5" rx="5" ry="2.5"/>', 10.5, 20.5]].map(function (q) {
      var kind = q[1].toLowerCase();
      ACT_UNIT[kind] = q[0]; ACT_NAME[q[0]] = kind;
      return [kind, q[1], '<path d="M' + q[3] + ' 5H1.5v14h21V5H' + q[4] + '"/><g class="in">' + q[2] + '</g>'];
    }));
    var PD_SIGN = {}; PAL_PD[0][1].forEach(function (q) { PD_SIGN[q[0]] = q[2]; });
    PD_SIGN['nucleic acid feature'] = '<path d="M1.5 5h21v9.5q0 4.5-4.5 4.5h-12q-4.5 0-4.5-4.5z"/>';
    var ACTS_CD = ['macromolecule', 'simple chemical', 'nucleic acid feature', 'complex', 'unspecified entity'].map(function (c) {
      var k = ACT_NAME[c]; return [c === 'macromolecule' ? 'activity' : k, ACTS.filter(function (q) { return q[0] === k; })[0][1], PD_SIGN[c]];
    });
    var NAF_ACT = 'nucleic acid feature activity', NAF_CT = [['ct:gene', 'gene'], ['ct:mRNA', 'mrna']];    
    NAF_CT.forEach(function (q) { PRESET[NAF_ACT + ' ' + q[0]] = [NAF_ACT, [q[0]]]; });
    var nafSplit = function (set, sbgnLook) {
      return [].concat.apply([], set.map(function (q) {
        if (q[0] !== NAF_ACT) return [q];
        return NAF_CT.map(function (c) {
          var sign = sbgnLook ? q[2] + '<text x="11" y="15.6" text-anchor="middle" font-size="6.6">' + c[1] + '</text>' : PAL_PD[0][1].filter(function (p) { return p[0] === 'nucleic acid feature ' + c[0]; })[0][2];
          return [NAF_ACT + ' ' + c[0], q[1] + ', ' + c[0], sign];
        });
      }));
    };
    ACTS = nafSplit(ACTS, true); ACTS_CD = nafSplit(ACTS_CD, false);
    var ACT_PROT = ACTS.filter(function (q) { return q[0] === 'protein activity'; })[0];
    var ACT_REST = ACTS.filter(function (q) { return q !== ACT && q !== ACT_PROT; }), ACT_REST_CD = ACTS_CD.filter(function (q) { return q[0] !== 'activity'; });
    var PERT = ['perturbing agent', 'Perturbation', PAL_PD[0][1].filter(function (q) { return q[0] === 'perturbing agent'; })[0][2]];
    var LOGIC = ['logic arc', 'Logic arc', '<path d="M3 12h18"/>'];
    function palAf(sbgnLook, prot) {
      var first = prot ? ACT_PROT : ACT;    
      return [
        ['Activity nodes', [sbgnLook ? first : [first[0], first[1], PD_SIGN.macromolecule]].concat(sbgnLook ? ACT_REST : ACT_REST_CD, [PHENO, PERT])],
        OTHER,
        ['Logical operators', GATES_PD.concat([DELAY])],
        ['Arcs', INFL.map(function (x) { var q = ARC_PD[x[0]]; return [q[0], sbgnLook || x[0] === 'necessary stimulation' ? x[1] : q[1] + ' (' + x[1].toLowerCase() + ')', q[2]]; }).concat([LOGIC])]
      ];
    }
    var PALS = { pd: PAL_PD, rn: palAf(false), sbgn: palAf(true), rnP: palAf(false, true), sbgnP: palAf(true, true) };
    var ARCS = {}, MODK = {};    
    PAL_PD[4][1].forEach(function (q) { ARCS[q[0]] = 1; if (!/^(consumption|production)$/.test(q[0])) MODK[q[0]] = 1; });    
    ARCS['logic arc'] = 1;
    function arcTool() { return tool && ARCS[tool.kind] ? tool.kind : null; }
    var tool = null;    
    var pal = document.createElement('div');
    pal.className = 'm2-ed-palette'; pal.hidden = true; pal.setAttribute('role', 'toolbar'); pal.setAttribute('aria-label', 'Palette');
    var PAL_KEY = 'atlas-edit-palette', palSet = { lang: 'pd', look: 'rn' };
    function palStore() { try { return JSON.parse(localStorage.getItem(PAL_KEY)) || {}; } catch (e) { return {}; } }
    function palId() { return site && (site.id || site.path) || name || null; }    
    function palFor() {    
      var all = palStore(), id = palId(), k = id && all[id];
      if (k && (k.lang === 'pd' || k.lang === 'af')) return { lang: k.lang, look: k.look === 'sbgn' ? 'sbgn' : 'rn', strict: k.strict === true };
      var af = sbJs.isAf(sb && sb.base);
      return { lang: af ? 'af' : 'pd', look: af ? 'sbgn' : 'rn', strict: false };
    }
    function palKeep() { var all = palStore(), id = palId(); if (!id) return; all[id] = palSet; try { localStorage.setItem(PAL_KEY, JSON.stringify(all)); } catch (e) {} }
    function palGrouped() { try { return localStorage.getItem('atlas-edit-palette-groups') === 'on'; } catch (e) { return false; } }
    function palSign(q) {
      return '<button type="button" data-make="' + q[0] + '" title="' + q[1] + (ARCS[q[0]] ? ': drag from one node to another (click: once; double click: several)' : ' (click: once; double click: several)') + '" aria-label="' + q[1] + '" aria-pressed="false">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">' + q[2] + '</svg></button>';
    }
    function palSigns(set) {
      if (!palGrouped()) return '<div class="m2-ed-prow">' + set.map(function (s) { return s[1].map(palSign).join(''); }).join('') + '</div>';
      return set.map(function (s) {
      var info = s[0] === 'Connecting arcs' || s[0] === 'Arcs' ? ' <button type="button" class="m2-ed-pinfo" aria-label="How arcs are drawn" title="How arcs are drawn"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true"><circle cx="8" cy="8" r="7.2" stroke-width="1.1"/><path d="M8 7.3v4.2" stroke-width="1.8" stroke-linecap="round"/><circle cx="8" cy="4.6" r="1.2" fill="currentColor" stroke="none"/></svg></button>' : '';
      return '<p>' + s[0] + info + '</p><div class="m2-ed-prow">' + s[1].map(palSign).join('') + '</div>';
      }).join('');
    }
    function palKind() { return sbKind(); }
    function hybOn() { return palLangNow() === 'pd' && palSet.strict !== true; }
    function palLangNow() { return palSet.lang === 'af' ? 'af' : 'pd'; }
    function palViews() { var k = palKind(); return palLangNow() === 'af' && (k === 'af' || k === 'empty'); }
    function afMap() { return !!sb && palOn() && palLangNow() === 'af'; }
    function afKind() { return !!sb && palKind() === 'af'; }
    function palLookNow() { return palViews() && palSet.look === 'sbgn' ? 'sbgn' : 'rn'; }
    function palBtn(attr, title, sign) { return '<button type="button" ' + attr + ' title="' + title + '" aria-label="' + title + '" aria-pressed="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">' + sign + '</svg></button>'; }
    function palView(look, name, title) { return '<button type="button" role="radio" data-look="' + look + '" title="' + title + '" aria-label="' + title + '" aria-checked="false"><span class="m2-ed-radio" aria-hidden="true"></span>' + name + '</button>'; }
    var INFO = {
      strict: 'Corresponds to CellDesigner\'s Reduced Notation: stimulation, inhibition, necessary stimulation and modulation may also end on entities, which makes a hybrid map. Such links are outside the SBGN Process Description specification, and some tools may not read or save the SBGN-ML file correctly.',
      rn: 'Corresponds to CellDesigner\'s Reduced Notation palette, which enables an Activity Flow type of representation.',
      sbgn: 'Follows the SBGN Activity Flow specification. The map is saved as an Activity Flow SBGN-ML file.',
      prot: 'When ticked, shows the auxiliary unit on protein activities. An activity with no auxiliary unit is by default a protein activity.'
    };
    function palTip(line, name, t) {
      return '<div class="m2-ed-pline">' + line + '<button type="button" class="m2-ed-pinfo m2-ed-ptip" aria-label="About ' + name + '" title="' + t + '" aria-expanded="false"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true"><circle cx="8" cy="8" r="7.2" stroke-width="1.1"/><path d="M8 7.3v4.2" stroke-width="1.8" stroke-linecap="round"/><circle cx="8" cy="4.6" r="1.2" fill="currentColor" stroke="none"/></svg></button></div>' +
        '<div class="m2-ed-ptext" hidden>' + t + '</div>';
    }
    pal.innerHTML = '<div class="m2-ed-prow m2-ed-pnot" role="group" aria-label="Notation">' +
      palBtn('data-lang="pd"', 'Process Description', '<text x="12" y="17.3" text-anchor="middle" font-size="15">PD</text>') +
      palBtn('data-lang="af"', 'Activity Flow', '<text x="12" y="17.3" text-anchor="middle" font-size="15">AF</text>') + '</div>' +
      '<div class="m2-ed-plook" role="radiogroup" aria-label="Activity Flow view">' +
      palTip(palView('rn', 'Reduced notation view', 'Reduced notation view: each activity drawn as its entity'), 'Reduced notation view', INFO.rn) +
      palTip(palView('sbgn', 'SBGN AF view', 'SBGN Activity Flow view: each entity drawn as its SBGN activity'), 'SBGN Activity Flow view', INFO.sbgn) + '</div>' +
      '<div class="m2-ed-pblk m2-ed-pprot">' + palTip('<label class="m2-ed-phyb" title="Ticked: every protein activity carries the auxiliary unit of a macromolecule, drawn and saved in the file; unticked: none has it"><input type="checkbox"><span>Protein auxiliary unit</span></label>', 'Protein auxiliary unit', INFO.prot) + '</div>' +
      '<div class="m2-ed-pblk m2-ed-pstrict">' + palTip('<label class="m2-ed-phyb" title="Ticked (the default): under PD a modulation may also end on an entity, and a logic gate\u2019s output go to one (CellDesigner\u2019s reduced notation); with a process on the map the file stays Process Description, without one such a link makes it Activity Flow. Unticked: Process Description only"><input type="checkbox"><span>Reduced notation</span></label>', 'Reduced notation', INFO.strict) + '</div>' +
      '<div class="m2-ed-psigns"></div>';
    var palSignsEl = pal.querySelector('.m2-ed-psigns'), palShown = null;
    function palKey() { return palLangNow() === 'pd' ? 'pd' : palLookNow() + (protOn ? 'P' : ''); }
    var protOn = false, protMemo = [null, null];
    function protFile() {    
      if (protMemo[0] === text) return protMemo[1];
      var A = sbJs.activities(text, null, true), u = Object.keys(A).map(function (k) { return A[k]; }).filter(function (x) { return x === '' || x === 'macromolecule'; });
      var r = !u.length ? null : u.every(function (x) { return x === 'macromolecule'; }) ? true : u.every(function (x) { return x === ''; }) ? false : null;
      protMemo = [text, r];
      return r;
    }
    function palFill() {    
      var k = palKey();
      var lang = palLangNow(), look = palLookNow();
      Array.prototype.forEach.call(pal.querySelectorAll('[data-lang]'), function (b) { b.setAttribute('aria-pressed', String(b.dataset.lang === lang)); });
      Array.prototype.forEach.call(pal.querySelectorAll('[data-look]'), function (b) { b.setAttribute('aria-checked', String(b.dataset.look === look)); });
      pal.querySelector('.m2-ed-plook').hidden = !palViews();
      var hy = pal.querySelector('.m2-ed-pstrict'), hyc = hy.querySelector('input');
      hy.hidden = lang !== 'pd';
      if (hyc.checked !== hybOn()) hyc.checked = hybOn();    
      var pb = pal.querySelector('.m2-ed-pprot'), pbc = pb.querySelector('input');
      pb.hidden = !palViews();    
      if (!pb.hidden) { var pf = protFile(); if (pf != null) protOn = pf; k = palKey(); }
      if (pbc.checked !== protOn) pbc.checked = protOn;
      if (palShown === k) return;
      palShown = k;
      if (tool && !palOk(tool.kind)) tool = null;    
      palSignsEl.innerHTML = palSigns(PALS[k]);
      var pi = palSignsEl.querySelector('.m2-ed-pinfo');
      if (pi) pi.addEventListener('click', function (e) { e.stopPropagation(); help(true, 'Connecting arcs'); });
    }
    function palLook() {    
      var want = palOn() && palLookNow() === 'sbgn';
      if (want === afSbgn) return;
      afSbgn = want;
      if (on && V.current === map && !cd) render();
    }
    function palPick(lang, look) {
      palSet = { lang: lang || palSet.lang, look: look || palSet.look, strict: palSet.strict };
      if (tool && !palOk(tool.kind)) tool = null;
      palKeep(); palFill(); palShow();    
    }
    function palOk(kind) { return PALS[palKey()].some(function (s) { return s[1].some(function (q) { return q[0] === kind; }); }); }
    pal.addEventListener('click', function (e) {
      var ti = e.target.closest('.m2-ed-ptip');
      if (ti) { var tx = ti.parentNode.nextElementSibling, open = tx.hidden; tx.hidden = !open; ti.setAttribute('aria-expanded', String(open)); ti.blur(); return; }
      var b = e.target.closest('button[data-lang], button[data-look]');
      if (b && !b.disabled) palPick(b.dataset.lang, b.dataset.look);
    });
    pal.querySelector('.m2-ed-pstrict input').addEventListener('change', function (e) { palSet.strict = !e.target.checked; palKeep(); e.target.blur(); });    
    pal.querySelector('.m2-ed-pprot input').addEventListener('change', function (e) {    
      protOn = e.target.checked; e.target.blur();    
      var t2 = palOn() ? sbJs.proteinBoxes(text, protOn) : text;
      if (t2 !== text) { remember(false); text = t2; parse(); dirty = true; render(); changed(); }
      palShow(); paint();
    });
    var palMap = null;
    function palSync() { var id = palId(); if (id !== palMap) { palMap = id; palSet = palFor(); protOn = protFile() === true; palShown = null; palFill(); } }    
    box.querySelector('.m2-ed-tools').insertAdjacentElement('afterend', pal);
    function palOn() { return on && V.current === map && !!sb && !!sbJs && V.level === 'full'; }
    function palShow() {
      var show = palOn();
      if (show) { palSync(); palFill(); }    
      pal.hidden = !show;
      if (!show) tool = null;
      Array.prototype.forEach.call(pal.querySelectorAll('button[data-make]'), function (b) {
        var mine = !!tool && tool.kind === b.dataset.make;
        b.setAttribute('aria-pressed', String(mine));
        b.classList.toggle('m2-ed-sticky', mine && tool.sticky);
      });
      if (!tool && V.view.style.cursor === 'default') V.view.style.cursor = '';
      if (props) propsShow();    
      palLook();
    }
    function palTake(kind, sticky) { tool = kind ? { kind: kind, sticky: !!sticky } : null; palShow(); }
    pal.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-make]');
      if (!b) return;
      palTake(tool && tool.kind === b.dataset.make ? null : b.dataset.make, false);    
    });
    pal.addEventListener('dblclick', function (e) {
      var b = e.target.closest('button[data-make]');
      if (b) palTake(b.dataset.make, true);
    });
    document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('#m2-set-edit')) setTimeout(palShow, 0); }, true);    
    document.getElementById('m2-set-palette').addEventListener('change', function () { setTimeout(function () { palShown = null; palShow(); }, 0); });    
    document.addEventListener('keydown', function (e) { if (tool && e.key === 'Escape') palTake(null); }, true);

    var placeAt = null, placedAt = 0;    
    function palDown(e) {
      if (!tool || arcTool() || !palOn()) return false;    
      placeAt = { x: e.clientX, y: e.clientY, P: at(e) };
      return true;
    }
    function palUp(e) {
      var p = placeAt; placeAt = null;
      if (!p || e.type !== 'pointerup' || Math.hypot(e.clientX - p.x, e.clientY - p.y) >= 5) return false;
      e.stopImmediatePropagation();    
      if (!tool) return true;    
      placedAt = Date.now();
      makeEntity(p.P, tool.kind);
      if (tool && !tool.sticky) palTake(null);
      return true;
    }
    function freeId(base, taken) {    
      var s = src(), i = 1;
      var del = sbJs.gone(text), used = function (q) { return text.indexOf('"' + q + '"') >= 0 || s.indexOf('"' + q + '"') >= 0 || s.indexOf("'" + q + "'") >= 0 || del.indexOf(q) >= 0 || (taken || []).indexOf(q) >= 0; };    
      while (used(base + i)) i++;
      return base + i;
    }
    function innermost(P, test) {    
      var best = -1, area = Infinity;
      nodes2.forEach(function (n, i) {
        var b = boxOf(i);
        if (P[0] < b[0] || P[1] < b[1] || P[0] > b[0] + b[2] || P[1] > b[1] + b[3] || !test(n, i)) return;
        if (b[2] * b[3] < area) { area = b[2] * b[3]; best = i; }
      });
      return best;
    }
    function makeEntity(P, cls) {
      var cx = innermost(P, function (n) { return n.el.getAttribute('yfiles.foldertype') === 'group' && !n.comp; });
      if (cx >= 0) { warn('A new entity goes beside a complex for now, not into it.'); return; }
      var units = PRESET[cls] ? PRESET[cls][1] : null; cls = baseKind(cls);
      var act = ACT_UNIT[cls], D = defOf(cls), w = D.w, h = D.h, X = P[0] - w / 2, Y2 = P[1] - h / 2;    
      if (gridSet.snap) { X += toGrid(X + w / 2, gridSet.step); Y2 += toGrid(Y2 + h / 2, gridSet.step); }    
      var c = innermost(P, function (n) { return n.comp; }), id = freeId('glyph_');
      var t2;
      try { t2 = sbJs.add(text, { id: id, cls: act != null ? sbJs.unitClass(act) : cls, activity: act, label: '', box: [+fmt(X), +fmt(Y2), w, h], parent: c >= 0 ? nodes2[c].id : null, fill: D.fill, line: D.line, width: D.width, multimer: D.multimer, font: D.font, units: units || undefined }); }
      catch (err) { warn('The ' + (act != null ? 'activity' : cls) + ' could not be added: ' + (err && err.message || err) + '.'); return; }
      remember(false); text = t2; made(id);
    }
    function isMade(n) { var K = sbJs && sbJs.MAKE; return !!K && n.shape.kind !== 'Compartment' && Object.keys(K).some(function (c) { return K[c] === n.shape.kind; }) && n.el.getAttribute('yfiles.foldertype') !== 'group'; }
    function emptyComp(n) { return !!n.comp && !nodes2.some(function (m) { return m.up != null && nodes2[m.up] === n; }); }    
    function madeAt(P) { return innermost(P, isMade); }
    function macroAt(P) { var i = madeAt(P); return i >= 0 && nodes2[i].shape.kind === 'Macromolecule' ? i : -1; }
    var ORDER = [[0, 0.5], [0.25, 0.5], [-0.25, 0.5], [0.5, 0], [-0.5, 0], [0.5, 0.5], [-0.5, 0.5], [0.5, -0.5], [-0.5, -0.5],
      [0, -0.5], [0.25, -0.5], [-0.25, -0.5], [0.5, 0.25], [-0.5, 0.25], [0.5, -0.25], [-0.5, -0.25]];
    var PLACES = (function () { var out = [], k; for (k = -4; k <= 4; k++) { out.push([k / 8, -0.5], [k / 8, 0.5]); if (Math.abs(k) < 4) out.push([-0.5, k / 8], [0.5, k / 8]); } return out; })();
    function border(i, P) {    
      var b = boxOf(i), best = null, d0 = Infinity;
      PLACES.forEach(function (q) { var d = Math.hypot(b[0] + (0.5 + q[0]) * b[2] - P[0], b[1] + (0.5 + q[1]) * b[3] - P[1]); if (d < d0) { d0 = d; best = q; } });
      return best.slice();
    }
    window.m2EditNodeItems = function () {
      var P = rclick, k = P && palOn() && !svAt(P) ? madeAt(P) : -1;
      if (k < 0 && P && palOn()) {    
        var h = hit(P), ed = h && h.e != null && h.p == null ? edges2[h.e] : null, now = ed && Object.keys(MODK).filter(function (c) { return sbJs.ARROW[c] === ed.arr[1]; })[0];
        var afN = afMap();    
        if (now) return Object.keys(MODK).filter(function (c) { return c !== now && !(c === 'catalysis' && (afN || roleOf(ed.t) === 'pheno')); }).map(function (c) {
          return ['Make ' + (afN && sbJs.AF_ARC[c] || c), function () {
            var t2 = sbJs.arcKind(text, ed.id, c);
            if (t2 === text) return;
            remember(false); text = t2; parse(); selN = []; selP = []; part = null;
            selE = edges2.map(function (q, j) { return q.id === ed.id ? j : -1; }).filter(function (j) { return j >= 0; });
            dirty = true; render(); paint(); changed();
          }];
        });
      }
      var au = k >= 0 && afMap() ? sbJs.activities(text)[nodes2[k].id] : null;
      if (au == null && k >= 0 && afMap() && palKind() === 'af' && !nodes2[k].kids.length) au = sbJs.unitFor(nodes2[k].shape.kind);    
      if (au === undefined) au = null;
      if (au != null) {
        var aid = nodes2[k].id, setU = function (u) { return function () { var t2 = sbJs.activity(text, aid, u); if (t2 === text) return; remember(false); text = t2; made(aid); }; };
        var ui = svList(k).filter(function (q) { return q[3] === UI; })[0], ut = ui ? ui[0] : '';
        var setT = function (v) { return function () {
          var t2 = ui ? (v === null ? sbJs.unitDelete(text, aid, 0) : sbJs.unitValue(text, aid, 0, v)) : sbJs.unit(text, aid, v);
          if (t2 === text) return; remember(false); text = t2; made(aid);
        }; };
        var typeT = function () {
          if (!ui) { var t2 = sbJs.unit(text, aid, ''); if (t2 === text) return; remember(false); text = t2; made(aid); }
          var j = svList(nodes2.findIndex(function (n) { return n.id === aid; })).map(function (q) { return q[3]; }).indexOf(UI);
          if (j >= 0) typeIn(aid, j, !ui);    
        };
        var texts = [[ut ? 'Edit unit of information text' : 'Add unit of information text', typeT]];
        if (au === 'nucleic acid feature') NAF_CT.forEach(function (c) { if (ut !== c[0]) texts.push(['Unit of information ' + c[0], setT(c[0])]); });
        if (ut) texts.push(['Remove unit of information text', setT(null)]);
        return sbJs.UNITS.filter(function (u) { return u !== au && ACT_NAME[u]; }).map(function (u) { return ['Make ' + ACT_NAME[u], setU(u)]; })
          .concat(au ? [['Remove unit of information', setU('')]] : []).concat(texts);
      }
      var gc = k >= 0 && nodes2[k].shape.kind === 'Operator' ? sbJs.classOf(src(), nodes2[k].id) : '';
      if (/^(and|or|not)$/.test(gc)) {    
        var gid = nodes2[k].id;
        var gins = edges2.filter(function (q) { return q.t === k; }).length;
        return ['and', 'or', 'not'].filter(function (c) { return c !== gc && !(c === 'not' && gins > 1); }).map(function (c) {    
          return ['Make ' + c.toUpperCase(), function () { var t2 = sbJs.kind(text, gid, c); if (t2 === text) return; remember(false); text = t2; made(gid); }];
        });
      }
      if (k >= 0 && !afKind() && nodes2[k].shape.kind === 'NucleicAcidFeature' && /^nucleic acid feature( multimer)?$/.test(sbJs.classOf(src(), nodes2[k].id))) {    
        var nid = nodes2[k].id;
        return [['Add unit of information', function () { makeUnit(nid); }],
                ['Add unit of information ct:mRNA', function () { makeUnit(nid, 'ct:mRNA'); }],
                ['Add unit of information ct:gene', function () { makeUnit(nid, 'ct:gene'); }]];
      }
      var pc = k >= 0 && nodes2[k].shape.kind === 'Process' ? sbJs.classOf(src(), nodes2[k].id) : '';
      if (sbJs.PROCESSES.indexOf(pc) >= 0) {    
        var pid = nodes2[k].id;
        return sbJs.PROCESSES.filter(function (c) { return c !== pc; }).map(function (c) {
          return ['Make ' + c, function () { var t2 = sbJs.kind(text, pid, c); if (t2 === text) return; remember(false); text = t2; made(pid); }];
        });
      }
      var i = P && palOn() && !afKind() && !svAt(P) ? macroAt(P) : -1;    
      if (i < 0 || !/^macromolecule( multimer)?$/.test(sbJs.classOf(src(), nodes2[i].id))) return null;    
      var id = nodes2[i].id, multi = isMulti(i);
      return [['Add state variable', function () { makeState(P); }],
              ['Add unit of information', function () { makeUnit(id); }],
              [multi ? 'Make macromolecule' : 'Make multimer', function () {
                var t2 = sbJs.multimer(text, id, !multi);
                if (t2 === text) return;
                remember(false); text = t2; made(id);
              }]];
    };
    function isMulti(i) {    
      var r = realizerOf(nodes2[i].el), sp = r && Array.prototype.filter.call(r.children, function (c) { return c.localName === 'StyleProperties'; })[0];
      return !!sp && Array.prototype.some.call(sp.children, function (c) { return c.getAttribute('name') === 'com.yworks.sbgn.style.mcount' && c.getAttribute('value') !== '1'; });
    }
    function makeState(P) {    
      var i = macroAt(P);
      if (i < 0) return;
      var b = boxOf(i), have = svList(i), r = ORDER.filter(function (q) {
        return !have.some(function (h) { return Math.hypot(b[0] + (0.5 + q[0]) * b[2] - h[1][0], b[1] + (0.5 + q[1]) * b[3] - h[1][1]) < Math.max(18, h[2][0]); });
      })[0] || ORDER[0];
      var id = nodes2[i].id, j = have.filter(function (h) { return h[3] === SV; }).length;    
      remember(false); text = sbJs.state(text, id, '', r[0], r[1]); made(id);
      selN = []; svSel = { id: id, j: j }; paint();
    }
    function makeUnit(id, value) {    
      var i = nodes2.findIndex(function (n) { return n.id === id; });
      if (i < 0) return;
      var j = svList(i).length;    
      var t2 = sbJs.unit(text, id, value || '');
      if (t2 === text) return;
      remember(false); text = t2; made(id);
      selN = []; svSel = { id: id, j: j }; paint();
    }
    function made(id) {    
      parse(); selN = []; selP = []; selE = []; part = null;
      nodes2.forEach(function (n, i) { if (n.id === id) selN = [i]; });
      dirty = true; quiet(); render(); paint(); changed();
    }
    var SV = 'StateVariable', UI = 'UnitOfInformation';
    function svIcons() {    
      var res = {};
      Array.prototype.forEach.call(doc.getElementsByTagNameNS(Y, 'Resource'), function (q) {
        var gn = q.getElementsByTagNameNS(Y, 'GenericNode')[0], l = gn && gn.getElementsByTagNameNS(Y, 'NodeLabel')[0], m = gn && /(StateVariable|UnitOfInformation)$/.exec(gn.getAttribute('configuration') || '');
        if (m) res[q.getAttribute('id')] = [m[1], l ? ownText(l) : ''];
      });
      return res;
    }
    function ownText(l) { var t = ''; for (var c = l.firstChild; c; c = c.nextSibling) if (c.nodeType === 3 || c.nodeType === 4) t += c.nodeValue; return t; }
    function svList(i, res) {    
      var r = realizerOf(nodes2[i].el), b = boxOf(i), out = [], n = {};
      res = res || svIcons();
      if (r) Array.prototype.forEach.call(r.children, function (l) {
        var q = l.localName === 'NodeLabel' && res[l.getAttribute('iconData')];
        if (!q) return;
        n[q[0]] = (n[q[0]] || 0) + 1;
        out.push([q[1], [b[0] + num(l, 'x') + num(l, 'width') / 2, b[1] + num(l, 'y') + num(l, 'height') / 2], [num(l, 'width'), num(l, 'height')], q[0], n[q[0]] - 1]);
      });
      return out;
    }
    function nameOf(i) {
      var r = realizerOf(nodes2[i].el), l = r && Array.prototype.filter.call(r.children, function (c) { return c.localName === 'NodeLabel' && !c.getAttribute('iconData'); })[0];
      return l ? ownText(l) : '';
    }
    var typing = null;
    function typeIn(id, j, fresh) {    
      if (typing) typing.done(true);
      var i = nodes2.findIndex(function (n) { return n.id === id; });
      if (i < 0) return;
      var b = boxOf(i), sv = j == null ? null : svList(i)[j];
      if (j != null && !sv) return;
      var unit = !!sv && sv[3] === UI;
      selN = []; selP = []; selE = []; part = null; svSel = null; paint();    
      var r = realizerOf(nodes2[i].el), fl = r && Array.prototype.filter.call(r.children, function (c) { return c.localName === 'Fill'; })[0];
      var lab = !sv ? r && Array.prototype.filter.call(r.children, function (c) { return c.localName === 'NodeLabel' && !c.getAttribute('iconData'); })[0] : null;
      var fs = lab ? num(lab, 'fontSize') || 12 : 10, inset = 2;
      var at0 = !sv ? [b[0] + inset, b[1] + inset, b[2] - 2 * inset, nodes2[i].comp ? Math.min(b[3] - 2 * inset, fs * 1.6) : b[3] - 2 * inset] : [sv[1][0] - sv[2][0] / 2 + 1, sv[1][1] - sv[2][1] / 2 + 1, sv[2][0] - 2, sv[2][1] - 2];
      var au0 = unit && afSbgn ? sbJs.activities(text)[id] : null;    
      if (au0 != null) { var B0 = sbJs.afUnitBox(b, au0, sv[0] || 'x'); at0 = [B0[0] + 1, B0[1] + 1, B0[2] - 2, B0[3] - 2]; }
      var inp = document.createElement('input'), before = !sv ? nameOf(i) : sv[0], m0 = map;
      inp.type = 'text'; inp.className = 'm2-ed-type'; inp.value = before; inp.spellcheck = false;
      inp.setAttribute('aria-label', !sv ? 'Name' : unit ? 'Unit of information' : 'State variable (value, or value@site)');
      var hid = au0 != null ? Array.prototype.slice.call(gN && gN[id] ? gN[id].querySelectorAll('text.m2-af-ut') : []) : textsOf(i, j);
      hid.forEach(function (el) { el.style.visibility = 'hidden'; });
      inp.style.background = gN && gN[nodes2[i].id] ? 'transparent' : !sv && fl && fl.getAttribute('hasColor') !== 'false' && fl.getAttribute('color') ? fl.getAttribute('color').slice(0, 7) : '#fff';
      inp.style.color = lab && lab.getAttribute('textColor') || '#000';
      var place = function () {    
        var st = inp.style;
        if (unit) {    
          var cx = at0[0] + at0[2] / 2, uw = Math.max(at0[2], Math.ceil(inp.value.length * 5.4 + 8) + 4);
          at0[0] = cx - uw / 2; at0[2] = uw;
        }
        st.left = sx(at0[0]) + 'px'; st.top = sy(at0[1]) + 'px'; st.width = at0[2] * V.z + 'px'; st.height = at0[3] * V.z + 'px'; st.fontSize = fs * V.z + 'px';
        if (sv && !unit) st.borderRadius = at0[3] * V.z / 2 + 'px';
      };
      if (unit) inp.addEventListener('input', place);
      place();
      V.view.appendChild(inp);
      typing = {
        done: function (keep) {
          if (!typing || typing.inp !== inp) return;
          typing = null; inp.remove(); hid.forEach(function (el) { el.style.visibility = ''; });
          var v = inp.value.replace(/[\r\n]+/g, ' ');
          if (sv && !unit) v = v.replace(/@+$/, '');    
          if (unit) v = v.trim();    
          if (fresh && (!keep || !v) && on && map === m0) { var t0 = undo.length ? unpush() : text; if (t0 !== text) { text = t0; parse(); dirty = true; quiet(); render(); paint(); changed(); } return; }
          if (!keep || v === before.replace(/[\r\n]+/g, ' ') || !on || map !== m0 ) return;    
          var t2 = !sv ? sbJs.label(text, id, v) : unit ? sbJs.unitValue(text, id, sv[4], v) : sbJs.stateValue(text, id, sv[4], v);
          if (t2 === text) return;
          if (!fresh) remember(false);    
          text = t2; parse(); dirty = true; quiet(); render(); paint(); changed();
        }, inp: inp, place: place
      };
      inp.addEventListener('keydown', function (e) {
        e.stopPropagation();
        if (e.key === 'Enter') { e.preventDefault(); typing && typing.done(true); V.view.focus({ preventScroll: true }); }
        else if (e.key === 'Escape') { e.preventDefault(); typing && typing.done(false); V.view.focus({ preventScroll: true }); }
      });
      inp.addEventListener('blur', function () { if (typing && typing.inp === inp) typing.done(true); });
      inp.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
      setTimeout(function () { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }, 0);    
    }
    V.view.addEventListener('dblclick', function (e) {
      if (!palOn() || !editing(e)) return;
      if (tool || Date.now() - placedAt < 600) { e.stopImmediatePropagation(); return; }    
      var base = src(), P = at(e), q = svAt(P), i = innermost(P, function (n, k) {    
        return (n.el.getAttribute('yfiles.foldertype') !== 'group' || (n.comp && P[1] - boxOf(k)[1] <= 24)) && sbJs.nameable(base, n.id);
      });
      if (q) { e.stopImmediatePropagation(); typeIn(nodes2[q[0]].id, q[1]); return; }
      if (i >= 0) { e.stopImmediatePropagation(); typeIn(nodes2[i].id, null); }
    }, true);
    function svAt(P) {    
      if (afSbgn || afKind()) return null;    
      var res = svIcons(), found = null, pad = 3 / V.z, acts = sb && palKind() === 'hybrid' ? sbJs.activities(text) : null;    
      nodes2.forEach(function (n, k) {
        if (n.shape.kind !== 'Macromolecule' && n.shape.kind !== 'NucleicAcidFeature' || (acts && acts[n.id] != null)) return;
        svList(k, res).forEach(function (q, j) { if (Math.abs(P[0] - q[1][0]) <= q[2][0] / 2 + pad && Math.abs(P[1] - q[1][1]) <= q[2][1] / 2 + pad) found = [k, j]; });
      });
      return found;
    }

    var svSel = null, svDrag = null, svKey = null;    
    function svNode() { if (!svSel) return -1; var i = nodes2.findIndex(function (n) { return n.id === svSel.id; }); return i >= 0 && svList(i)[svSel.j] ? i : -1; }
    function svMarks(over) {    
      if (typing) typing.place();    
      var i = svNode();
      if (i < 0 || !palOn()) { svSel = null; return; }
      var q = svList(i)[svSel.j], c = svDrag && svDrag.to ? svDrag.to : svKey ? svKey.to : q[1], hs = Math.max(2, HANDLE * V.z);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (d) {
        over.push('<rect class="m2-ed-handle" x="' + f1(sx(c[0] + d[0] * q[2][0] / 2) - hs / 2) + '" y="' + f1(sy(c[1] + d[1] * q[2][1] / 2) - hs / 2) + '" width="' + f1(hs) + '" height="' + f1(hs) + '"/>');
      });
    }
    function svDown(e, P, h) {
      var q = palOn() && !tool ? svAt(P) : null;
      if (!q || e.shiftKey || (h && h.p != null)) { if (svSel) { svSel = null; paint(); } return false; }    
      e.stopImmediatePropagation();
      V.view.focus({ preventScroll: true });
      var again = !!svSel && svSel.id === nodes2[q[0]].id && svSel.j === q[1];
      selN = []; selP = []; selE = []; part = null;
      svSel = { id: nodes2[q[0]].id, j: q[1] };
      svDrag = { i: q[0], again: again, x: e.clientX, y: e.clientY, to: null, r: null, fixed: svList(q[0])[q[1]][3] === UI };    
      paint();
      return true;
    }
    function textsOf(i, j) {    
      var g = gN && gN[nodes2[i].id];
      if (!g) return [];
      var svs = svList(i), r = V.view.getBoundingClientRect(), k = V.pz();
      var rect = function (q) { var L = r.left + sx(q[1][0] - q[2][0] / 2) * k, T = r.top + sy(q[1][1] - q[2][1] / 2) * k; return [L - 1.5, T - 1.5, L + q[2][0] * V.z * k + 1.5, T + q[2][1] * V.z * k + 1.5]; };
      var inside = function (b, R) { var cx = b.left + b.width / 2, cy = b.top + b.height / 2; return cx >= R[0] && cx <= R[2] && cy >= R[1] && cy <= R[3]; };
      return Array.prototype.filter.call(g.querySelectorAll('text:not(.m2-af-ut)'), function (t) {    
        var b = t.getBoundingClientRect();
        return j == null ? !svs.some(function (q) { return inside(b, rect(q)); }) : inside(b, rect(svs[j]));
      });
    }
    function svParts(i, q) {    
      var g = gN && gN[nodes2[i].id];
      if (!g) return [];
      var first = g.firstElementChild && g.firstElementChild.localName === 'a' ? g.firstElementChild : g, r = V.view.getBoundingClientRect(), k = V.pz();
      var L = r.left + sx(q[1][0] - q[2][0] / 2) * k - 1.5, T = r.top + sy(q[1][1] - q[2][1] / 2) * k - 1.5, R = L + q[2][0] * V.z * k + 3, B = T + q[2][1] * V.z * k + 3;
      return Array.prototype.filter.call(first.children, function (el) {
        var b = el.getBoundingClientRect(), cx = b.left + b.width / 2, cy = b.top + b.height / 2;
        return b.width + b.height > 0 && cx >= L && cx <= R && cy >= T && cy <= B && b.left >= L - 2 && b.right <= R + 2 && b.top >= T - 2 && b.bottom <= B + 2;
      });
    }
    window.addEventListener('pointermove', function (e) {
      if (!svDrag || !svSel) return;
      if (!e.buttons) { svUp(); return; }    
      if (!svDrag.to && Math.hypot(e.clientX - svDrag.x, e.clientY - svDrag.y) < 4) return;
      if (svDrag.fixed) { svDrag.moved = true; return; }    
      var i = svDrag.i, b = boxOf(i), r = border(i, at(e)), q = svList(i)[svSel.j];
      if (!svDrag.parts) svDrag.parts = svParts(i, q);    
      svDrag.r = r; svDrag.to = [b[0] + (0.5 + r[0]) * b[2], b[1] + (0.5 + r[1]) * b[3]];
      var dx = svDrag.to[0] - q[1][0], dy = svDrag.to[1] - q[1][1];
      svDrag.parts.forEach(function (el) { if (dx || dy) el.setAttribute('transform', 'translate(' + f1(dx) + ' ' + f1(dy) + ')'); else el.removeAttribute('transform'); });
      paint();
    }, true);
    window.addEventListener('pointerup', svUp, true);    
    function svUp() {
      var d = svDrag; svDrag = null;
      if (!d) return;
      if (d.r && svSel) { remember(false); text = sbJs.stateMove(text, svSel.id, svList(d.i)[svSel.j][4], d.r[0], d.r[1]); parse(); dirty = true; render(); paint(); changed(); }
      else if (d.again && !d.moved && svSel) typeIn(svSel.id, svSel.j);    
    }
    function svDelete() {
      var i = svNode();
      if (i < 0) return false;
      var q = svList(i)[svSel.j];
      remember(false); text = (q[3] === UI ? sbJs.unitDelete : sbJs.stateDelete)(text, svSel.id, q[4], { sbgn: sb.base }); svSel = null;
      parse(); dirty = true; render(); paint(); changed();
      return true;
    }
    function nodesDelete(list) {    
      var ids = list.filter(function (i) { return isMade(nodes2[i]) || emptyComp(nodes2[i]); }).map(function (i) { return nodes2[i].id; });
      if (!ids.length) return false;
      remember(false); text = sbJs.remove(text, ids); selN = []; selP = []; selE = []; part = null;
      parse(); dirty = true; render(); paint(); changed();
      return true;
    }
    var KEYS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    function perim(b) { return 2 * (b[2] + b[3]); }
    function toT(b, r) {    
      var w = b[2], h = b[3], dt = Math.abs(r[1] + 0.5) * h, dr = Math.abs(r[0] - 0.5) * w, db = Math.abs(r[1] - 0.5) * h, dl = Math.abs(r[0] + 0.5) * w, m = Math.min(dt, dr, db, dl);
      if (m === dt) return (r[0] + 0.5) * w;
      if (m === dr) return w + (r[1] + 0.5) * h;
      if (m === db) return w + h + (0.5 - r[0]) * w;
      return 2 * w + h + (0.5 - r[1]) * h;
    }
    function fromT(b, t) {
      var w = b[2], h = b[3], P = perim(b); t = ((t % P) + P) % P;
      if (t < w) return [t / w - 0.5, -0.5];
      if (t < w + h) return [0.5, (t - w) / h - 0.5];
      if (t < 2 * w + h) return [0.5 - (t - w - h) / w, 0.5];
      return [-0.5, 0.5 - (t - 2 * w - h) / h];
    }
    function keyDir(b, t, d) {    
      var w = b[2], h = b[3], P = perim(b), sideOf = function (u) { u = ((u % P) + P) % P; return u < w ? 0 : u < w + h ? 1 : u < 2 * w + h ? 2 : 3; };
      var TAN = [[1, 0], [0, 1], [-1, 0], [0, -1]], OUT = [[0, -1], [1, 0], [0, 1], [-1, 0]];
      var sides = [sideOf(t), sideOf(t - 0.5), sideOf(t + 0.5)];    
      for (var k = 0; k < sides.length; k++) { var a = d[0] * TAN[sides[k]][0] + d[1] * TAN[sides[k]][1]; if (a) return Math.sign(a); }
      return d[0] * OUT[sides[0]][0] + d[1] * OUT[sides[0]][1] > 0 ? -1 : 1;    
    }
    document.addEventListener('keydown', function (e) {
      var d = KEYS[e.key];
      if (!d || !svSel || !palOn() || e.ctrlKey || e.metaKey || e.altKey || /input|textarea|select/i.test(document.activeElement.tagName)) return;
      var i = svNode();
      if (i < 0 || svList(i)[svSel.j][3] === UI) return;    
      e.preventDefault(); e.stopImmediatePropagation();
      var b = boxOf(i), q = svList(i)[svSel.j];
      if (!svKey) svKey = { i: i, t: toT(b, [(q[1][0] - b[0]) / b[2] - 0.5, (q[1][1] - b[1]) / b[3] - 0.5]), c0: q[1], parts: svParts(i, q) };
      if (!e.repeat || svKey.key !== e.key) { svKey.key = e.key; svKey.dir = keyDir(b, ((svKey.t % perim(b)) + perim(b)) % perim(b), d); }
      svKey.t += svKey.dir * (e.shiftKey ? 10 : 1);
      var r = fromT(b, svKey.t);
      svKey.r = [Math.round(r[0] * 10000) / 10000, Math.round(r[1] * 10000) / 10000];
      svKey.to = [b[0] + (0.5 + svKey.r[0]) * b[2], b[1] + (0.5 + svKey.r[1]) * b[3]];
      var dx = svKey.to[0] - svKey.c0[0], dy = svKey.to[1] - svKey.c0[1];
      svKey.parts.forEach(function (el) { el.setAttribute('transform', 'translate(' + f1(dx) + ' ' + f1(dy) + ')'); });
      paint();
    }, true);
    document.addEventListener('keyup', function (e) {
      if (!KEYS[e.key] || !svKey) return;
      var k = svKey; svKey = null;
      if (!k.r || !svSel) return;
      remember(false); text = sbJs.stateMove(text, svSel.id, svList(k.i)[svSel.j][4], k.r[0], k.r[1]); parse(); dirty = true; render(); paint(); changed();
    }, true);
    document.addEventListener('keydown', function (e) {    
      if (svSel && (e.key === 'Escape' || ((e.ctrlKey || e.metaKey) && /^[zya]$/i.test(e.key)))) { svSel = null; paint(); }
    }, true);
    document.addEventListener('keydown', function (e) {
      if ((e.key !== 'Delete' && e.key !== 'Backspace') || !palOn() || /input|textarea|select/i.test(document.activeElement.tagName)) return;
      if (svDelete() || (selN.length && !selP.length && nodesDelete(selN)) || (selE.length && !selN.length && !selP.length && arcsDelete(selE))) { e.preventDefault(); e.stopImmediatePropagation(); }
    }, true);
    window.m2EditDelete = function () {    
      if (!palOn() || !rclick) return null;
      var q = svAt(rclick);
      if (q) return function () { svSel = { id: nodes2[q[0]].id, j: q[1] }; svDelete(); };
      var i = madeAt(rclick);
      if (i < 0) i = innermost(rclick, emptyComp);
      if (i >= 0) return function () { nodesDelete(selN.indexOf(i) >= 0 ? selN : [i]); };
      var h = hit(rclick);    
      if (!h || h.e == null || h.p != null) return null;
      return function () { arcsDelete(selE.indexOf(h.e) >= 0 && !selN.length && !selP.length ? selE : [h.e]); };
    };
    function arcsDelete(list) {    
      var ids = list.map(function (k) { return edges2[k] && edges2[k].id; }).filter(Boolean);
      if (!ids.length) return false;
      var t2 = sbJs.arcRemove(text, ids);
      if (t2 === text) return false;
      remember(false); text = t2; selN = []; selP = []; selE = []; part = null;
      parse(); dirty = true; render(); paint(); changed();
      return true;
    }

    var palDrag = null;
    var GHOST = { submap: 'rectangle', compartment: 'roundrectangle', process: 'rectangle', 'omitted process': 'rectangle', 'uncertain process': 'rectangle' };    
    pal.addEventListener('pointerdown', function (e) {
      var b = e.target.closest('button[data-make]');
      if (b && e.button === 0 && !ARCS[b.dataset.make]) palDrag = { kind: b.dataset.make, x: e.clientX, y: e.clientY, img: null };
    });
    function palOver(e) { var r = V.view.getBoundingClientRect(); return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom; }
    window.addEventListener('pointermove', function (e) {
      if (!palDrag) return;
      if (!e.buttons) { if (palDrag.img) palDrag.img.remove(); palDrag = null; return; }    
      if (!palDrag.moved && Math.hypot(e.clientX - palDrag.x, e.clientY - palDrag.y) < 5) return;
      palDrag.moved = true;
      if (!palOn()) { if (palDrag.img) palDrag.img.hidden = true; return; }
      if (!palDrag.img) {    
        var D = defOf(palDrag.kind);
        palDrag.img = document.createElement('div'); palDrag.img.className = 'm2-ed-palghost';
        palDrag.img.style.cssText = 'width:' + D.w * V.z + 'px;height:' + D.h * V.z + 'px';
        var w = D.w, h = D.h, cmp = palDrag.kind === 'compartment', au = ACT_UNIT[baseKind(palDrag.kind)], act = afSbgn && au != null, sh = act ? { kind: 'Macromolecule', props: { radius: '0' } } : { kind: GHOST[palDrag.kind] || sbJs.MAKE[au != null ? sbJs.unitClass(au) : baseKind(palDrag.kind)], props: { radius: '10', radiusX: '12', radiusY: '12' } };    
        var ink = '" fill="' + (D.fill || (cmp ? 'none' : '#fff')) + '" stroke="' + (D.line || '#000') + '" stroke-width="' + (D.width || (cmp ? 2 : 1)) + '"/>';
        palDrag.img.innerHTML = '<svg width="100%" height="100%" viewBox="0 0 ' + w + ' ' + h + '" overflow="visible"><path d="' + outlineD(sh, 0, 0, w, h) + ink +
          (palDrag.kind === 'source and sink' ? '<path d="M0 ' + h + 'L' + w + ' 0' + ink : '') +
          (sbJs.SIGN[palDrag.kind] ? '<text x="' + w / 2 + '" y="' + h * 0.75 + '" text-anchor="middle" font-family="Dialog, Arial, sans-serif" font-size="' + h * 0.75 + '">' + sbJs.SIGN[palDrag.kind] + '</text>' : '') +
          (sbJs.GATE[palDrag.kind] ? '<text x="' + w / 2 + '" y="' + (h / 2 + 4.5) + '" text-anchor="middle" font-family="Dialog, Arial, sans-serif" font-size="12">' + sbJs.GATE[palDrag.kind] + '</text>' : '') + '</svg>';    
        V.view.appendChild(palDrag.img);
      }
      var r = V.view.getBoundingClientRect(), g = palDrag.img;
      g.hidden = false;
      g.style.left = (e.clientX - r.left) / V.pz() - g.offsetWidth / 2 + 'px'; g.style.top = (e.clientY - r.top) / V.pz() - g.offsetHeight / 2 + 'px';
    }, true);
    window.addEventListener('pointerup', function (e) {
      var d = palDrag; palDrag = null;
      if (!d || !d.moved) return;
      if (d.img) d.img.remove();
      if (!palOver(e) || !palOn()) return;
      placedAt = Date.now();
      makeEntity(at(e), d.kind);
    }, true);

    var link = null;    
    function linkEnd(P, not) {    
      var R = 4 / V.z, best = -1, ba = Infinity;
      nodes2.forEach(function (n, i) {
        var b = boxOf(i), r = roleOf(i);
        if (i === not || !r || P[0] < b[0] - R || P[0] > b[0] + b[2] + R || P[1] < b[1] - R || P[1] > b[1] + b[3] + R) return;
        if (b[2] * b[3] < ba) { ba = b[2] * b[3]; best = i; }
      });
      return best;
    }
    var downs = new Set();    
    window.addEventListener('pointerdown', function (e) { downs.add(e.pointerId); }, true);    
    ['pointerup', 'pointercancel'].forEach(function (k) { window.addEventListener(k, function (e) { downs.delete(e.pointerId); }, true); });
    function linkDown(e, P, h) {    
      if (!palOn() || e.shiftKey || downs.size > 1 || link) return false;
      var i = linkEnd(P, -1);
      if (i < 0 || (!arcTool() && selN.indexOf(i) >= 0)) return false;    
      e.stopImmediatePropagation(); e.preventDefault();
      V.view.setPointerCapture(e.pointerId); V.view.focus({ preventScroll: true });
      link = { from: i, pid: e.pointerId, x: e.clientX, y: e.clientY, moved: false, to: -1, P: P, how: null, at: text };
      tap = { h: h, shift: false, x: e.clientX, y: e.clientY };    
      return true;
    }
    function linkHow(a, b, P) {
      if (b < 0) return null;
      var ra = roleOf(a), rb = roleOf(b), want = arcTool(), eqA = !!nodes2[a].eq, eqB = !!nodes2[b].eq;
      var has = function (s, t, head) { return edges2.some(function (q) { return q.s === s && q.t === t && q.arr[1] === head; }); };
      var ok = function (cls) { return has(a, b, sbJs.ARROW[cls]) ? { no: 'This ' + cls + ' is there already.' } : { cls: cls }; };
      var outs = function (g) { return edges2.filter(function (q) { return q.s === g; }).length; }, ins = function (g) { return edges2.filter(function (q) { return q.t === g; }).length; };
      if (ra === 'pheno') return { no: 'Nothing leaves a phenotype: it is modulated by an entity or a logic gate.' };
      if (ra === 'gate' && outs(a)) return { no: 'A logic gate has one line out, and this one has it.' };    
      var word = function (i) { var l = nodes2[i].el.getElementsByTagNameNS(Y, 'NodeLabel')[0]; return l ? l.textContent.trim() : ''; };    
      if (rb === 'gate' && (word(b) === '\u03c4' || word(b).toUpperCase() === 'NOT') && ins(b)) return { no: 'A ' + (word(b) === '\u03c4' ? 'delay' : 'NOT gate') + ' has one input, and this one has it.' };
      var af = palLangNow() === 'af';    
      if (af) {
        if (ra === 'epn' && rb === 'epn') return want && !MODK[want] ? { no: 'Activity Flow joins activities by an influence.' } : ok(want || 'stimulation');
        if (ra === 'gate' && !eqA && rb === 'epn') return want && !MODK[want] ? { no: 'A logic gate\u2019s output is an influence.' } : ok(want || 'stimulation');
      } else if (hybOn()) {    
        if (ra === 'epn' && rb === 'epn' && want && MODK[want]) return want === 'catalysis' ? { no: 'A catalysis ends on a process.' } : ok(want);
        if (ra === 'gate' && !eqA && rb === 'epn' && (!want || MODK[want])) return want === 'catalysis' ? { no: 'A catalysis ends on a process.' } : ok(want || 'stimulation');
      }
      if (want === 'logic arc' && rb !== 'gate' && !(eqA && rb === 'epn')) return { no: 'A logic arc goes into a logic gate.' };
      if (want === 'catalysis' && rb === 'pheno') return { no: 'A catalysis ends on a process; a phenotype takes a stimulation, inhibition or modulation.' };    
      if (want && MODK[want]) {    
        if ((ra === 'epn' || (ra === 'gate' && !eqA)) && (rb === 'proc' || rb === 'pheno')) return ok(want);
        return { no: 'A ' + want + ' goes from an entity or a logic gate to a process or a phenotype' + ((ra === 'epn' || ra === 'gate') && rb === 'epn' && palLangNow() === 'pd' && !hybOn() ? ' (Reduced notation is unticked in the palette).' : '.') };
      }
      if (rb === 'gate') {    
        if (want === 'production') return { no: 'A production goes from a process to an entity.' };
        if (ra === 'proc') return { no: 'A process does not go into a logic gate: the gate’s output goes to the process.' };
        if (ra === 'gate' && (eqA || eqB)) return { no: 'An equivalence joins entities only.' };
        return ok('logic arc');
      }
      if (ra === 'gate') {    
        if (want === 'logic arc' && eqA) return rb === 'epn' ? ok('logic arc') : { no: 'An equivalence\u2019s line goes to an entity.' };
        if (want) return { no: 'A ' + want + ' does not leave a logic gate: its output is a modulation (a stimulation, unless another is picked).' };
        if (eqA) return rb === 'epn' ? ok('logic arc') : { no: 'An equivalence’s line goes to an entity.' };
        return rb === 'epn' ? { no: 'A logic gate’s output goes to a process, a phenotype or another gate (Reduced notation is unticked in the palette).' } : ok('stimulation');
      }
      if (rb === 'pheno') {
        if (ra !== 'epn' || want) return { no: 'A phenotype is modulated by an entity or a logic gate (a stimulation, unless another modulation is picked).' };
        return ok('stimulation');
      }
      if (ra === 'proc' && rb === 'proc') return { no: 'An arc goes from an entity into a process (a consumption) or from a process to an entity (a production), not between two processes.' };
      if (ra === 'epn' && rb === 'epn') return !want || want === 'consumption' || want === 'production' ? { pair: true } : { no: 'A ' + want + ' does not join two entities. A process is made between them with no sign, Consumption or Production picked.' };
      var cls = ra === 'epn' ? 'consumption' : 'production';
      if (want && want !== cls) return { no: want === 'consumption' ? 'A consumption goes from an entity into a process.' : 'A production goes from a process to an entity.' };
      if (!want && cls === 'consumption' && P && offAxis(b, P)) {    
        var n = nodes2[a], sub = edges2.some(function (q) { return q.t === b && q.arr[1] === 'none' && nodes2[q.s].shape.kind === 'SimpleChemical'; });
        return ok(sub && (/^(Macromolecule|Complex)$/.test(n.shape.kind) || n.kids.length > 0) ? 'catalysis' : 'stimulation');
      }
      if (has(a, b, cls === 'production' ? 'delta' : 'none')) return { no: 'This ' + cls + ' is there already.' };
      return { cls: cls };
    }
    function offAxis(i, P) {    
      var id = nodes2[i].id, H = window.yrender && hubPorts()[id], b = bx(i), c = [b[0] + b[2] / 2, b[1] + b[3] / 2];
      if (!H || !H[0] || !edges2.some(function (q) { return (q.t === i && q.arr[1] === 'none') || (q.s === i && q.arr[1] === 'delta'); })) return false;
      var hz = Math.abs(H[0][0] - c[0]) >= Math.abs(H[0][1] - c[1]), dx = Math.abs(P[0] - c[0]), dy = Math.abs(P[1] - c[1]);
      return hz ? dy > dx : dx > dy;
    }
    function linkMove(e) {    
      if (!link || e.pointerId !== link.pid) return false;
      e.stopImmediatePropagation();
      if ((e.pointerType === 'mouse' && !e.buttons) || link.at !== text) { link = null; tap = null; paint(); return true; }    
      if (!link.moved && Math.hypot(e.clientX - link.x, e.clientY - link.y) < 5) return true;
      link.moved = true; tap = null;
      link.P = at(e); link.to = linkEnd(link.P, link.from); link.how = linkHow(link.from, link.to, link.P);
      paint();
      return true;
    }
    function linkUp(e) {    
      if (!link || e.pointerId !== link.pid) return false;
      var l = link; link = null;
      if (!l.moved) return false;
      e.stopImmediatePropagation(); paint();
      if (e.type !== 'pointerup' || !l.how || l.at !== text) return true;
      if (l.how.no) { warn(l.how.no); return true; }
      linkMake(l.from, l.to, l.how);
      if (tool && !tool.sticky) palTake(null);
      return true;
    }
    function linkMake(a, b, how) {
      var ia = nodes2[a].id, ib = nodes2[b].id, t2 = text, ids = [], o = { sbgn: src() };
      try {
        if (how.cls) { ids.push(freeId('arc_')); t2 = sbJs.connect(t2, ids[0], ia, ib, how.cls, o); }
        else {    
          var A = bx(a), B = bx(b), M = [(A[0] + A[2] / 2 + B[0] + B[2] / 2) / 2, (A[1] + A[3] / 2 + B[1] + B[3] / 2) / 2], D = defOf('process');
          var X = M[0] - D.w / 2, Y2 = M[1] - D.h / 2;
          if (gridSet.snap) { X += toGrid(X + D.w / 2, gridSet.step); Y2 += toGrid(Y2 + D.h / 2, gridSet.step); }
          var c = innermost(M, function (n) { return n.comp; }), pid = freeId('glyph_');
          t2 = sbJs.add(t2, { id: pid, cls: 'process', label: '', box: [+fmt(X), +fmt(Y2), D.w, D.h], parent: c >= 0 ? nodes2[c].id : null });
          ids.push(freeId('arc_')); ids.push(freeId('arc_', ids));
          t2 = sbJs.connect(t2, ids[0], ia, pid, 'consumption', o);
          t2 = sbJs.connect(t2, ids[1], pid, ib, 'production', o);
        }
      } catch (err) { warn('The arc could not be made: ' + (err && err.message || err) + '.'); return; }
      if (t2 === text) return;
      remember(false); text = t2;
      parse(); selN = []; selP = []; part = null;
      selE = edges2.map(function (q, k) { return ids.indexOf(q.id) >= 0 ? k : -1; }).filter(function (k) { return k >= 0; });    
      dirty = true; quiet(); render(); paint(); changed();
    }
    function linkPaint(out) {    
      if (!link || !link.moved || link.at !== text) return;
      var A = bx(link.from), C = [A[0] + A[2] / 2, A[1] + A[3] / 2], no = !!(link.how && link.how.no);
      if (link.how && !no) out.push('<g transform="translate(' + f1(V.tx - x0 * V.z) + ',' + f1(V.ty - y0 * V.z) + ') scale(' + V.z + ')"><path class="m2-ed-dark" d="' + shapeD(link.to) + '"/></g>');
      out.push('<path class="m2-ed-live" stroke-width="' + f1(Math.max(1, V.z)) + '"' + (no ? ' stroke-dasharray="4 3"' : '') + ' d="M' + f1(sx(C[0])) + ' ' + f1(sy(C[1])) + 'L' + f1(sx(link.P[0])) + ' ' + f1(sy(link.P[1])) + '"/>');
    }
    document.addEventListener('keydown', function (e) { if (link && e.key === 'Escape') { link = null; tap = null; paint(); } }, true);

    function sizable(i) {    
      var n = nodes2[i], u = n && n.up != null ? nodes2[n.up] : null;
      return palOn() && !!n && isMade(n) && n.shape.kind !== 'Process' && n.shape.kind !== 'Operator' && (!u || u.comp);    
    }
    var sizeRec = null;    
    function sizeLive(i, nb) {
      var g = gN && gN[nodes2[i].id];
      if (!g) return;
      if (!sizeRec || sizeRec.i !== i) {
        sizeOff();
        var first = g.firstElementChild && g.firstElementChild.localName === 'a' ? g.firstElementChild : g, b = boxOf(i), seen = new Set();
        var svs = svList(i).map(function (q) {
          var parts = svParts(i, q); parts.forEach(function (el) { seen.add(el); });
          return { parts: parts, r: [(q[1][0] - b[0]) / b[2] - 0.5, (q[1][1] - b[1]) / b[3] - 0.5], c: q[1] };
        });
        var shapes = [], kids = Array.prototype.filter.call(first.children, function (el) { return !el.classList.contains('m2-ed-dark'); });
        for (var k = 0; k < kids.length && kids[k].localName === 'path' && !seen.has(kids[k]); k++) shapes.push(kids[k]);    
        sizeRec = { i: i, b: b, shapes: shapes, svs: svs, texts: kids.filter(function (el) { return el.localName === 'text' && !seen.has(el); }), was: new Map() };
        shapes.concat(sizeRec.texts).forEach(function (el) { sizeRec.was.set(el, [el.getAttribute('d'), el.getAttribute('transform')]); });
        svs.forEach(function (s) { s.parts.forEach(function (el) { sizeRec.was.set(el, [el.getAttribute('d'), el.getAttribute('transform')]); }); });
      }
      var R = sizeRec, n = nodes2[i], b0 = R.b, two = R.shapes.length > 1 && n.shape.props.mcount === '2';
      R.shapes.forEach(function (el, k) { var o = two && k < R.shapes.length / 2 ? 6 : 0; el.setAttribute('d', outlineD(n.shape, nb[0] + o, nb[1] + o, nb[2], nb[3])); });
      var tr = function (dx, dy) { return 'translate(' + f1(dx) + ' ' + f1(dy) + ')'; };
      R.texts.forEach(function (el) { el.setAttribute('transform', tr(nb[0] + nb[2] / 2 - b0[0] - b0[2] / 2, nb[1] + nb[3] / 2 - b0[1] - b0[3] / 2)); });
      R.svs.forEach(function (s) {
        var t = tr(nb[0] + (0.5 + s.r[0]) * nb[2] - s.c[0], nb[1] + (0.5 + s.r[1]) * nb[3] - s.c[1]);
        s.parts.forEach(function (el) { el.setAttribute('transform', t); });
      });
    }
    function sizeOff() {    
      if (!sizeRec) return;
      sizeRec.was.forEach(function (v, el) {
        if (v[0] != null) el.setAttribute('d', v[0]);
        if (v[1] != null) el.setAttribute('transform', v[1]); else el.removeAttribute('transform');
      });
      sizeRec = null;
    }
    function setSize(i, nb) {    
      var id = nodes2[i].id, t2;
      nb = nb.map(function (v) { return +fmt(v); });
      try { t2 = sbJs.resize(text, id, nb); } catch (err) { warn('Not resized: ' + (err && err.message || err) + '.'); liveOff(); sizeOff(); paint(); return; }
      if (t2 === text) { liveOff(); sizeOff(); paint(); return; }
      remember(false); text = t2; parse(); dirty = true;
      selN = []; nodes2.forEach(function (n, k) { if (n.id === id) selN = [k]; });
      fitThen({ moved: [id] }, function () { sizeRec = null; render(); paint(); changed(); });
    }
    var ROWS = [['label', 'Label', 'text'], ['w', 'Width', 'num'], ['h', 'Height', 'num'], ['fill', 'Fill colour', 'colour'],
      ['line', 'Border colour', 'colour'], ['width', 'Border width', 'num'], ['multimer', 'Multimer', 'check']];
    var props = document.createElement('div');
    props.className = 'm2-ed-props'; props.hidden = true;
    props.innerHTML = '<p>Properties</p><table class="m2-ed-ptab">' + ROWS.map(function (r) {
      var id = 'm2-ed-' + r[0], f = r[2] === 'check' ? '<input type="checkbox" id="' + id + '">'
        : r[2] === 'colour' ? '<span class="m2-ed-pc"><input type="color" tabindex="-1" aria-label="' + r[1] + ', picker"><input type="text" id="' + id + '" spellcheck="false" autocomplete="off"' + (r[0] === 'fill' ? ' placeholder="none"' : '') + '></span>'
        : r[2] === 'num' ? '<input type="number" id="' + id + '" step="any"' + (r[0] === 'width' ? ' min="0.25" max="20"' : ' min="4" max="5000"') + '>'
        : '<input type="text" id="' + id + '" spellcheck="false" autocomplete="off">';
      return '<tr data-k="' + r[0] + '"><th><label for="' + id + '">' + r[1] + '</label></th><td>' + f + '</td></tr>';
    }).join('') + '</table>' +
      '<button type="button" class="m2-ed-pdef" title="The next ones of this kind made from the palette take these">Set as default</button>';
    pal.insertAdjacentElement('afterend', props);
    var inW = props.querySelector('#m2-ed-w'), inH = props.querySelector('#m2-ed-h');
    var field = function (k) { return props.querySelector('#m2-ed-' + k); }, pNow = {}, pCls = [];
    function propNode() {    
      if (selN.length !== 1 || selP.length || selE.length || svSel || !palOn() || !isMade(nodes2[selN[0]])) return -1;
      var id = nodes2[selN[0]].id;
      if (pCls[0] !== id || pCls[1] !== text) { var c = sbJs.classOf(src(), id); pCls = [id, text, /^(macromolecule|simple chemical)( multimer)?$|^biological activity$/.test(c), c === 'biological activity']; }
      return pCls[2] ? selN[0] : -1;
    }
    function kindOf(i) { return propNode() === i && pCls[3] ? 'biological activity' : nodes2[i].shape.kind === 'SimpleChemical' ? 'simple chemical' : 'macromolecule'; }    
    function propsShow(all) {    
      var i = propNode(), r2 = function (v) { return String(Math.round(v * 100) / 100); };
      props.hidden = !palOn() || i < 0;    
      if (props.hidden) return;
      Array.prototype.forEach.call(props.querySelectorAll('tr[data-k]'), function (tr) { tr.hidden = (/^[wh]$/.test(tr.dataset.k) && !sizable(i)) || (tr.dataset.k === 'multimer' && pCls[3]); });    
      var o = sbJs.lookOf(realizerOf(nodes2[i].el)), b = bx(i);
      pNow = { label: nameOf(i), w: r2(b[2]), h: r2(b[3]), fill: o.fill ? o.fill.slice(0, 7).toLowerCase() : '', line: (o.line || '#000000').slice(0, 7).toLowerCase(), width: r2(o.width), multimer: o.multimer };
      ROWS.forEach(function (r) {
        var f = field(r[0]);
        if (!all && document.activeElement === f) return;
        if (r[2] === 'check') { f.checked = pNow[r[0]]; return; }
        if (f.value !== pNow[r[0]]) f.value = pNow[r[0]];    
        var pk = f.previousElementSibling;
        if (r[2] === 'colour' && document.activeElement !== pk && pk.value !== (pNow[r[0]] || '#ffffff')) pk.value = pNow[r[0]] || '#ffffff';    
      });
    }
    [inW, inH].forEach(function (inp, k) {
      inp.addEventListener('change', function () {
        var i = propNode(), v = parseFloat(inp.value);
        if (i < 0 || !sizable(i)) return;
        var b = boxOf(i);
        if (!(v >= 4 && v <= 5000) || Math.abs(v - b[2 + k]) < 0.005) { propsShow(); return; }
        var nb = b.slice(); nb[2 + k] = v; nb[k] = b[k] + b[2 + k] / 2 - v / 2;    
        setSize(i, nb);
      });
    });
    function hex(v) {    
      v = v.trim().replace(/^#/, '');
      if (/^[0-9a-f]{3}$/i.test(v)) v = v.replace(/./g, '$&$&');
      return /^[0-9a-f]{6}$/i.test(v) ? '#' + v.toUpperCase() : v ? null : '';
    }
    function propSet(k) {    
      var i = propNode();
      if (i < 0) return;
      var f = field(k), id = nodes2[i].id, t2 = text, v = k === 'multimer' ? f.checked : f.value;
      if (k === 'label') t2 = sbJs.label(text, id, v.replace(/[\r\n]+/g, ' '));
      else if (k === 'multimer') t2 = sbJs.multimer(text, id, v);    
      else if (k === 'width') { var x = parseFloat(v); if (x > 0 && x <= 20) t2 = sbJs.restyle(text, id, { width: x }); }
      else {
        var c = hex(v), o = {};
        if (c !== null && !(c === '' && k === 'line')) { o[k] = c === '#000000' && k === 'line' ? null : c || null; t2 = sbJs.restyle(text, id, o); }
      }
      if (t2 === text) { propsShow(true); return; }
      remember(false); text = t2; made(id);
    }
    ROWS.forEach(function (r) {
      if (r[2] === 'num' && r[0] !== 'width') return;    
      var f = field(r[0]);
      f.addEventListener('change', function () { propSet(r[0]); });
      if (r[2] === 'colour') f.previousElementSibling.addEventListener('change', function (e) { f.value = e.target.value; propSet(r[0]); });
    });
    props.addEventListener('keydown', function (e) {    
      if (e.key === 'Enter') { e.target.blur(); e.preventDefault(); }
      else if (e.key === 'Escape') { propsShow(true); e.target.blur(); e.preventDefault(); }    
      e.stopPropagation();
    });
    var DEF_KEY = 'atlas-edit-defaults';
    function defsKept() { try { return JSON.parse(localStorage.getItem(DEF_KEY) || '{}') || {}; } catch (e) { return {}; } }
    function defOf(cls) {    
      cls = baseKind(cls);
      var kind0 = cls;
      if (ACT_UNIT[cls] != null) cls = 'biological activity';    
      var D = sbJs.defaults(src(), null, cls, ACT_UNIT[kind0]), k = defsKept()[cls];    
      D.multimer = false;
      var u = cls !== 'biological activity' && palKind() === 'af' ? sbJs.unitFor(kind0) : null;
      if (u != null) { var DA = sbJs.defaults(src(), null, 'biological activity', u); D.fill = DA.fill; D.fallback = DA.fallback; }
      if (k) {
        ['fill', 'line', 'width', 'multimer'].forEach(function (q) { if (q in k) D[q] = k[q]; });
        if (k.wr > 0 && k.hr > 0) { D.w = Math.round(D.w * k.wr * 100) / 100; D.h = Math.round(D.h * k.hr * 100) / 100; }
      }
      if (kind0 === 'metabolite activity') D.w = D.h;
      if (V.scheme === 'none' && D.fallback && !(k && 'fill' in k)) D.fill = null;    
      return D;
    }
    props.querySelector('.m2-ed-pdef').addEventListener('click', function () {
      var i = propNode();
      if (i < 0) return;
      var o = sbJs.lookOf(realizerOf(nodes2[i].el)), b = boxOf(i), all = defsKept(), D = sbJs.defaults(src(), null, kindOf(i));
      all[kindOf(i)] = { wr: b[2] / D.w, hr: b[3] / D.h, fill: o.fill, line: o.line, width: o.width, multimer: o.multimer };
      try { localStorage.setItem(DEF_KEY, JSON.stringify(all)); } catch (e) { warn('The default could not be kept in this browser.'); }
    });
