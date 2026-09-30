// mammoth ships a browser build (no Node deps) but without its own types for the
// sub-path. We only use convertToHtml; treat it as untyped and cast at the call.
declare module 'mammoth/mammoth.browser';
