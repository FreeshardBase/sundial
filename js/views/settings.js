// Settings — subscription, disk, backup, size, tours reset, about.

import { FsElement, esc } from '../components/base.js';
import { store, shortShardId } from '../store.js';
import { queryProfile, queryDiskUsage, queryTours } from '../actions.js';
import * as api from '../api/client.js';
import { call } from '../api/client.js';
import { icon } from '../components/icons.js';
import { toastSuccess, toastError, errorMessage } from '../components/toast.js';
import { fillDiskBar, formatRelative } from '../util.js';
import { computeMonthlyPrice, centsToEur } from '../pricing.js';
import { navigate } from '../router.js';
import { onMessage } from '../ws.js';
import { isSafeHttpUrl } from '../sanitize.js';
import { VERSION } from '../version.js';
import { t, fmtNumber, fmtPercent, fmtCurrencyEur, SUPPORTED_LOCALES, setLocale } from '../i18n.js';

const SIZES = ['xs', 's', 'm', 'l', 'xl'];
const INTERSTITIAL_POLL_MS = 3000;
const INTERSTITIAL_TIMEOUT_MS = 60000;

class ViewSettings extends FsElement {
  #backupInfo = { last_report: null };
  #passphrase = null;
  #passphraseOpen = false;
  #backupStatsOpen = false;
  #selectedSize = null;
  #waitingForRestart = false;
  #prune = { inProgress: false, result: '' };
  #subscribing = false;
  #cancelAlert = false;
  #pollTimer = null;
  #pollTimeout = null;
  #pollingTimedOut = false;

  connectedCallback() {
    this.watch(['profile', 'disk_usage', 'meta'], () => this.render());
    this.refreshBackupInfo();
    this._offBackup = onMessage('backup_update', () => this.refreshBackupInfo());

    const params = new URLSearchParams(location.search);
    const sub = params.get('sub');
    if (sub === 'return') {
      const s = store.state.profile?.subscription;
      if (s?.status === 'active') history.replaceState(null, '', location.pathname);
      else this.startPolling();
    } else if (sub === 'cancel') {
      this.#cancelAlert = true;
    }

    if (params.get('section') === 'size') {
      this.after(50, () => this.querySelector('#section-size')?.scrollIntoView({ block: 'center' }));
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._offBackup?.();
    this.stopPolling();
  }

  startPolling() {
    this.stopPolling();
    this.#pollingTimedOut = false;
    this.#pollTimer = setInterval(() => queryProfile().catch(() => {}), INTERSTITIAL_POLL_MS);
    this.#pollTimeout = setTimeout(() => {
      this.#pollingTimedOut = true;
      clearInterval(this.#pollTimer);
      this.#pollTimer = null;
      this.render();
    }, INTERSTITIAL_TIMEOUT_MS);
  }

