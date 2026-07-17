// Inline SVG line glyphs — 20×20, 1.5px stroke, currentColor. Thin functional
// strokes per the design language; no filled shapes except tiny dots.

function svg(inner, cls = '') {
  return `<svg class="icon ${cls}" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
}

export const icons = {
  home: svg('<path d="M3.5 9.5 10 3.5l6.5 6v6.5a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1z"/><path d="M8 17v-4.5h4V17"/>'),
  apps: svg('<rect x="3.5" y="3.5" width="5" height="5" rx="1"/><rect x="11.5" y="3.5" width="5" height="5" rx="1"/><rect x="3.5" y="11.5" width="5" height="5" rx="1"/><rect x="11.5" y="11.5" width="5" height="5" rx="1"/>'),
  devices: svg('<rect x="3.5" y="4.5" width="13" height="8.5" rx="1"/><path d="M2.5 15.5h15"/>'),
  person: svg('<circle cx="10" cy="6.75" r="2.75"/><path d="M4.5 16.5c.7-3 2.9-4.5 5.5-4.5s4.8 1.5 5.5 4.5"/>'),
  people: svg('<circle cx="7.5" cy="7" r="2.4"/><path d="M2.8 15.7c.6-2.6 2.5-3.9 4.7-3.9s4.1 1.3 4.7 3.9"/><path d="M13 5.1a2.4 2.4 0 0 1 0 4.4M14.6 12.2c1.4.5 2.4 1.6 2.8 3.3"/>'),
  gear: svg('<circle cx="10" cy="10" r="4.75"/><circle cx="10" cy="10" r="1.6"/><path d="M16.4 10h1.9M10 16.4v1.9M3.6 10H1.7M10 3.6V1.7M14.5 14.5l1.4 1.4M5.5 14.5l-1.4 1.4M5.5 5.5 4.1 4.1M14.5 5.5l1.4-1.4"/>'),
  feedback: svg('<path d="M3.5 4.5h13v8.5h-7l-3.5 3v-3h-2.5z"/><path d="M6.5 8h7M6.5 10.5h4"/>'),
  warn: svg('<path d="M10 3.2 17.5 16.5H2.5z"/><path d="M10 8.2v3.6"/><circle cx="10" cy="14.2" r=".4" fill="currentColor" stroke="none"/>'),
  disk: svg('<rect x="3" y="11.5" width="14" height="5" rx="1"/><path d="M3.6 11.5 6 4.5h8l2.4 7"/><circle cx="13.8" cy="14" r=".5" fill="currentColor" stroke="none"/>'),
  update: svg('<circle cx="10" cy="10" r="6.75"/><path d="M10 13.2V7M7.4 9.4 10 6.8l2.6 2.6"/>'),
  sun: svg('<circle cx="10" cy="10" r="3.25"/><path d="M10 2.8v1.7M10 15.5v1.7M2.8 10h1.7M15.5 10h1.7M4.9 4.9 6.1 6.1M13.9 13.9l1.2 1.2M15.1 4.9l-1.2 1.2M6.1 13.9l-1.2 1.2"/>'),
  moon: svg('<path d="M16 12.2A6.8 6.8 0 0 1 7.8 4a6.8 6.8 0 1 0 8.2 8.2z"/>'),
  plus: svg('<path d="M10 4.5v11M4.5 10h11"/>'),
  refresh: svg('<path d="M15.5 8.5a5.75 5.75 0 1 0 .25 3"/><path d="M15.9 4.6v3.9H12"/>'),
  trash: svg('<path d="M4 6h12M8 6V4.5h4V6M5.5 6l.8 9.5a1 1 0 0 0 1 .9h5.4a1 1 0 0 0 1-.9L14.5 6M8.2 9v4.5M11.8 9v4.5"/>'),
  pencil: svg('<path d="m12.9 3.6 3.5 3.5L7 16.5l-4 .5.5-4z"/>'),
  x: svg('<path d="m5.5 5.5 9 9M14.5 5.5l-9 9"/>'),
  check: svg('<path d="m4.5 10.5 3.5 3.5 7.5-8"/>'),
  box: svg('<rect x="4" y="4" width="12" height="12" rx="1.5"/>'),
  star: svg('<path d="m10 3.5 1.9 3.9 4.3.6-3.1 3 .7 4.3L10 13.3l-3.8 2 .7-4.3-3.1-3 4.3-.6z"/>'),
  info: svg('<rect x="3.5" y="3.5" width="13" height="13" rx="1.5"/><path d="M10 9v4"/><circle cx="10" cy="6.8" r=".4" fill="currentColor" stroke="none"/>'),
  open: svg('<path d="M8 4.5H5a1 1 0 0 0-1 1V15a1 1 0 0 0 1 1h9.5a1 1 0 0 0 1-1v-3"/><path d="M11.5 4h4.5v4.5M15.7 4.3 9.5 10.5"/>'),
  left: svg('<path d="m12 4.5-5.5 5.5L12 15.5"/>'),
  right: svg('<path d="m8 4.5 5.5 5.5L8 15.5"/>'),
  upload: svg('<path d="M10 13V4.5M6.8 7.2 10 4l3.2 3.2"/><path d="M4 12.5V15a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-2.5"/>'),
  link: svg('<path d="M8.5 11.5 11.5 8.5"/><path d="M9 6.5 10.8 4.7a2.9 2.9 0 0 1 4.1 4.1L13.5 10.5M11 13.5 9.2 15.3a2.9 2.9 0 0 1-4.1-4.1L6.5 9.5"/>'),
  smartphone: svg('<rect x="6" y="3" width="8" height="14" rx="1.5"/><path d="M9 15h2"/>'),
  tablet: svg('<rect x="4.5" y="3" width="11" height="14" rx="1.5"/><path d="M9 15h2"/>'),
  notebook: svg('<rect x="4" y="4.5" width="12" height="8" rx="1"/><path d="M2.5 15h15"/>'),
  desktop: svg('<rect x="3" y="3.5" width="14" height="9" rx="1"/><path d="M8 16.5h4M10 12.5v4"/>'),
};

export function icon(name, cls) {
  const base = icons[name] ?? icons.box;
  return cls ? base.replace('class="icon ', `class="icon ${cls} `) : base;
}
