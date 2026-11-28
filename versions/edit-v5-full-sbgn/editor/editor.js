---
---
window.m2Editor = function (V) {
{% include_relative src/core.js %}
{% include_relative src/graphml.js %}
{% include_relative src/celldesigner.js %}
{% include_relative src/sbgn.js %}
{% include_relative src/create.js %}
{% include_relative src/help.js %}
{% include_relative src/own.js %}
    buttons();
    aheadSoon();
    syncFolder();    
    return { paint: paint, away: away, unkeep: unkeep, chooseFolder: chooseFolder, own: own, hasToken: function () { return !!(repo() && token()); }, leaving: function (m) { if (on && m !== map) stop(); }, left: function (m) { if (on && m !== map) stop(); buttons(); setTimeout(shown, 0); warmUp(); aheadSoon(); } };
};
