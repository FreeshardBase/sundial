// Persistent, app-wide hint shown while the owner has no verified email
// address (`email` null in GET /protected/users/me). Settings' Owner card
// already shows the address state on its own page; this carries the one
// consequence that reaches past Settings: an app that matches the owner's
// login by email cannot sign them in without a verified address. Sticky across
// every route and not dismissable — it goes away only once the address is
// verified (store `user` refreshed).
//
// Two variants, on the same split as the Owner card:
//   pending — a confirmable candidate is on file: point at the inbox, offer
//             resend.
//   none    — no address to confirm: link to the Owner card to add one.
// A pending candidate only counts when the shard can send mail: a self-hosted
// shard (mail disabled) sets the address directly and confirms nothing, so any
// leftover candidate is unconfirmable and the owner sees the "none" variant —
// which is where they can discard it and set an address directly.

import { store } from '../store.js';
import * as api from '../api/client.js';
import { toastSuccess, toastError, errorMessage } from './toast.js';
import { href } from '../router.js';
import { t } from '../i18n.js';

class FsOwnerEmailBanner extends HTMLElement {
  #unsub;
  #busy = false;

  connectedCallback() {
    this.render();
    this.#unsub = store.subscribe(['user', 'email_enabled', 'locale'], () => this.render());
  }

  disconnectedCallback() {
    this.#unsub?.();
  }

  render() {
    const user = store.state.user;
    // Only the owner, and only while unverified. A verified address (`email`
    // set) or a non-owner session shows nothing.
    if (!user || user.role !== 'owner' || user.email) {
      this.innerHTML = '';
      return;
    }
    // A candidate is only confirmable while the shard can send mail; otherwise
    // there is nothing to resend and the owner must add an address instead.
    const pending = Boolean(user.pending_email) && store.state.email_enabled;
    const action = pending
      ? `<button class="fs-btn owner-email-banner__action" data-act="resend" ${this.#busy ? 'disabled' : ''}>${t('settings.owner.resend')}</button>`
      : `<a class="fs-btn owner-email-banner__action" href="${href('settings', 'section=owner')}">${t('ownerEmailBanner.add')}</a>`;
    const text = pending
      ? t('ownerEmailBanner.pending', { email: user.pending_email })
      : t('ownerEmailBanner.none');
    this.innerHTML = `
      <div class="owner-email-banner" role="status">
        <span class="owner-email-banner__text">${text}</span>
        ${action}
      </div>`;
    this.querySelector('[data-act="resend"]')?.addEventListener('click', () => this.resend());
  }

  async resend() {
    this.#busy = true;
    this.render();
    try {
      await api.resendConfirmation();
      toastSuccess(t('settings.owner.mailSent'), t('settings.owner.mailSentTo', { email: store.state.user.pending_email }));
    } catch (e) {
      toastError(t('settings.owner.resendFailed'), errorMessage(e));
    }
    this.#busy = false;
    this.render();
  }
}

customElements.define('fs-owner-email-banner', FsOwnerEmailBanner);