  stopPolling() {
    if (this.#pollTimer) clearInterval(this.#pollTimer);
    if (this.#pollTimeout) clearTimeout(this.#pollTimeout);
    this.#pollTimer = this.#pollTimeout = null;
  }

  async refreshBackupInfo() {
    try {
      this.#backupInfo = await api.getBackupInfo();
      this.render();
    } catch { /* section renders without info */ }
  }

  subscriptionState() {
    const profile = store.state.profile;
    if (!profile) return null;
    const sub = profile.subscription;
    if (sub?.status === 'active') {
      // WS/refetch converged — stop any interstitial polling.
      this.stopPolling();
      return sub.pending_vm_size ? 'active-pending' : 'active';
    }
    if (sub && ['grace', 'ended'].includes(sub.status)) return 'grace';
    if (new URLSearchParams(location.search).get('sub') === 'return') return 'interstitial';
    return 'trial';
  }

  render() {
    document.title = t('title.settings', { id: shortShardId() });
    const state = store.state;
    const profile = state.profile;
    this.innerHTML = `
      <div class="page-title">
        <h1>${t('settings.title')}</h1>
        <button class="icon-btn fs-focusable" data-act="refresh" aria-label="${t('common.refresh')}">${icon('refresh')}</button>
      </div>
      ${profile === null ? `<p class="alert alert--warn">${t('settings.profileUnavailable')}</p>` : ''}
      <div class="settings-grid">
        ${profile ? this.subscriptionCard() : ''}
        ${this.diskCard()}
        ${this.backupCard()}
        ${profile ? this.sizeCard() : ''}
        ${this.appearanceCard()}
        ${this.languageCard()}
        ${this.tourCard()}
      </div>
      <h1 class="settings-about-title">${t('settings.about.title')}</h1>
      <div class="about-fields">${this.aboutFields()}</div>`;

    fillDiskBar(this.querySelector('.disk-bar__fill'), state.disk_usage);
    this.wire();
  }

  // ---- cards ----

  subscriptionCard() {
    const profile = store.state.profile;
    const sub = profile.subscription;
    const st = this.subscriptionState();
    let body = '';
    if (st === 'trial') {
      body = `
        ${this.#cancelAlert ? `<p class="alert alert--warn">${t('settings.sub.cancelled')} <button class="icon-btn" data-act="dismiss-cancel">${icon('x')}</button></p>` : ''}
        ${profile.delete_after
          ? `<p>${t('settings.sub.willBeDeleted', { when: `<b>${esc(formatRelative(profile.delete_after))}</b>` })}</p>`
          : `<p>${t('settings.sub.subscribeToKeep')}</p>`}
        <p><button class="fs-btn fs-btn--primary" data-act="subscribe" ${this.#subscribing ? 'disabled' : ''}>
          ${this.#subscribing ? '<span class="fs-spinner fs-spinner--sm"></span>' : ''}${this.subscribeLabel()}</button></p>`;
    } else if (st === 'interstitial') {
      body = `
        <p><span class="fs-spinner fs-spinner--sm"></span> ${t('settings.sub.activating')}</p>
        ${this.#pollingTimedOut ? `<p><button class="fs-btn" data-act="refresh">${icon('refresh')} ${t('common.refresh')}</button></p>` : ''}`;
    } else if (st === 'active' || st === 'active-pending') {
      body = `
        <p>${t('settings.sub.plan', { size: `<b>${esc(profile.vm_size.toUpperCase())}</b>`, price: fmtCurrencyEur(centsToEur(sub.price_cents)) })}</p>
        ${sub.next_billing_date ? `<p>${t('settings.sub.nextCharge', { when: formatRelative(sub.next_billing_date) })}</p>` : ''}
        ${sub.payer_email ? `<p class="muted">${t('settings.sub.billedTo', { email: sub.payer_email })}</p>` : ''}
        ${st === 'active-pending' ? `<p class="alert alert--info">${t('settings.sub.upgradePending', { size: `<b>${esc(sub.pending_vm_size.toUpperCase())}</b>`, price: fmtCurrencyEur(centsToEur(sub.pending_price_cents)) })}</p>` : ''}
        <p>${isSafeHttpUrl(sub.paypal_manage_url)
          ? `<a class="fs-btn" href="${esc(sub.paypal_manage_url)}" target="_blank" rel="noopener">${t('settings.sub.managePaypal')}</a>`
          : `<button class="fs-btn" disabled>${t('settings.sub.managePaypal')}</button>`}</p>`;
    } else if (st === 'grace') {
      body = `
        ${sub.last_payment_failed_at ? `<p>${t('settings.sub.paymentFailed', { when: formatRelative(sub.last_payment_failed_at) })}</p>`
          : sub.ended ? `<p>${t('settings.sub.ended', { when: formatRelative(sub.ended) })}</p>`
          : `<p>${t('settings.sub.inactive')}</p>`}
        ${profile.delete_after ? `<p>${t('settings.sub.willStop', { when: `<b>${esc(formatRelative(profile.delete_after))}</b>` })}</p>` : ''}
        <p><button class="fs-btn fs-btn--primary" data-act="subscribe" ${this.#subscribing ? 'disabled' : ''}>
          ${this.#subscribing ? '<span class="fs-spinner fs-spinner--sm"></span>' : ''}${this.subscribeLabel()}</button></p>`;
    }
    return `<section class="fs-sheet settings-card"><h2>${t('settings.sub.title')}</h2>${body}</section>`;
  }

  subscribeLabel() {
    const profile = store.state.profile;
    const sub = profile?.subscription;
    const key = sub && ['grace', 'ended'].includes(sub.status) ? 'settings.sub.reactivate' : 'settings.sub.subscribe';
    const price = computeMonthlyPrice(profile?.vm_size, profile?.volume_size_gb);
    return t(key, { price: fmtCurrencyEur(price) });
  }

  diskCard() {
    const du = store.state.disk_usage;
    const used = du.total_gb - du.free_gb;
    const ratio = du.total_gb > 0 ? used / du.total_gb : 0;
    const gb = (v) => fmtNumber(v, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `
      <section class="fs-sheet settings-card"><h2>${t('settings.disk.title')}</h2>
        <div class="disk-bar" role="img" aria-label="${t('settings.disk.usedLabel', { pct: fmtPercent(ratio) })}">
          <div class="disk-bar__fill"></div>
        </div>
        <p class="mono">${t('settings.disk.usage', { used: gb(used), total: gb(du.total_gb), pct: fmtPercent(ratio) })}</p>
        ${du.disk_space_low ? `<p class="alert alert--danger">${icon('disk')} ${t('settings.disk.low')}</p>` : ''}
        ${du.disk_space_warning && !du.disk_space_low ? `<p class="alert alert--warn">${icon('disk')} ${t('settings.disk.warning')}</p>` : ''}
        <hr class="hairline">
        <p class="muted">${t('settings.disk.pruneNote')}</p>
        <p><button class="fs-btn" data-act="prune" ${this.#prune.inProgress ? 'disabled' : ''}>
          ${this.#prune.inProgress ? '<span class="fs-spinner fs-spinner--sm"></span>' : icon('trash')} ${t('settings.disk.prune')}</button>
          <span class="muted">${esc(this.#prune.result)}</span></p>
      </section>`;
  }

  backupCard() {
    const info = this.#backupInfo;
    return `
      <section class="fs-sheet settings-card"><h2>${t('settings.backup.title')}</h2>
        <p class="muted">${t('settings.backup.nightly')}</p>
        <p class="muted">${t('settings.backup.selfService')}</p>
        <p>
          <button class="fs-btn" data-act="toggle-backup-stats">${t('settings.backup.showStats')}</button>
          <button class="fs-btn" data-act="start-backup">${t('settings.backup.startNow')}</button>
        </p>
        ${this.#backupStatsOpen ? `<pre class="mono backup-report">${esc(info.last_report || t('settings.backup.noneYet'))}</pre>` : ''}
        <hr class="hairline">
        <p class="muted">${t('settings.backup.passphraseNote')}</p>
        ${!info.last_passphrase_access_info ? `<p class="alert alert--danger">${icon('warn')} ${t('settings.backup.neverViewed')}</p>` : ''}
        <p><button class="fs-btn" data-act="toggle-passphrase">${t('settings.backup.reveal')}</button></p>
        ${this.#passphraseOpen ? `
          <div class="alert alert--warn passphrase-box">
            <p>${t('settings.backup.sensitive')}</p>
            ${this.#passphrase
              ? `<p>${t('settings.backup.yourPassphrase')}</p><p class="mono passphrase-value">${esc(this.#passphrase)}</p>`
              : `<button class="fs-btn" data-act="fetch-passphrase">${t('settings.backup.revealNow')}</button>`}
            ${info.last_passphrase_access_info ? `<p class="muted">${t('settings.backup.lastRevealed', {
              when: formatRelative(info.last_passphrase_access_info.time),
              name: info.last_passphrase_access_info.terminal_name,
              id: info.last_passphrase_access_info.terminal_id,
            })}</p>` : ''}
          </div>` : ''}
      </section>`;
  }

  sizeCard() {
    const profile = store.state.profile;
    const pending = Boolean(profile.subscription?.pending_vm_size);
    const available = (s) =>
      profile.max_vm_size !== undefined
      && SIZES.indexOf(s) <= SIZES.indexOf(profile.max_vm_size)
      && s !== profile.vm_size;
    return `
      <section class="fs-sheet settings-card" id="section-size"><h2>${t('settings.size.title')}</h2>
        <p class="muted">${t('settings.size.note')}</p>
        <p class="muted">${t('settings.size.unlock')}</p>
        <div class="size-picker">
          ${SIZES.map((s) => `
            <button class="fs-btn size-btn
                ${s === profile.vm_size ? 'size-btn--current' : ''}
                ${s === this.#selectedSize ? 'size-btn--selected' : ''}"
              data-size="${s}"
              ${!available(s) || this.#waitingForRestart || pending ? 'disabled' : ''}>${s.toUpperCase()}</button>`).join('')}
        </div>
        ${this.#selectedSize ? `
          <p>
            <button class="fs-btn fs-btn--primary" data-act="resize" ${this.#waitingForRestart ? 'disabled' : ''}>
              ${icon('refresh')} ${t('settings.size.resize', { size: this.#selectedSize.toUpperCase() })}</button>
            <button class="fs-btn fs-btn--danger" data-act="cancel-resize" ${this.#waitingForRestart ? 'disabled' : ''}>
              ${icon('x')} ${t('common.cancel')}</button>
          </p>` : ''}
        ${pending ? `<p class="muted">${t('settings.size.pending')}</p>` : ''}
      </section>`;
  }

  appearanceCard() {
    const dark = document.documentElement.dataset.theme === 'dark';
    return `
      <section class="fs-sheet settings-card"><h2>${t('settings.appearance.title')}</h2>
        <p class="muted">${t('settings.appearance.note')}</p>
        <div class="toggle-row">
          ${icon(dark ? 'moon' : 'sun')}
          <span class="toggle-row__label">${t('settings.appearance.darkMode')}</span>
          <button class="fs-toggle fs-focusable" role="switch" aria-checked="${dark}"
            aria-label="${t('settings.appearance.darkMode')}" data-act="toggle-theme">
            <span class="fs-toggle__knob"></span>
          </button>
        </div>
      </section>`;
  }

  languageCard() {
    const current = store.state.locale;
    return `
      <section class="fs-sheet settings-card"><h2>${t('settings.language.title')}</h2>
        <p class="muted">${t('settings.language.note')}</p>
        <div class="size-picker">
          ${SUPPORTED_LOCALES.map((loc) => `
            <button class="fs-btn size-btn ${loc === current ? 'size-btn--current' : ''}"
              data-locale="${loc}" ${loc === current ? 'disabled' : ''}>${t(`settings.language.${loc}`)}</button>`).join('')}
        </div>
      </section>`;
  }

  tourCard() {
    return `
      <section class="fs-sheet settings-card"><h2>${t('settings.tours.title')}</h2>
        <p class="muted">${t('settings.tours.note')}</p>
        <p><button class="fs-btn" data-act="reset-tours">${icon('left')} ${t('settings.tours.reset')}</button></p>
      </section>`;
  }

  toggleTheme() {
    const root = document.documentElement;
    const dark = root.dataset.theme === 'dark';
    if (dark) delete root.dataset.theme;
    else root.dataset.theme = 'dark';
    try { localStorage.setItem('sundial.theme', dark ? 'light' : 'dark'); } catch { /* ignore */ }
    this.render();
  }

  aboutFields() {
    const state = store.state;
    const profile = state.profile;
    const id = state.meta.identity.id;
    const wrapped = id.match(/.{1,16}/g)?.join('\n') ?? '';
    const field = (title, content, mono = false) => `
      <div class="about-field">
        <span class="fs-label">${title}</span>
        <p class="${mono ? 'mono about-pre' : ''}">${content}</p>
      </div>`;
    const unknown = t('common.unknown');
    return [
      profile ? field(t('settings.about.machineId'), esc(profile.vm_id || unknown), true) : '',
      field(t('settings.about.shardId'), esc(wrapped || unknown), true),
      profile ? field(t('settings.about.owner'), esc(profile.owner || unknown)) : '',
      profile ? field(t('settings.about.ownerEmail'), esc(profile.owner_email || unknown)) : '',
      profile ? field(t('settings.about.created'), profile.time_created ? formatRelative(profile.time_created) : unknown) : '',
      profile ? field(t('settings.about.assigned'), profile.time_assigned ? formatRelative(profile.time_assigned) : unknown) : '',
      profile ? field(t('settings.about.scheduledDelete'), profile.delete_after ? formatRelative(profile.delete_after) : t('settings.about.never')) : '',
      field(t('settings.about.uiVersion'), `${esc(VERSION)} (Sundial)`),
      field(t('settings.about.publicKey'), esc(state.meta.identity.public_key_pem || unknown), true),
    ].join('');
  }

  // ---- wiring ----

  wire() {
    const act = (name, fn) =>
      this.querySelectorAll(`[data-act="${name}"]`).forEach((b) => b.addEventListener('click', fn));

    act('refresh', async () => {
      try { await queryProfile({ refresh: true }); } catch (e) { toastError(t('toast.loadError'), errorMessage(e)); }
      queryDiskUsage().catch(() => {});
      this.refreshBackupInfo();
    });
    act('dismiss-cancel', () => {
      this.#cancelAlert = false;
      history.replaceState(null, '', location.pathname);
      this.render();
    });
    act('subscribe', async () => {
      this.#subscribing = true;
      this.render();
      try {
        const res = await call('POST', '/protected/management/api/shards/self/subscribe');
        const data = res instanceof Response ? await res.json().catch(() => null) : res;
        if (isSafeHttpUrl(data?.approval_url)) { location = data.approval_url; return; }
        toastError(t('toast.subError'), t('toast.noApprovalUrl'));
      } catch (e) {
        toastError(t('toast.subError'), errorMessage(e));
      } finally {
        this.#subscribing = false;
        this.render();
      }
    });
    act('prune', async () => {
      this.#prune = { inProgress: true, result: '' };
      this.render();
      try {
        const res = await api.pruneImages();
        this.#prune = { inProgress: false, result: res.message || t('settings.disk.pruneDone') };
      } catch {
        this.#prune = { inProgress: false, result: t('settings.disk.pruneError') };
      }
      this.render();
    });
    act('toggle-backup-stats', () => { this.#backupStatsOpen = !this.#backupStatsOpen; this.render(); });
    act('start-backup', async () => {
      try {
        await api.startBackup();
        toastSuccess(t('toast.backupStarted'));
      } catch (e) {
        toastError(t('toast.backupStartError'), errorMessage(e));
      }
      this.refreshBackupInfo();
    });
    act('toggle-passphrase', () => { this.#passphraseOpen = !this.#passphraseOpen; this.render(); });
    act('fetch-passphrase', async () => {
      try {
        const res = await api.getBackupPassphrase();
        this.#passphrase = res.passphrase;
      } catch (e) {
        toastError(t('toast.loadError'), errorMessage(e));
      }
      this.refreshBackupInfo();
    });
    act('reset-tours', async () => {
      try {
        await api.resetTours();
        toastSuccess(t('toast.toursReset'));
      } catch (e) {
        toastError(t('toast.resetError'), errorMessage(e));
      }
      queryTours().catch(() => {});
    });
    act('resize', async () => {
      this.#waitingForRestart = true;
      this.render();
      try {
        const res = await call('POST', '/protected/management/api/shards/self/resize',
          { json: { new_vm_size: this.#selectedSize } });
        const data = res instanceof Response ? await res.json().catch(() => null) : res;
        if (isSafeHttpUrl(data?.approval_url)) { location = data.approval_url; return; }
        navigate('restart', { replace: true });
        return;
      } catch (e) {
        toastError(t('toast.resizeError'), errorMessage(e));
        queryProfile({ refresh: true }).catch(() => {});
      } finally {
        this.#waitingForRestart = false;
      }
      this.render();
    });
    act('cancel-resize', () => { this.#selectedSize = null; this.render(); });
    act('toggle-theme', () => this.toggleTheme());
    this.querySelectorAll('.size-btn[data-size]').forEach((b) =>
      b.addEventListener('click', () => { this.#selectedSize = b.dataset.size; this.render(); }));
    this.querySelectorAll('[data-locale]').forEach((b) =>
      b.addEventListener('click', () => setLocale(b.dataset.locale)));
  }
}

customElements.define('view-settings', ViewSettings);
