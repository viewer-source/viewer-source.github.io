import { V } from './state.js';
import { warn } from './core.js';
import { yr } from './drawing.js';

    // ---------- the converter's engines in the browser (editor/src/engines.js) ----------
    // renderers/converter/sbgn_edit.js and sbml_edit.js (which uses it), loaded once a map is edited, whatever its format:
    // besides writing SBGN-ML and SBML, sbgn_edit's stacking and moveInto serve every map edited as GraphML. sbJs is
    // sbgn_edit once loaded; sbScript loads another of the converter's scripts (sbgn.js loads sbgnml_read with it).
    var sbp, sbJs;
    function __run1() {   // run at start, in order (__start)
    sbp = null, sbJs = null;   // the engines loading, loaded
    }
    function sbScript(name) {
      return new Promise(function (res, rej) {
        if (window[name]) return res();
        var s = document.createElement('script');
        s.src = V.renderers + 'converter/' + name + '.js' + V.build; s.onload = res; s.onerror = function () { rej(name + ' not found'); };
        document.head.appendChild(s);
      });
    }
    function sbpy() {   // sbgn_edit.js, sbml_edit.js (which uses it), then the yEd renderer
      if (sbp) return sbp;
      sbp = sbScript('sbgn_edit').then(function () { return sbScript('sbml_edit').catch(function () {}); }).then(yr).then(function () { sbJs = window.sbgn_edit; return sbJs; });   // a copy without sbml_edit keeps SBGN-ML
      sbp.catch(function (e) { sbp = null; warn('The SBGN-ML side did not load: ' + e); });
      return sbp;
    }
    export function __start() { __run1(); }   // the part's statements, in their order
    export { sbJs, sbScript, sbpy };
