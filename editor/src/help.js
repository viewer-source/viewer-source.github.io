    // ---------- How to edit (editor/src/help.js) ----------
    // The one source of the editor's how-to (user, 2026-11-13: the long text in the Edit window took the room palettes and
    // new tools need): shown as a popover over the map's left edge by the "?" after the tools, or the ? key while
    // editing; never open by itself (user, 2026-11-13: the switch to edit stays clean, who needs it clicks). A tool added
    // or changed gets its line here in the same change. Each section: a title ('' for none) and lines, or [key, what] pairs.
    var HELP = [
      ['', 'This tool is designed for improving the layout of a map. Moves are saved by themselves; the site shows them about two minutes later.'],
      ['Move and zoom', ['A drag on empty space moves the map.', 'Two-finger scrolling or a pinch zooms.', 'A right click opens the same menu as outside edit mode.']],
      ['Select', ['A click selects a node, an arc or a bend point; a second click without a drag deselects it.',
        'Shift with a drag on empty space selects an area.', 'Shift with a click adds to the selection.']],
      ['Move what is selected', ['A drag moves what is selected.', 'Arrow keys move by 1, with Shift by 10.',
        'With Snap to grid on (the magnet), a node dragged puts its centre on the 8 px grid and a bend point goes on 4 px. Alt held, no snapping.',
        'A right click on a line adds an anchor point there; on an anchor point, removes it.']],
      ['Layout tools', ['The dotted square puts the whole map on the grid by the layout rules (complexes packed, rows and columns kept), one step to undo.',
        'The complex with two proteins packs the complex selected (or the one round a member selected), every complex when nothing is selected.']],
      ['Keys', [['Ctrl or Cmd Z', 'undo'], ['Ctrl or Cmd Y', 'redo'], ['Ctrl or Cmd S', 'save at once'], ['Ctrl or Cmd A', 'select all'], ['Esc', 'clear the selection'],
        ['Delete', 'remove the anchor point selected'], ['E', 'switch between edit and view mode (not while typing in a field)'], ['?', 'this help']]]
    ];
    var helpBtn = box.querySelector('#m2-ed-help'), helpBox = null;
    function helpBuild() {
      var e = function (t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;'); };
      helpBox = document.createElement('div');
      helpBox.id = 'm2-ed-help-box'; helpBox.setAttribute('role', 'dialog'); helpBox.setAttribute('aria-label', 'How to edit'); helpBox.hidden = true;
      helpBox.innerHTML = '<button type="button" class="m2-ed-help-x" aria-label="Close">×</button>' + HELP.map(function (s) {
        var body = typeof s[1] === 'string' ? '<p>' + e(s[1]) + '</p>'
          : Array.isArray(s[1][0]) ? '<dl>' + s[1].map(function (k) { return '<dt>' + e(k[0]) + '</dt><dd>' + e(k[1]) + '</dd>'; }).join('') + '</dl>'
          : '<ul>' + s[1].map(function (l) { return '<li>' + e(l) + '</li>'; }).join('') + '</ul>';
        return (s[0] ? '<h4>' + e(s[0]) + '</h4>' : '') + body;
      }).join('');
      document.body.appendChild(helpBox);
      helpBox.querySelector('.m2-ed-help-x').addEventListener('click', function () { help(false); });
    }
    function help(show) {   // show: true, false, or undefined to switch
      if (!helpBox) helpBuild();
      show = show === undefined ? helpBox.hidden : show;
      if (show) {   // over the map's left edge, level with the "?"; on a narrow page under it
        var b = helpBtn.getBoundingClientRect(), p = V.view.getBoundingClientRect();
        helpBox.hidden = false;
        var w = helpBox.offsetWidth, h = helpBox.offsetHeight, left = Math.max(p.left + 28, b.right + 8), top = b.top;   // past the separator over the map window's edge
        if (left + w > innerWidth - 16) { left = Math.max(16, Math.min(b.right - w, innerWidth - 16 - w)); top = b.bottom + 6; }
        helpBox.style.left = left + 'px'; helpBox.style.top = Math.max(16, Math.min(top, innerHeight - 16 - h)) + 'px';
      } else helpBox.hidden = true;
      helpBtn.setAttribute('aria-pressed', String(show));
    }
    helpBtn.addEventListener('click', function () { help(); });
    document.addEventListener('keydown', function (ev) {
      if (helpBox && !helpBox.hidden && ev.key === 'Escape') { help(false); ev.stopPropagation(); return; }
      if (ev.key !== '?' || ev.ctrlKey || ev.metaKey || ev.altKey || !on) return;
      var a = document.activeElement;
      if (a && (/input|textarea|select/i.test(a.tagName) || a.isContentEditable)) return;
      ev.preventDefault(); help();
    }, true);
    document.addEventListener('pointerdown', function (ev) {   // a click elsewhere closes it
      if (helpBox && !helpBox.hidden && !helpBox.contains(ev.target) && !helpBtn.contains(ev.target)) help(false);
    }, true);
