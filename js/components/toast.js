// Toast notifications — quiet, top-right, auto-dismiss. Flat sheets per the
// design system: border encodes the kind (data teal = success, danger = error),
// no fill, no shadow.

let region = null;

function ensureRegion() {
  if (!region) {
    region = document.createElement('div');
    region.id = 'toast-region';
    region.setAttribute('role', 'status');
    region.setAttribute('aria-live', 'polite');
    document.body.appendChild(region);
  }
  return region;
}

function show(kind, title, message) {
  const el = document.createElement('div');
  el.className = `toast toast--${kind}`;
  el.innerHTML = `
    <span class="toast__title"></span>
    ${message !== undefined ? '<span class="toast__msg"></span>' : ''}
  `;
  el.querySelector('.toast__title').textContent = title;
  if (message !== undefined) el.querySelector('.toast__msg').textContent = message;
  ensureRegion().appendChild(el);
  setTimeout(() => {
    el.classList.add('toast--leaving');
    el.addEventListener('transitionend', () => el.remove(), { once: true });
    setTimeout(() => el.remove(), 600); // fallback if no transition fires
  }, 5000);
}

export function toastSuccess(title, message) {
  show('success', title, message);
}

export function toastError(title, message) {
  show('error', title, message);
}

// Mirrors the old app's error-message extraction for ApiError/fetch failures.
export function errorMessage(err) {
  return err?.detail || err?.message || String(err);
}
