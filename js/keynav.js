// Keyboard navigation (design-guide "Keyboard navigation"):
// - Arrows are the universal floor: geometric roving focus over every visible
//   .fs-focusable target, within and across regions. Enter activates, Esc steps out.
// - Alt-hold reveals key-hint badges (.fs-keyhint) and Alt+<key> jumps+activates.
//   Tier 1: stable letters on dock destinations. Tier 2: 1..9 positional per view.
// - No on/off setting; chrome is summoned by intent (:focus-visible, Alt).

const altBindings = new Map();   // key -> element-or-fn resolver

export function bindAlt(key, target) {
  altBindings.set(key.toLowerCase(), target);
}

export function unbindAlt(key) {
  altBindings.delete(key.toLowerCase());
}

function resolve(target) {
  return typeof target === 'function' ? target() : target;
}

function isTyping() {
  const el = document.activeElement;
  return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
}

function visibleTargets() {
  const inModal = document.querySelector('.modal-sheet');
  const scope = inModal ?? document;
  return [...scope.querySelectorAll('.fs-focusable')].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
}

function center(el) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

// Nearest visible target in the pressed direction; distance weighted so that
// off-axis drift costs extra (prefers straight moves).
function moveFocus(dir) {
  const targets = visibleTargets();
  if (targets.length === 0) return;
  const current = document.activeElement;
  if (!targets.includes(current)) {
    targets[0].focus();
    return;
  }
  const from = center(current);
  const vec = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[dir];
  let best = null;
  let bestScore = Infinity;
  for (const el of targets) {
    if (el === current) continue;
    const to = center(el);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const along = dx * vec[0] + dy * vec[1];
    if (along <= 1) continue;                    // must lie in the direction
    const ortho = Math.abs(dx * vec[1]) + Math.abs(dy * vec[0]);
    const score = along + ortho * 2.5;
    if (score < bestScore) { bestScore = score; best = el; }
  }
  best?.focus();
}

// Positional Tier-2 hints: number the current view's repeated elements 1..9.
// Views opt elements in with data-keyseq; we assign keys by DOM order on Alt-hold.
function assignPositional() {
  const seq = [...document.querySelectorAll('[data-keyseq]')].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
  for (let i = 10; i <= 35; i++) unbindAlt((i - 9).toString(36));
  for (let n = 1; n <= 9; n++) unbindAlt(String(n));
  seq.slice(0, 9).forEach((el, i) => {
    bindAlt(String(i + 1), el);
    let hint = el.querySelector(':scope > .fs-keyhint');
    if (!hint) {
      hint = document.createElement('span');
      hint.className = 'fs-keyhint';
      el.appendChild(hint);
    }
    hint.textContent = String(i + 1);
  });
}

export function startKeynav() {
  document.body.dataset.keyhints = 'off';

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Alt' && !e.repeat) {
      assignPositional();
      document.body.dataset.keyhints = 'on';
      return;
    }
    if (e.altKey && e.key.length === 1) {
      const target = altBindings.get(e.key.toLowerCase());
      if (target) {
        e.preventDefault();
        const el = resolve(target);
        if (el instanceof HTMLElement) { el.focus(); el.click(); }
        else if (typeof el === 'function') el();
        document.body.dataset.keyhints = 'off';
      }
      return;
    }
    if (e.key.startsWith('Arrow') && !isTyping() && !e.altKey && !e.ctrlKey && !e.metaKey) {
      moveFocus(e.key);
      e.preventDefault();
    }
  });

  document.addEventListener('keyup', (e) => {
    if (e.key === 'Alt') document.body.dataset.keyhints = 'off';
  });
  window.addEventListener('blur', () => { document.body.dataset.keyhints = 'off'; });
}
