// Shard identity badge — diamond logomark + 6-char short id in mono, framed by
// the hash-derived variable-width perimeter fingerprint (design-guide "Shard
// identity badge"; algorithm ported from ui-style/build/build_guide.py).
//
// Deviation from the Python reference: real shard ids are base36 (not hex), so
// the seed is parsed base36 and the PRNG is mulberry32 rather than Python's
// Mersenne Twister. Still fully deterministic per id.

import { esc } from './base.js';

const BW = 110, BH = 30, ROUT = 7.0, OUT = 0.8, THIN = 1.2, THICK = 3.2, N = 480;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashParams(idv) {
  const seed = parseInt(idv, 36) || 1;
  const rnd = mulberry32(seed);
  const count = 5 + Math.floor(rnd() * 6);
  const switches = [...new Set(
    Array.from({ length: count }, () => Math.round(rnd() * 1e4) / 1e4),
  )].sort((a, b) => a - b);
  return { start: seed & 1, switches };
}

function thickAt(t, { start, switches }) {
  const flips = switches.filter((q) => q < t).length;
  return (start ^ (flips & 1)) === 1;
}

// Sample the rounded-rect perimeter: [x, y, nx, ny, t] with outward normal.
function contour(inset, R) {
  const l = inset, t0 = inset, r = BW - inset, b = BH - inset;
  const segs = [
    ['l', [[l + R, t0], [r - R, t0], [0, -1]], (r - R) - (l + R)],
    ['a', [[r - R, t0 + R], -Math.PI / 2, 0], R * Math.PI / 2],
    ['l', [[r, t0 + R], [r, b - R], [1, 0]], (b - R) - (t0 + R)],
    ['a', [[r - R, b - R], 0, Math.PI / 2], R * Math.PI / 2],
    ['l', [[r - R, b], [l + R, b], [0, 1]], (r - R) - (l + R)],
    ['a', [[l + R, b - R], Math.PI / 2, Math.PI], R * Math.PI / 2],
    ['l', [[l, b - R], [l, t0 + R], [-1, 0]], (b - R) - (t0 + R)],
    ['a', [[l + R, t0 + R], Math.PI, 3 * Math.PI / 2], R * Math.PI / 2],
  ];
  const total = segs.reduce((s, seg) => s + seg[2], 0);
  const pts = [];
  for (let i = 0; i < N; i++) {
    const d = total * i / N;
    let acc = 0;
    for (const [kind, data, len] of segs) {
      if (d <= acc + len) {
        const u = len > 0 ? (d - acc) / len : 0;
        let x, y, nx, ny;
        if (kind === 'l') {
          const [[ax, ay], [bx, by], [nx_, ny_]] = data;
          x = ax + (bx - ax) * u; y = ay + (by - ay) * u; nx = nx_; ny = ny_;
        } else {
          const [[cx, cy], a0, a1] = data;
          const ang = a0 + (a1 - a0) * u;
          x = cx + R * Math.cos(ang); y = cy + R * Math.sin(ang);
          nx = Math.cos(ang); ny = Math.sin(ang);
        }
        pts.push([x, y, nx, ny, i / N]);
        break;
      }
      acc += len;
    }
  }
  return pts;
}

const RIM = contour(OUT, ROUT);

function ringPath(idv) {
  const hp = hashParams(idv);
  const fmt = (v) => v.toFixed(1);
  const outer = RIM.map(([x, y]) => `${fmt(x)},${fmt(y)}`).join(' L ');
  const inner = RIM.map(([x, y, nx, ny, t]) => {
    const w = thickAt(t, hp) ? THICK : THIN;
    return `${fmt(x - nx * w)},${fmt(y - ny * w)}`;
  }).join(' L ');
  return `M ${outer} Z M ${inner} Z`;
}

class FsShardBadge extends HTMLElement {
  static observedAttributes = ['shard-id'];

  attributeChangedCallback() { this.render(); }
  connectedCallback() { this.render(); }

  render() {
    const id = (this.getAttribute('shard-id') || '').toLowerCase();
    if (!id) { this.innerHTML = ''; return; }
    this.innerHTML = `
      <svg width="${BW}" height="${BH}" viewBox="0 0 ${BW} ${BH}" aria-hidden="true">
        <rect x="${OUT}" y="${OUT}" width="${BW - 2 * OUT}" height="${BH - 2 * OUT}" rx="${ROUT}" fill="var(--surface)"/>
        <path d="${ringPath(id)}" fill="var(--line)" fill-rule="evenodd"/>
      </svg>
      <span class="badge-content">
        <img src="assets/img/shard_logo.png" alt="">
        <span class="mono">${esc(id.slice(0, 3))}<i></i>${esc(id.slice(3, 6))}</span>
      </span>`;
  }
}

customElements.define('fs-shard-badge', FsShardBadge);
