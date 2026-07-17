// Modal system. Per DECISIONS "backgrounding the page": the page recedes
// toward the paper ground (bg veil + mild desaturation); the modal keeps full
// colour and lifts on its border alone — never a shadow.
//
// openModal({ title, body, footer, size, onClose }) → { close, el }
// body/footer: HTMLElement | html string.

let stack = [];

function pageLayers() {
  return [document.getElementById('view'), document.getElementById('dock-slot')];
}

export function openModal({ title = '', body, footer, size = '', onClose } = {}) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const sheet = document.createElement('div');
  sheet.className = `modal-sheet ${size ? `modal-sheet--${size}` : ''}`;
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');

  if (title) {
    const h = document.createElement('div');
    h.className = 'modal-title';
    const heading = document.createElement('h2');
    heading.textContent = title;
    const x = document.createElement('button');
    x.className = 'modal-close';
    x.setAttribute('aria-label', 'Close');
    x.innerHTML = '&#10005;';
    x.addEventListener('click', () => api.close());
    h.append(heading, x);
    sheet.appendChild(h);
  }

  const bodyEl = document.createElement('div');
  bodyEl.className = 'modal-body';
  if (typeof body === 'string') bodyEl.innerHTML = body;
  else if (body) bodyEl.appendChild(body);
  sheet.appendChild(bodyEl);

  let footerEl = null;
  if (footer) {
    footerEl = document.createElement('div');
    footerEl.className = 'modal-footer';
    if (typeof footer === 'string') footerEl.innerHTML = footer;
    else footerEl.appendChild(footer);
    sheet.appendChild(footerEl);
  }

  overlay.appendChild(sheet);
  overlay.addEventListener('mousedown', (e) => {
    if (e.target === overlay) api.close();
  });

  document.getElementById('overlay-slot').appendChild(overlay);
  for (const layer of pageLayers()) layer?.classList.add('page-receded');

  let closed = false;
  const api = {
    el: sheet,
    body: bodyEl,
    footer: footerEl,
    close() {
      if (closed) return;
      closed = true;
      overlay.remove();
      stack = stack.filter((m) => m !== api);
      if (stack.length === 0) {
        for (const layer of pageLayers()) layer?.classList.remove('page-receded');
      }
      onClose?.();
    },
  };
  stack.push(api);

  const focusable = sheet.querySelector('input, textarea, button:not(.modal-close)');
  (focusable ?? sheet).focus?.();
  return api;
}

export function closeTopModal() {
  const top = stack.at(-1);
  if (top) { top.close(); return true; }
  return false;
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeTopModal();
});
