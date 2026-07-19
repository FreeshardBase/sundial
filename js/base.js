// Subpath-aware base: the app may be served at "/" or "/sundial/" (or any
// prefix). Routes are flat (single segment), so the app root is the document
// path up to the last "/". A <base> tag injected before any <link>/<script>
// makes every relative URL (assets, import map, router) resolve against it.
// Classic script, loaded first in <head> — externalized (not inline) so the
// CSP can stay script-src 'self' without unsafe-inline.
(() => {
  const root = location.pathname.replace(/[^/]*$/, '');
  const base = document.createElement('base');
  base.href = location.origin + root;
  document.head.appendChild(base);
  window.SUNDIAL_BASE = root;
})();
