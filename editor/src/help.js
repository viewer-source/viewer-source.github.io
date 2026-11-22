import { V } from './state.js';
import { box, on } from './core.js';

    // ---------- How to edit (editor/src/help.js) ----------
    // The one source of the editor's how-to (a popover, so the Edit window keeps its room for palettes and
    // new tools need): shown as a popover over the map's left edge by the "?" after the tools, or the ? key while
    // editing; never open by itself (the switch to edit stays clean). A gesture or menu item not easy to find, added
    // or changed, gets its row here in the same change.
    // Short on purpose: only what a person would not find by trying (a drag moves, a handle resizes, Delete removes stay
    // out); each section a title, a header row or null, and rows of a gesture, what it does and, in Less obvious, the
    // maps it applies to.
    var MOD;
    function __run1() {   // run at start, in order (__start)
    MOD = /mac|iphone|ipad|ipod/i.test((navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || navigator.userAgent) ? 'Cmd' : 'Ctrl';
    }
    function helpList() {
      return [
        ['While editing', null, [
          ['Click, then drag', 'an item is selected first, then moved'],
          ['Drag on empty space or an item not selected', V.grab === false ? 'selects an area in place of the selection' : 'moves the map, as outside editing'],
          ['Shift + click, Shift + drag', 'adds an item or an area to the selection; Shift + click takes an item out'],
          ['Shift + drag on what is selected', 'moves it by itself, out of what holds it'],
          ['Arrow keys', 'move what is selected by 1, with Shift by 10'],
          [MOD + ' + Z, ' + MOD + ' + Shift + Z or ' + MOD + ' + Y', 'undo, redo the last change, of the map or of a setting'],
          [MOD + ' + S', 'save at once'],
          ['Delete', 'remove what is selected, where it can be removed'],
          ['E', 'switch between editing and viewing']]],
        ['Less obvious', ['Gesture', 'What it does', 'Maps'], [
          ['Double click a palette sign', 'keeps it in hand for several uses, Esc lets go', 'all'],
          ['Drag between two entities with Consumption or Production', 'makes the process between them, with both arcs', 'SBGN-ML'],
          ['A sign kept in hand, dragged between two nodes', 'draws what the two ends call for: consumption, modulation, production', 'SBGN-ML, CellDesigner'],
          ['Drop a node on a complex', 'makes it a member, the complex packed round it', 'SBGN-ML, CellDesigner'],
          ['Click an item already selected, or double click', 'types its text in place (P, P@S505)', 'SBGN-ML'],
          ['Alt held while dragging or resizing', 'no snapping: any place, any size', 'all'],
          ['Click a line\u2019s end square, then arrow keys', 'moves the end round the node\u2019s outline', 'all'],
          ['Click a state variable, then arrow keys', 'moves it round the border', 'SBGN-ML, CellDesigner'],
          ['Right click on a line', 'adds a bend point there, or removes the one clicked', 'all'],
          ['Right click on empty space', 'Remove all bend points, Snap map to grid, Repack all complexes', 'all'],
          ['Right click on a complex', 'Name by members (A:B), Repack complex', 'all'],
          ['Right click on a process', 'Turn process, a quarter clockwise', 'all'],
          ['Right click on a node or line', 'Change identity: another kind, its lines kept', 'all'],
          ['Right click on overlapping compartments', 'Bring forward, Send backward', 'SBGN-ML, GraphML'],
          ['Right click on an added reactant or product', 'Make main reactant, Make main product', 'CellDesigner'],
          ['Add reactant or Add product, onto a reaction\u2019s line', 'joins a line to a reaction already there', 'CellDesigner'],
          ['A logic gate sign: click its inputs, then the reaction', 'places the gate where CellDesigner would', 'CellDesigner'],
          ['Set as default, in Properties', 'the next ones of that kind made this size and look', 'all'],
          ['Colours, Original', 'puts back the map\u2019s own colours after another choice', 'all']]]
      ];
    }
    var helpBtn, helpBox;
    function __run2() {   // run at start, in order (__start)
    helpBtn = box.querySelector('#m2-ed-help'), helpBox = null;
    }
    function helpBuild() {
      var e = function (t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;'); };
      helpBox = document.createElement('div');
      helpBox.id = 'm2-ed-help-box'; helpBox.setAttribute('role', 'dialog'); helpBox.setAttribute('aria-label', 'How to edit'); helpBox.hidden = true;
      var table = function (head, rows) { return '<table>' + (head ? '<tr>' + head.map(function (h) { return '<th>' + e(h) + '</th>'; }).join('') + '</tr>' : '') + rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + e(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</table>'; };
      helpBox.innerHTML = '<button type="button" class="m2-ed-help-x" aria-label="Close">\u00d7</button><h3>Editing</h3>' + helpList().map(function (s) { return '<h4>' + e(s[0]) + '</h4>' + table(s[1], s[2]); }).join('');
      document.body.appendChild(helpBox);
      helpBox.querySelector('.m2-ed-help-x').addEventListener('click', function () { help(false); });
    }
    function help(show, at) {   // show: true, false, or undefined to switch; at: a section's title, scrolled to
      if (!helpBox) helpBuild();
      show = show === undefined ? helpBox.hidden : show;
      if (show) { helpBox.remove(); helpBuild(); }   // built again, so the rows follow Settings (Drag selects an area)
      if (show) {   // over the map's left edge, level with the "?"; on a narrow page under it
        var b = helpBtn.getBoundingClientRect(), p = V.view.getBoundingClientRect();
        helpBox.hidden = false;
        var k = V.pz(), w = helpBox.offsetWidth * k, h = helpBox.offsetHeight * k, left = Math.max(p.left + 28, b.right + 8), top = b.top;   // past the separator over the map window's edge
        if (left + w > innerWidth - 16) { left = Math.max(16, Math.min(b.right - w, innerWidth - 16 - w)); top = b.bottom + 6; }
        helpBox.style.left = left / k + 'px'; helpBox.style.top = Math.max(16, Math.min(top, innerHeight - 16 - h)) / k + 'px';   // a fixed box in the page's zoomed units
        var h4 = at && Array.prototype.filter.call(helpBox.querySelectorAll('h4'), function (x) { return x.textContent === at; })[0];
        if (h4) helpBox.scrollTop = h4.offsetTop - 8;
      } else helpBox.hidden = true;
      helpBtn.setAttribute('aria-pressed', String(show));
    }
    function __run3() {   // run at start, in order (__start)
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
    }

    export function __start() { __run1(); __run2(); __run3(); }   // the part's statements, in their order
    export { help, helpBox };
