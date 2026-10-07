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
import { t } from '../i18n.js';
import './shard-badge.js';

const NAV = [
  { route: '', labelKey: 'dock.home', glyph: 'home', key: 'h' },
  { route: 'apps', labelKey: 'dock.apps', glyph: 'apps', key: 'a' },
  { route: 'terminals', labelKey: 'dock.devices', glyph: 'devices', key: 'd' },
  { route: 'public', labelKey: 'dock.public', glyph: 'person', key: 'p' },
  { route: 'settings', labelKey: 'dock.settings', glyph: 'gear', key: 's' },
];

const HIDDEN_ROUTES = ['welcome', 'pair', 'restart'];

class FsDock extends HTMLElement {
  #unsubs = [];
  #warnTimerDone = false;

  connectedCallback() {
    this.render();
    this.#unsubs.push(
      onRouteChange(() => this.render()),
      store.subscribe(['meta', 'ws', 'version', 'disk_usage', 'locale'], () => this.render()),
    );
    // WS-disconnect warning only after a 5s grace period (old-app behavior).
    setTimeout(() => { this.#warnTimerDone = true; this.render(); }, 5000);
    for (const item of NAV) {
      bindAlt(item.key, () => this.querySelector(`a[data-route="${item.route}"]`));
    }
    bindAlt('f', () => this.querySelector('.dock-feedback'));
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
    const atSubpath = BASE !== '/';

    this.innerHTML = `
      <nav class="dock" aria-label="${t('dock.mainNav')}">
        <a class="dock-badge" href="${href('')}" data-route="" aria-label="${t('dock.home')}">
          <fs-shard-badge shard-id="${esc(shortShardId())}"></fs-shard-badge>
        </a>
        <div class="dock-nav">
          ${NAV.map((item) => `
            <a class="dock-item fs-focusable ${active === item.route ? 'dock-item--active' : ''}"
               href="${href(item.route)}" data-route="${item.route}"
               ${active === item.route ? 'aria-current="page"' : ''}>
              <span class="fs-keyhint">${item.key.toUpperCase()}</span>
              ${icon(item.glyph)}
              <span class="dock-label">${t(item.labelKey)}</span>
            </a>`).join('')}
        </div>
        <div class="dock-utils">
          ${wsWarn ? `<span class="dock-status dock-status--warn" title="${t('dock.noConnection')}">${icon('warn')}</span>` : ''}
          ${updateAvail ? `<button class="dock-status dock-update fs-focusable" title="${t('dock.refreshUpdate', { version: state.version })}">${icon('update')}</button>` : ''}
          ${diskLow ? `<a class="dock-status dock-status--danger fs-focusable" href="${href('settings')}" title="${t('dock.diskLow')}">${icon('disk')}</a>` : ''}
          ${diskWarn ? `<a class="dock-status dock-status--warn fs-focusable" href="${href('settings')}" title="${t('dock.diskWarn')}">${icon('disk')}</a>` : ''}
          <button class="dock-item dock-feedback fs-focusable" title="${t('dock.feedback')}">
            <span class="fs-keyhint">F</span>${icon('feedback')}<span class="dock-label">${t('dock.feedback')}</span>
          </button>
          ${atSubpath ? `<a class="dock-item dock-classic fs-focusable" href="/" title="${t('dock.classicTitle')}">
            <span class="dock-label">${t('dock.classic')}</span>
          </a>` : ''}
        </div>
      </nav>`;

    this.querySelector('.dock-feedback').addEventListener('click', () => this.openFeedback());
    this.querySelector('.dock-update')?.addEventListener('click', () => location.reload());
    this.querySelector('.dock-classic')?.addEventListener('click', () => {
      try { localStorage.setItem('freeshard.ui', 'classic'); } catch { /* ignore */ }
    });
  }

  openFeedback() {
    const body = document.createElement('div');
    body.innerHTML = `
      <textarea class="fs-input feedback-text" rows="4" placeholder="${t('feedback.placeholder')}"></textarea>
      <p class="muted feedback-note">${t('feedback.note')}</p>`;
    const footer = document.createElement('div');
    footer.innerHTML = `<button class="fs-btn fs-btn--primary" disabled>${t('feedback.send')}</button>`;
    const send = footer.querySelector('button');
    const modal = openModal({ title: t('feedback.title'), body, footer });
    const text = body.querySelector('textarea');
    text.addEventListener('input', () => { send.disabled = text.value.length === 0; });
    send.addEventListener('click', async () => {
      send.disabled = true;
      send.textContent = t('feedback.sending');
      try {
        await postQuickFeedback({ text: text.value });
        send.textContent = t('feedback.sent');
        setTimeout(() => modal.close(), 900);
      } catch (e) {
        send.textContent = t('feedback.failedRetry');
        send.disabled = false;
      }
    });
    text.focus();
  }
}

customElements.define('fs-dock', FsDock);
