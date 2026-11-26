// Confirm email — where the link in the confirmation mail lands
// (`/?confirm_email=<token>`; main.js moves it here before the pairing check,
// since the link is usually opened on a device that was never paired).
//
// Confirms only on a click: mail scanners and link prefetchers open links on
// their own, and an automatic POST would let them spend the single-use token.
// POST /public/users/confirm-email tells apart 'unknown' (never a real token),
// 'expired' (was once real, no longer live) and 'confirmed' (just promoted,
// with the address) — see shard_core's TokenStatus for why distinguishing
// 'unknown' from 'expired' is safe to show an unauthenticated caller.

import { FsElement, esc } from '../components/base.js';
import { store, shortShardId } from '../store.js';
import * as api from '../api/client.js';
import { queryUser } from '../actions.js';
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
  #state = 'idle'; // idle | confirming | confirmed | expired | unknown | failed | rate-limited | invalid
  #email = null; // set only by a 'confirmed' result

  connectedCallback() {
    this.watch(['meta'], () => this.render());
  }

  async confirm() {
    this.#state = 'confirming';
    this.render();
    try {
      const result = await api.confirmEmail({ token: this.#token });
      this.#state = result.status; // 'unknown' | 'expired' | 'confirmed'
      this.#email = result.email;
      heldToken = null;
      // On a paired device the shell's owner-email hint is watching store
      // `user`; refresh it so a just-confirmed address clears the hint without
      // a reload. Unpaired devices (the common case) have no row to refresh.
      if (result.status === 'confirmed' && !store.state.meta.is_anonymous) {
        queryUser().catch(() => {});
      }
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
    if (st === 'confirmed') {
      return `<p class="alert alert--info confirm-email__confirmed">${icon('check')} ${t('confirmEmail.confirmed', { email: this.#email })}</p>`;
    }
    if (st === 'expired') {
      return `<p class="alert alert--warn confirm-email__expired">${t('confirmEmail.expired')}</p>`;
    }
    if (st === 'unknown') {
      return `<p class="alert alert--danger confirm-email__unknown">${t('confirmEmail.unknown')}</p>`;
    }
    const busy = st === 'confirming';
    return `
      ${st === 'failed' ? `<p class="alert alert--danger">${t('confirmEmail.failed')}</p>` : ''}
      ${st === 'rate-limited' ? `<p class="alert alert--warn">${t('confirmEmail.rateLimited')}</p>` : ''}
      <p><button class="fs-btn fs-btn--primary fs-focusable" data-act="confirm" ${busy ? 'disabled' : ''}>
        ${busy ? '<span class="fs-spinner fs-spinner--sm"></span>' : icon('check')} ${t('confirmEmail.confirm')}</button></p>`;
  }

  render() {
    document.title = t('title.confirmEmail', { id: shortShardId() });
    // Opened as its own tab from the mail link — once there's nothing left to
    // do here (confirmed, dead token, or no token at all), say so can close it
    // rather than offering a button back into the app it may not even be open in.
    const done = !this.#token || ['invalid', 'confirmed', 'expired', 'unknown'].includes(this.#state);
    this.innerHTML = `
      <div class="center-page confirm-email">
        <h1>${t('confirmEmail.title')}</h1>
        <p>${t('pair.thisShardIs')}</p>
        <fs-shard-badge shard-id="${esc(shortShardId())}"></fs-shard-badge>
        <div class="confirm-email__body">${this.body()}</div>
        ${done ? `<p class="muted confirm-email__close-hint">${t('confirmEmail.closeHint')}</p>` : ''}
      </div>`;
    this.querySelector('[data-act="confirm"]')?.addEventListener('click', () => this.confirm());
  }
}

customElements.define('view-confirm-email', ViewConfirmEmail);
