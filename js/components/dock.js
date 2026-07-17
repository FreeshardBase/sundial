// Bottom dock — the app's menu bar, macOS/GNOME-like placement (one-thumb
// reach on mobile, calm OS dock on desktop). Same design language as the
// design guide's menu bar: hairlines, glyphs, badge left, utilities right.

import { FsElement, esc } from './base.js';
import { icon } from './icons.js';
import { store, shortShardId } from '../store.js';
import { currentRoute, onRouteChange, href, BASE } from '../router.js';
import { openModal } from './modal.js';
import { bindAlt } from '../keynav.js';
import { postQuickFeedback } from '../api/client.js';
import { VERSION } from '../version.js';
import './shard-badge.js';

const NAV = [
  { route: '', label: 'Home', glyph: 'home', key: 'h' },
  { route: 'apps', label: 'Apps', glyph: 'apps', key: 'a' },
  { route: 'terminals', label: 'Devices', glyph: 'devices', key: 'd' },
  { route: 'public', label: 'Public', glyph: 'person', key: 'p' },
  { route: 'settings', label: 'Settings', glyph: 'gear', key: 's' },
];

const HIDDEN_ROUTES = ['welcome', 'pair', 'restart'];

class FsDock extends HTMLElement {
  #unsubs = [];
  #warnTimerDone = false;

  connectedCallback() {
    this.render();
    this.#unsubs.push(
      onRouteChange(() => this.render()),
      store.subscribe(['meta', 'ws', 'version', 'disk_usage'], () => this.render()),
    );
    // WS-disconnect warning only after a 5s grace period (old-app behavior).
    setTimeout(() => { this.#warnTimerDone = true; this.render(); }, 5000);
    for (const item of NAV) {
      bindAlt(item.key, () => this.querySelector(`a[data-route="${item.route}"]`));
    }
    bindAlt('f', () => this.querySelector('.dock-feedback'));
    bindAlt('t', () => this.querySelector('.dock-theme'));
  }

  disconnectedCallback() {
    for (const u of this.#unsubs) u();
  }

  render() {
    const state = store.state;
    if (state.meta.is_anonymous || HIDDEN_ROUTES.includes(currentRoute())) {
      this.innerHTML = '';
      return;
    }
    const active = currentRoute();
    const wsWarn = this.#warnTimerDone && state.ws.disconnectedSince !== null;
    const diskLow = state.disk_usage.disk_space_low;
    const diskWarn = state.disk_usage.disk_space_warning && !diskLow;
    const updateAvail = state.version !== null && state.version !== VERSION;
    const dark = document.documentElement.dataset.theme === 'dark';
    const atSubpath = BASE !== '/';

    this.innerHTML = `
      <nav class="dock" aria-label="Main">
        <a class="dock-badge" href="${href('')}" data-route="" aria-label="Home">
          <fs-shard-badge shard-id="${esc(shortShardId())}"></fs-shard-badge>
        </a>
        <div class="dock-nav">
          ${NAV.map((item) => `
            <a class="dock-item fs-focusable ${active === item.route ? 'dock-item--active' : ''}"
               href="${href(item.route)}" data-route="${item.route}"
               ${active === item.route ? 'aria-current="page"' : ''}>
              <span class="fs-keyhint">${item.key.toUpperCase()}</span>
              ${icon(item.glyph)}
              <span class="dock-label">${item.label}</span>
            </a>`).join('')}
        </div>
        <div class="dock-utils">
          ${wsWarn ? `<span class="dock-status dock-status--warn" title="No connection to Shard, retrying...">${icon('warn')}</span>` : ''}
          ${updateAvail ? `<button class="dock-status dock-update fs-focusable" title="Refresh to update to ${esc(state.version)}">${icon('update')}</button>` : ''}
          ${diskLow ? `<a class="dock-status dock-status--danger fs-focusable" href="${href('settings')}" title="Disk space critically low. All apps are stopped.">${icon('disk')}</a>` : ''}
          ${diskWarn ? `<a class="dock-status dock-status--warn fs-focusable" href="${href('settings')}" title="Disk space is getting low.">${icon('disk')}</a>` : ''}
          <button class="dock-item dock-feedback fs-focusable" title="Feedback">
            <span class="fs-keyhint">F</span>${icon('feedback')}<span class="dock-label">Feedback</span>
          </button>
          <button class="dock-item dock-theme fs-focusable" title="Switch to ${dark ? 'light' : 'dark'} theme">
            <span class="fs-keyhint">T</span>${icon(dark ? 'sun' : 'moon')}
          </button>
          ${atSubpath ? `<a class="dock-item dock-classic fs-focusable" href="/" title="Back to the classic UI">
            <span class="dock-label">Classic UI</span>
          </a>` : ''}
        </div>
      </nav>`;

    this.querySelector('.dock-feedback').addEventListener('click', () => this.openFeedback());
    this.querySelector('.dock-theme').addEventListener('click', () => this.toggleTheme());
    this.querySelector('.dock-update')?.addEventListener('click', () => location.reload());
    this.querySelector('.dock-classic')?.addEventListener('click', () => {
      try { localStorage.setItem('freeshard.ui', 'classic'); } catch { /* ignore */ }
    });
  }

  toggleTheme() {
    const root = document.documentElement;
    const dark = root.dataset.theme === 'dark';
    if (dark) delete root.dataset.theme;
    else root.dataset.theme = 'dark';
    try { localStorage.setItem('sundial.theme', dark ? 'light' : 'dark'); } catch { /* ignore */ }
    this.render();
  }

  openFeedback() {
    const body = document.createElement('div');
    body.innerHTML = `
      <textarea class="fs-input feedback-text" rows="4" placeholder="What's on your mind?"></textarea>
      <p class="muted feedback-note">What you write here is a one-off message for us and
        currently we have no way of responding directly to it. For more elaborate feedback
        or a dialogue, you can <a href="mailto:contact@freeshard.net">write us</a> or visit
        our <a href="https://discord.gg/ZXQDuTGcCf" target="_blank" rel="noopener">Discord</a>.</p>`;
    const footer = document.createElement('div');
    footer.innerHTML = `<button class="fs-btn fs-btn--primary" disabled>Send</button>`;
    const send = footer.querySelector('button');
    const modal = openModal({ title: 'Quick feedback', body, footer });
    const text = body.querySelector('textarea');
    text.addEventListener('input', () => { send.disabled = text.value.length === 0; });
    send.addEventListener('click', async () => {
      send.disabled = true;
      send.textContent = 'Sending…';
      try {
        await postQuickFeedback({ text: text.value });
        send.textContent = '✓ Sent';
        setTimeout(() => modal.close(), 900);
      } catch (e) {
        send.textContent = 'Failed — retry';
        send.disabled = false;
      }
    });
    text.focus();
  }
}

customElements.define('fs-dock', FsDock);
