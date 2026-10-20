// Owner card (top of Settings): the owner's user row, GET/PATCH
// /protected/users/me — not the identity, not the controller profile.
// Name writes through; an email becomes `pending_email` and only goes live
// once the owner opens the mailed link (unless the shard cannot send mail,
// `GET /protected/settings` → email_enabled: false, then it is set directly).

import { FsElement } from './base.js';
import { store } from '../store.js';
import * as api from '../api/client.js';
import { toastSuccess, toastError, errorMessage } from './toast.js';
import { pendingChange } from './pending-change.js';
import { ownerEmailState, isDeliveryFailure } from '../owner-email.js';
import { t } from '../i18n.js';
import './editable-text.js';

function editableField(className, onEdited) {
  const field = document.createElement('fs-editable-text');
  field.className = className;
  field.addEventListener('edited', (e) => onEdited(e.detail));
  return field;
}

class FsOwnerCard extends FsElement {
  #user = null;
  #loadFailed = false;
  #emailEnabled = true;
  // The last PATCH stored the candidate but the confirmation mail did not go out.
  #deliveryFailed = false;
  #busy = false;
  #loaded = false;
  #renderedLocale = null;
  // One instance per field for the card's lifetime, like the card itself in
  // Settings: render() rebuilds the card after every save, resend and discard,
  // and a fresh field would drop an edit in progress in the other one.
  #nameField = editableField('owner-name', (detail) => this.saveName(detail));
  #emailField = editableField('owner-email', (detail) => this.saveEmail(detail));

