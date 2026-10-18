// Confirm email — where the link in the confirmation mail lands
// (`/?confirm_email=<token>`; main.js moves it here before the pairing check,
// since the link is usually opened on a device that was never paired).
//
// Confirms only on a click: mail scanners and link prefetchers open links on
// their own, and an automatic POST would let them spend the single-use token.
// POST /public/users/confirm-email answers 204 whether or not the token
// matched (so nobody can probe for pending addresses), hence the hedged copy.

import { FsElement, esc } from '../components/base.js';
import { store, shortShardId } from '../store.js';
import * as api from '../api/client.js';
import { href } from '../router.js';
import { icon } from '../components/icons.js';
import { t } from '../i18n.js';
import '../components/shard-badge.js';

// Handed over by main.js after it strips the token from the URL. Module state,
// not the store: it is a credential and nothing else needs to see it.
let heldToken = null;
export function holdConfirmToken(token) {
  heldToken = token;
}

class ViewConfirmEmail extends FsElement {
  #token = heldToken;
  #state = 'idle'; // idle | confirming | sent | failed | rate-limited

  connectedCallback() {
    this.watch(['meta'], () => this.render());
  }

  async confirm() {
    this.#state = 'confirming';
    this.render();
    try {
      await api.confirmEmail({ token: this.#token });
      this.#state = 'sent';
      heldToken = null;
    } catch (e) {
      // The status only: the error never carries the token, but keep it that way.
      console.error('Email confirmation request failed', e?.status ?? 'network');
      this.#state = e?.status === 429 ? 'rate-limited'
        : e?.status === 422 ? 'invalid'
        : 'failed';
    }
    this.render();
  }

  body() {
    const st = this.#state;
    if (!this.#token || st === 'invalid') {
      return `<p class="alert alert--danger confirm-email__invalid">${t('confirmEmail.invalid')}</p>`;
    }
    if (st === 'sent') {
      return `
        <p class="alert alert--info confirm-email__sent">${t('confirmEmail.sent')}</p>
        <p class="muted">${t('confirmEmail.sentHint')}</p>`;
    }
    const busy = st === 'confirming';
    return `
      <p>${t('confirmEmail.intro')}</p>
      ${st === 'failed' ? `<p class="alert alert--danger">${t('confirmEmail.failed')}</p>` : ''}
      ${st === 'rate-limited' ? `<p class="alert alert--warn">${t('confirmEmail.rateLimited')}</p>` : ''}
      <p><button class="fs-btn fs-btn--primary fs-focusable" data-act="confirm" ${busy ? 'disabled' : ''}>
        ${busy ? '<span class="fs-spinner fs-spinner--sm"></span>' : icon('check')} ${t('confirmEmail.confirm')}</button></p>`;
  }

  render() {
    document.title = t('title.confirmEmail', { id: shortShardId() });
    // A never-paired device has no use for the app grid.
    const onward = store.state.meta.is_anonymous ? href('welcome') : href('');
    this.innerHTML = `
      <div class="center-page confirm-email">
        <h1>${t('confirmEmail.title')}</h1>
        <p>${t('pair.thisShardIs')}</p>
        <fs-shard-badge shard-id="${esc(shortShardId())}"></fs-shard-badge>
        <div class="confirm-email__body">${this.body()}</div>
        <a class="fs-btn fs-focusable confirm-email__continue" href="${onward}">${t('confirmEmail.continue')}</a>
      </div>`;
    this.querySelector('[data-act="confirm"]')?.addEventListener('click', () => this.confirm());
  }
}

customElements.define('view-confirm-email', ViewConfirmEmail);
