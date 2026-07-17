// Sparkline — port of the designed component (DECISIONS "Sparkline",
// ui-style/build/build_sparkline.py, variant 1 "vertical brightness"):
// stroke runs through a vertical gradient mapped to value height (peaks
// brightest — honesty rule; doubles as dusk glow-on-live-data), mono max/0
// labels, hairline zero baseline, grey blocks for missing samples, dashed
// midnight separators, hover marker + value tooltip.
//
// Usage: const el = document.createElement('fs-sparkline');
//        el.series = { values: [..], unit: '%', max?, gaps?: [[i0,i1]], midnights?: [i], format? }
// Compact form: <fs-sparkline compact> — no axis furniture, dot on latest.

let gradientCounter = 0;

class FsSparkline extends HTMLElement {
  #series = null;
  #gid = `sparkgrad-${gradientCounter++}`;

  set series(s) {
    this.#series = s;
    this.render();
  }

  get series() { return this.#series; }

  connectedCallback() {
    this.render();
    this.addEventListener('pointermove', (e) => this.hover(e));
    this.addEventListener('pointerleave', () => this.hover(null));
  }

  isDark() {
    return document.documentElement.dataset.theme === 'dark';
  }

  gradientStops() {
    // Value-height → brightness; 3 stops for a bold, legible effect.
    return this.isDark()
      ? ['#e8faff', '#7fc6d6', '#234048']
      : ['#00c2dd', '#13899b', '#9fc7cd'];
  }

  geometry() {
    const compact = this.hasAttribute('compact');
    const W = compact ? 132 : this.clientWidth || 360;
    const H = compact ? 22 : 72;
    const padL = compact ? 1 : 30;
    const padR = compact ? 1 : 6;
    const padT = compact ? 3 : 9;
    const padB = compact ? 3 : 7;
    return { compact, W, H, padL, padR, padT, padB };
  }

  points(geom) {
    const { values, max } = this.#series;
    const mx = max ?? Math.max(...values.filter((v) => v !== null), 1);
    const n = values.length;
    const step = (geom.W - geom.padL - geom.padR) / Math.max(n - 1, 1);
    return {
      mx,
      pts: values.map((v, i) => [
        geom.padL + i * step,
        v === null ? null : geom.padT + (1 - v / mx) * (geom.H - geom.padT - geom.padB),
        v,
      ]),
    };
  }

  render() {
    if (!this.#series || this.#series.values.length === 0) {
      this.innerHTML = '';
      return;
    }
    const s = this.#series;
    const geom = this.geometry();
    const { W, H, padL, padR, padT, padB, compact } = geom;
    const { mx, pts } = this.points(geom);
    const [top, mid, bot] = this.gradientStops();
    const tip = this.isDark() ? '#e8faff' : '#00c2dd';
    const gapFill = this.isDark() ? '#241f18' : '#ece7da';
    const fmt = s.format ?? ((v) => `${Math.round(v)}${s.unit ?? ''}`);

    // Line path bridges null (missing) samples.
    let d = '';
    let pen = false;
    for (const [x, y] of pts) {
      if (y === null) continue;
      d += `${pen ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)} `;
      pen = true;
    }

    const xi = (i) => pts[Math.max(0, Math.min(i, pts.length - 1))][0];
    let furniture = '';
    if (!compact) {
      for (const [g0, g1] of s.gaps ?? []) {
        furniture += `<rect x="${xi(g0).toFixed(1)}" y="0" width="${(xi(g1) - xi(g0)).toFixed(1)}" height="${H}" fill="${gapFill}"/>`;
      }
      for (const i of s.midnights ?? []) {
        furniture += `<line x1="${xi(i).toFixed(1)}" y1="0" x2="${xi(i).toFixed(1)}" y2="${H}" stroke="var(--border)" stroke-width="1" stroke-dasharray="2,2"/>`;
      }
      const yBot = H - padB;
      furniture += `<line x1="${padL}" y1="${yBot}" x2="${W - padR}" y2="${yBot}" stroke="var(--border)" stroke-width="1"/>`;
      const disp = s.maxLabel ?? (mx >= 1000 ? `${(mx / 1000).toFixed(1)}k` : `${Math.round(mx * 10) / 10}`);
      furniture += `
        <text x="0" y="11" font-size="10" fill="var(--ink-muted)" font-family="IBM Plex Mono, monospace">${disp}</text>
        <text x="0" y="${H - 2}" font-size="10" fill="var(--ink-muted)" font-family="IBM Plex Mono, monospace">0</text>`;
    }

    const last = [...pts].reverse().find(([, y]) => y !== null);
    const latestDot = compact && last
      ? `<circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="2" fill="${tip}"/>` : '';

    this.innerHTML = `
      <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display:block">
        <defs>
          <linearGradient id="${this.#gid}" gradientUnits="userSpaceOnUse"
              x1="0" y1="${padT}" x2="0" y2="${H - padB}">
            <stop offset="0" stop-color="${top}"/>
            <stop offset="0.5" stop-color="${mid}"/>
            <stop offset="1" stop-color="${bot}"/>
          </linearGradient>
        </defs>
        ${furniture}
        <path d="${d.trim()}" fill="none" stroke="url(#${this.#gid})"
              stroke-width="${compact ? 1.6 : 2}" stroke-linecap="round" stroke-linejoin="round"/>
        ${latestDot}
        <g class="spark-hover" style="display:none">
          <line y1="0" y2="${H}" stroke="var(--line)" stroke-width="1" opacity=".5"/>
          <circle r="3" fill="${tip}"/>
          <rect rx="5" width="44" height="18" fill="var(--surface)" stroke="var(--border)"/>
          <text font-size="10" text-anchor="middle" fill="var(--ink)" font-family="IBM Plex Mono, monospace"></text>
        </g>
      </svg>`;
    this._render_state = { pts, fmt, W, H };
  }

  hover(e) {
    const g = this.querySelector('.spark-hover');
    if (!g || !this._render_state) return;
    if (e === null || this.hasAttribute('compact')) {
      g.style.display = 'none';
      return;
    }
    const { pts, fmt, W } = this._render_state;
    const rect = this.querySelector('svg').getBoundingClientRect();
    const x = (e.clientX - rect.left) * (W / rect.width);
    let best = null;
    for (const p of pts) {
      if (p[1] === null) continue;
      if (!best || Math.abs(p[0] - x) < Math.abs(best[0] - x)) best = p;
    }
    if (!best) return;
    const [px, py, v] = best;
    g.style.display = '';
    const [line, dot, box, text] = [
      g.querySelector('line'), g.querySelector('circle'),
      g.querySelector('rect'), g.querySelector('text')];
    line.setAttribute('x1', px); line.setAttribute('x2', px);
    dot.setAttribute('cx', px); dot.setAttribute('cy', py);
    const bx = Math.min(Math.max(px - 22, 0), W - 44);
    const by = Math.max(0, py - 26);
    box.setAttribute('x', bx); box.setAttribute('y', by);
    text.setAttribute('x', bx + 22); text.setAttribute('y', by + 13);
    text.textContent = fmt(v);
  }
}

customElements.define('fs-sparkline', FsSparkline);
