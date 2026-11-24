// An SVG element's matrix to the screen, in the pointer's pixels, the same in every engine: its matrix to its <svg>
// (getCTM), then the <svg>'s own box as the page draws it. getScreenCTM leaves the page's CSS zoom out in Firefox,
// so a point found with it lands a tenth off there. Given to the page as window.__ctm(el), used where a test would call
// el.getScreenCTM(): page.addInitScript(require('./lib/screen.js')).
module.exports = function () {
  window.__ctm = function (el) {
    var svg = el.ownerSVGElement || el, c = el === svg ? svg.createSVGMatrix() : el.getCTM(), r = svg.getBoundingClientRect(), k = svg.clientWidth ? r.width / svg.clientWidth : 1;
    return { a: k * c.a, b: k * c.b, c: k * c.c, d: k * c.d, e: k * c.e + r.left, f: k * c.f + r.top };
  };
};
