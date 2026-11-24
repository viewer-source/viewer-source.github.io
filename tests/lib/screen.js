// An SVG element's matrix to the screen, in the pointer's pixels, the same in every engine. Firefox's getScreenCTM and
// getCTM leave out or add the page's CSS zoom and the map's CSS translate differently from Chromium and WebKit, so a
// point found with them lands beside the glyph there. Here the element's matrix to its <svg> comes from two
// getScreenCTM calls (what an engine leaves out cancels), and the <svg>'s user units go onto its drawn box through its
// viewBox. Given to the page as window.__ctm(el), used where a test would call el.getScreenCTM():
// page.addInitScript(require('./lib/screen.js')).
module.exports = function () {
  window.__ctm = function (el) {
    var svg = el.ownerSVGElement || el, r = svg.getBoundingClientRect(), vb = svg.viewBox && svg.viewBox.baseVal;
    var rel = el === svg ? svg.createSVGMatrix() : svg.getScreenCTM().inverse().multiply(el.getScreenCTM());
    var bx = vb && vb.width ? vb.x : 0, by = vb && vb.height ? vb.y : 0;
    var sx = vb && vb.width ? r.width / vb.width : r.width / (svg.clientWidth || r.width), sy = vb && vb.height ? r.height / vb.height : sx;
    return { a: sx * rel.a, b: sy * rel.b, c: sx * rel.c, d: sy * rel.d, e: sx * (rel.e - bx) + r.left, f: sy * (rel.f - by) + r.top };
  };
};
