// Persistent "new version available" notice. The dock used to carry this as
// a small icon-only button (hover tooltip, invisible on touch, easy to miss
// in a row of other small icons). This is the loud version: visible text +
// a visible Refresh button, sticky across the whole app shell regardless of
// route, and — unlike a toast — it does not auto-dismiss. A missed toast
// means the user still doesn't know to refresh; this stays until they act.

import { store } from '../store.js';
import { VERSION } from '../version.js';
import { t } from '../i18n.js';

class FsUpdateBanner extends HTMLElement {
  #unsub;

  connectedCallback() {
    this.render();
    this.#unsub = store.subscribe(['version', 'locale'], () => this.render());
  }

  disconnectedCallback() {
    this.#unsub?.();
  }

  render() {
    const { version } = store.state;
    const updateAvailable = version !== null && version !== VERSION;
    if (!updateAvailable) {
      this.innerHTML = '';
      return;
    }
    this.innerHTML = `
      <div class="update-banner" role="status">
        <span class="update-banner__text">${t('update.available', { version })}</span>
        <button class="fs-btn fs-btn--primary update-banner__refresh">${t('common.refresh')}</button>
      </div>`;
    this.querySelector('.update-banner__refresh').addEventListener('click', () => location.reload());
  }
}

customElements.define('fs-update-banner', FsUpdateBanner);
