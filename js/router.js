// History-API router, base-path aware. Routes are flat single segments —
// the base-detection in index.html depends on that (app root = path up to
// the last "/"), so never introduce nested route paths.

export const BASE = window.SUNDIAL_BASE ?? '/';

const routes = new Map();   // name -> { tag, title }
let currentName = null;
const listeners = new Set();

export function defineRoutes(table) {
  for (const [name, def] of Object.entries(table)) routes.set(name, def);
}

export function currentRoute() {
  return currentName;
}

export function onRouteChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// name '' = home. Returns an app-absolute href for links.
export function href(name, query = '') {
  return BASE + name + (query ? `?${query}` : '');
}

export function navigate(name, { replace = false, query = '' } = {}) {
  const url = href(name, query);
  if (replace) history.replaceState(null, '', url);
  else history.pushState(null, '', url);
  render();
}

function nameFromLocation() {
  let seg = location.pathname.slice(BASE.length);
  if (seg === 'index.html') seg = '';
  return seg;
}

function render() {
  const name = routes.has(nameFromLocation()) ? nameFromLocation() : '';
  const def = routes.get(name);
  currentName = name;
  const view = document.getElementById('view');
  if (!view.firstElementChild || view.firstElementChild.tagName.toLowerCase() !== def.tag) {
    view.replaceChildren(document.createElement(def.tag));
  }
  for (const fn of listeners) fn(name);
}

export function startRouter() {
  window.addEventListener('popstate', render);
  // Intercept same-app link clicks so navigation stays client-side.
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (!a || a.origin !== location.origin || a.target === '_blank') return;
    if (!a.pathname.startsWith(BASE)) return;
    const seg = a.pathname.slice(BASE.length);
    if (!routes.has(seg)) return;
    e.preventDefault();
    navigate(seg, { query: a.search.slice(1) });
  });
  render();
}
