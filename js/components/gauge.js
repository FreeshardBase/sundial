// Data gauge — the design guide's canonical progress indicator: a thin SVG
// ring/arc whose filled length is derived from the real value (correctness
// rule, design-guide.md "Correctness rules"). Replaces flat div-fill bars
// everywhere (disk usage, pairing-code countdown) — a bar's width can be
// eyeballed wrong against its printed number; an arc built from
// stroke-dasharray = (value/max)*C cannot lie by construction.
//
// Usage: const el = document.createElement('fs-gauge');
//        el.reading = { value, max, tone?: 'normal'|'warning'|'danger',
//                        label?: string, live?: boolean };
// Compact form: <fs-gauge compact> — smaller ring, no center label (caller
// prints the number alongside, as the Home summary row already does).
// `live: true` applies the dark-mode-only glow signal (design-guide.md
// "Glow policy") for gauges that are actively ticking right now (e.g. the
// pairing-code countdown) — NOT for idle/static resource gauges like disk
// usage, which only change on an occasional refresh.

import { esc } from './base.js';

const GEOM = {
  full: { size: 64, r: 27 },      // r=27 -> C≈169.6, the design guide's own example
  compact: { size: 28, r: 12 },
};
const STROKE_W = 1.5; // design-guide.md "Line / stroke system": 1.5px for data arcs

class FsGauge extends HTMLElement {
  #reading = { value: 0, max: 1, tone: 'normal', label: null, live: false };

  set reading(r) {
    this.#reading = { ...this.#reading, ...r };
    this.render();
  }

  get reading() { return this.#reading; }

  connectedCallback() {
    this.render();
  }

  toneColor(tone) {
    return tone === 'danger' ? 'var(--danger)' : tone === 'warning' ? 'var(--accent)' : 'var(--data)';
  }

  render() {
    const compact = this.hasAttribute('compact');
    const { size, r } = compact ? GEOM.compact : GEOM.full;
    const c = size / 2;
    const circumference = 2 * Math.PI * r;
    const { value, max, tone, label, live } = this.#reading;
    const ratio = max > 0 ? Math.min(Math.max(value / max, 0), 1) : 0;
    const filled = ratio * circumference;
    const color = this.toneColor(tone);

    this.innerHTML = `
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"
          class="fs-gauge__svg" ${live ? 'data-live="true"' : ''}>
        <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="var(--border)" stroke-width="${STROKE_W}"/>
        <circle class="fs-gauge__fill" cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${color}"
            stroke-width="${STROKE_W}" stroke-linecap="round"
            stroke-dasharray="${filled.toFixed(2)} ${circumference.toFixed(2)}"
            transform="rotate(-90 ${c} ${c})"/>
      </svg>
      ${!compact && label != null ? `<span class="fs-gauge__label mono">${esc(label)}</span>` : ''}`;
  }
}

customElements.define('fs-gauge', FsGauge);