  connectedCallback() {
    // Settings re-renders its whole tree and re-attaches this same element.
    // A re-attach must neither refetch nor re-render (that would throw away an
    // edit in progress); only the first connect and a language switch render.
    // watch() always adds 'locale' and fires once at once (#renderedLocale is
    // still null then), which is the first render.
    this.watch([], (state) => { if (state.locale !== this.#renderedLocale) this.render(); });
    if (!this.#loaded) {
      this.#loaded = true;
      this.load();
    }
  }

  async load() {
    const [user, settings] = await Promise.allSettled([api.getMe(), api.getSettings()]);
    if (user.status === 'fulfilled') {
      this.#user = user.value;
      this.#loadFailed = false;
      this.#deliveryFailed = false;
    } else {
      console.error('Failed to load the owner row', user.reason?.status ?? user.reason);
      this.#loadFailed = true;
    }
    // An unreadable setting must not blank the card; keep the default (mail on).
    if (settings.status === 'fulfilled') this.#emailEnabled = settings.value.email_enabled !== false;
    this.render();
  }

  render() {
    this.#renderedLocale = store.state.locale;
    const focused = this.contains(document.activeElement) ? document.activeElement : null;
    let body;
    if (this.#loadFailed) {
      body = `<p class="alert alert--warn">${t('settings.owner.loadFailed')}</p>`;
    } else if (!this.#user) {
      body = `<p class="muted"><span class="fs-spinner fs-spinner--sm"></span> ${t('settings.owner.loading')}</p>`;
    } else {
      body = `
        <div class="owner-name-slot"></div>
        <p class="muted owner-hint">${t('settings.owner.nameHint')}</p>
        <div class="owner-email-slot"></div>
        ${this.emailStatus()}`;
    }
    this.innerHTML = `<section class="fs-sheet settings-card owner-card"><h2>${t('settings.owner.title')}</h2>${body}</section>`;
    if (this.#user) {
      this.#nameField.setAttribute('title', t('settings.owner.name'));
      this.#nameField.setAttribute('value', this.#user.display_name);
      this.#emailField.setAttribute('title', t('settings.owner.email'));
      this.#emailField.setAttribute('value', this.#user.email ?? '');
      this.querySelector('.owner-name-slot').replaceWith(this.#nameField);
      this.querySelector('.owner-email-slot').replaceWith(this.#emailField);
    }
    if (focused?.isConnected) focused.focus();
    this.wire();
  }

  emailStatus() {
    const state = ownerEmailState(this.#user);
    const hints = [];
    if (state === 'none') {
      hints.push(`<p class="muted owner-hint" data-email-state="none">${t('settings.owner.noAddress')}${
        this.#emailEnabled ? ` ${t('settings.owner.noAddressPrompt')}` : ''}</p>`);
    }
    if (state === 'pending') {
      const actions = [];
      if (this.#emailEnabled) actions.push({ act: 'resend', label: t('settings.owner.resend'), disabled: this.#busy });
      actions.push({ act: 'discard', label: t('settings.owner.discard'), disabled: this.#busy });
      hints.push(pendingChange({
        label: t('settings.owner.pendingLabel'),
        value: this.#user.pending_email,
        note: `${this.#emailEnabled ? t('settings.owner.pendingNote') : t('settings.owner.pendingNoMail')} ${this.#user.email
          ? t('settings.owner.pendingLive', { email: this.#user.email })
          : t('settings.owner.pendingLiveNone')}`,
        notice: this.#deliveryFailed ? t('settings.owner.deliveryFailed') : '',
        actions,
      }));
    }
    if (!this.#emailEnabled) {
      hints.push(`<p class="muted owner-hint" data-email-state="direct">${t('settings.owner.noVerification')}</p>`);
    }
    return hints.join('');
  }

  wire() {
    this.querySelector('[data-act="resend"]')?.addEventListener('click', () => this.resend());
    this.querySelector('[data-act="discard"]')?.addEventListener('click', () => this.discard());
  }

  async saveName({ value, done }) {
    const name = value.trim();
    if (!name) {
      toastError(t('settings.owner.nameEmpty'));
      done();
      this.render();
      return;
    }
    try {
      this.#user = await api.patchMe({ display_name: name });
    } catch (e) {
      toastError(t('settings.owner.nameFailed'), this.failureText(e, t('settings.owner.nameInvalid')));
    }
    done();
    this.render();
  }

  async saveEmail({ value, done }) {
    const address = value.trim();
    // Unchanged: a PATCH would re-send the confirmation mail and spend the
    // shard's send budget for nothing.
    if (address === (this.#user.email ?? '') && !this.#user.pending_email) {
      done();
      this.render();
      return;
    }
    this.#deliveryFailed = false;
    try {
      // An empty field clears the address; '' itself is rejected by the API.
      this.#user = await api.patchMe({ email: address || null });
      if (ownerEmailState(this.#user) === 'pending') {
        toastSuccess(t('settings.owner.mailSent'), t('settings.owner.mailSentTo', { email: this.#user.pending_email }));
      } else {
        toastSuccess(address ? t('settings.owner.addressSaved') : t('settings.owner.addressRemoved'));
      }
    } catch (e) {
      if (isDeliveryFailure(e)) await this.showStoredCandidate(address);
      else toastError(t('settings.owner.emailFailed'), this.failureText(e, t('settings.owner.emailInvalid')));
    }
    done();
    this.render();
  }

  // 502 with the API's detail: the candidate is on file, only the mail did not
  // go out. Show what is stored (refetched, so it is the normalised form) and
  // say so, with the resend offered — this is not a failed save.
  async showStoredCandidate(address) {
    this.#deliveryFailed = true;
    try {
      this.#user = await api.getMe();
    } catch {
      // Unreadable now: show what was typed. The next load shows the stored form.
      this.#user = { ...this.#user, pending_email: address };
    }
  }

  async resend() {
    this.#busy = true;
    this.render();
    try {
      await api.resendConfirmation();
      this.#deliveryFailed = false;
      toastSuccess(t('settings.owner.mailSent'), t('settings.owner.mailSentTo', { email: this.#user.pending_email }));
    } catch (e) {
      toastError(t('settings.owner.resendFailed'), this.failureText(e));
    }
    this.#busy = false;
    this.render();
  }

  async discard() {
    this.#busy = true;
    this.render();
    try {
      await api.deletePendingEmail();
      this.#deliveryFailed = false;
      // 204 carries no body; the one field it cleared is applied here.
      this.#user = { ...this.#user, pending_email: null };
      toastSuccess(t('settings.owner.discarded'));
    } catch (e) {
      toastError(t('settings.owner.discardFailed'), this.failureText(e));
    }
    this.#busy = false;
    this.render();
  }

  // 403: a member session (only the owner's address is settable). 422: FastAPI's
  // detail is a list of per-field problems, so name it in our own words.
  // 429 and the rest carry a readable detail from shard_core.
  failureText(e, invalidText = null) {
    if (e?.status === 403) return t('settings.owner.notOwner');
    if (e?.status === 422 && invalidText) return invalidText;
    return errorMessage(e);
  }
}

customElements.define('fs-owner-card', FsOwnerCard);
