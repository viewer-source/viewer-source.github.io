---
---
window.m2Editor = function (V) {
{% include_relative src/core.js %}
{% include_relative src/graphml.js %}
{% include_relative src/celldesigner.js %}
{% include_relative src/help.js %}
    buttons();
    aheadSoon();
    return { paint: paint, away: away, leaving: function (m) { if (on && m !== map) stop(); }, left: function (m) { if (on && m !== map) stop(); buttons(); setTimeout(shown, 0); warmUp(); aheadSoon(); } };
};
