// What a browser reports as a page error that is no fault of the page: a ResizeObserver loop (WebKit reports it, Chromium
// does not), a fetch cut off by a reload or a lost connection (WebKit says it failed its access control checks). The same
// list as the editor's error catcher passes by (editor/src/core.js, PASSED); the browser tests leave these out of their
// check for script errors.
module.exports = /ResizeObserver loop|Failed to fetch|Load failed|NetworkError|network connection was lost|appears to be offline|request timed out|access control checks|The operation was aborted|AbortError|^Script error\.?$/;
