// Settings — subscription, disk, backup, size, tours reset, about.

import { FsElement, esc } from '../components/base.js';
import { store, shortShardId } from '../store.js';
import { queryProfile, queryDiskUsage, queryTours } from '../actions.js';
import * as api from '../api/client.js';
import { call } from '../api/client.js';
import { icon } from '../components/icons.js';
import { toastSuccess, toastError, errorMessage } from '../components/toast.js';
import { formatRelative } from '../util.js';
import { computeMonthlyPrice, formatPrice, centsToEur } from '../pricing.js';
import { navigate } from '../router.js';
import { onMessage } from '../ws.js';
import { VERSION } from '../version.js';

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
    document.title = `Shard [${shortShardId()}] - Settings`;
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
    const state = store.state;
    const profile = state.profile;
    this.innerHTML = `
      <div class="page-title">
        <h1>Settings</h1>
        <button class="icon-btn fs-focusable" data-act="refresh" aria-label="Refresh">${icon('refresh')}</button>
      </div>
      ${profile === null ? `<p class="alert alert--warn">Some of this Shard's metadata could not be loaded, so some settings are not available.</p>` : ''}
      <div class="settings-grid">
        ${profile ? this.subscriptionCard() : ''}
        ${this.diskCard()}
        ${this.backupCard()}
        ${profile ? this.sizeCard() : ''}
        ${this.tourCard()}
      </div>
      <h1 class="settings-about-title">About</h1>
      <div class="about-fields">${this.aboutFields()}</div>`;

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
        ${this.#cancelAlert ? `<p class="alert alert--warn">Subscription was cancelled. You can subscribe again any time. <button class="icon-btn" data-act="dismiss-cancel">${icon('x')}</button></p>` : ''}
        ${profile.delete_after
          ? `<p>Your shard will be deleted <b>${formatRelative(profile.delete_after)}</b>.</p>`
          : '<p>Subscribe to keep your shard running.</p>'}
        <p><button class="fs-btn fs-btn--primary" data-act="subscribe" ${this.#subscribing ? 'disabled' : ''}>
          ${this.#subscribing ? '<span class="fs-spinner fs-spinner--sm"></span>' : ''}${this.subscribeLabel()}</button></p>`;
    } else if (st === 'interstitial') {
      body = `
        <p><span class="fs-spinner fs-spinner--sm"></span> Activating subscription…</p>
        ${this.#pollingTimedOut ? `<p><button class="fs-btn" data-act="refresh">${icon('refresh')} Refresh</button></p>` : ''}`;
    } else if (st === 'active' || st === 'active-pending') {
      body = `
        <p>Plan: <b>${esc(profile.vm_size.toUpperCase())}</b> — ${formatPrice(centsToEur(sub.price_cents))}/month</p>
        ${sub.next_billing_date ? `<p>Next charge ${formatRelative(sub.next_billing_date)}.</p>` : ''}
        ${sub.payer_email ? `<p class="muted">Billed to ${esc(sub.payer_email)}.</p>` : ''}
        ${st === 'active-pending' ? `<p class="alert alert--info">Upgrade pending: <b>${esc(sub.pending_vm_size.toUpperCase())}</b> at ${formatPrice(centsToEur(sub.pending_price_cents))}/month.</p>` : ''}
        <p>${sub.paypal_manage_url
          ? `<a class="fs-btn" href="${esc(sub.paypal_manage_url)}" target="_blank" rel="noopener">Manage on PayPal</a>`
          : '<button class="fs-btn" disabled>Manage on PayPal</button>'}</p>`;
    } else if (st === 'grace') {
      body = `
        ${sub.last_payment_failed_at ? `<p>Payment failed ${formatRelative(sub.last_payment_failed_at)}.</p>`
          : sub.ended ? `<p>Subscription ended ${formatRelative(sub.ended)}.</p>`
          : '<p>Subscription is no longer active.</p>'}
        ${profile.delete_after ? `<p>Your shard will stop <b>${formatRelative(profile.delete_after)}</b>.</p>` : ''}
        <p><button class="fs-btn fs-btn--primary" data-act="subscribe" ${this.#subscribing ? 'disabled' : ''}>
          ${this.#subscribing ? '<span class="fs-spinner fs-spinner--sm"></span>' : ''}${this.subscribeLabel()}</button></p>`;
    }
    return `<section class="fs-sheet settings-card"><h2>Subscription</h2>${body}</section>`;
  }

  subscribeLabel() {
    const profile = store.state.profile;
    const sub = profile?.subscription;
    const verb = sub && ['grace', 'ended'].includes(sub.status) ? 'Reactivate' : 'Subscribe';
    const price = computeMonthlyPrice(profile?.vm_size, profile?.volume_size_gb);
    return `${verb} — ${formatPrice(price)}/month`;
  }

  diskCard() {
    const du = store.state.disk_usage;
    const used = du.total_gb - du.free_gb;
    const ratio = du.total_gb > 0 ? used / du.total_gb : 0;
    const tone = du.disk_space_low ? 'var(--danger)' : du.disk_space_warning ? 'var(--accent)' : 'var(--data)';
    return `
      <section class="fs-sheet settings-card"><h2>Disk space</h2>
        <div class="disk-bar" role="img" aria-label="${(ratio * 100).toFixed(1)}% used">
          <div class="disk-bar__fill" style="width:${(ratio * 100).toFixed(2)}%;background:${tone}"></div>
        </div>
        <p class="mono">${used.toFixed(2)} GiB of ${du.total_gb.toFixed(2)} GiB used · ${(ratio * 100).toFixed(1)}%</p>
        ${du.disk_space_low ? `<p class="alert alert--danger">${icon('disk')} Disk space critically low. All apps are stopped. Please upgrade your disk space or <a href="mailto:contact@freeshard.net">contact us</a> for help.</p>` : ''}
        ${du.disk_space_warning && !du.disk_space_low ? `<p class="alert alert--warn">${icon('disk')} Disk space is getting low. If it gets critical, all apps will be stopped to prevent data loss. You should prune unused data or upgrade your disk space.</p>` : ''}
        <hr class="hairline">
        <p class="muted">Prune unused data in order to free up disk space. This is also done automatically every night.</p>
        <p><button class="fs-btn" data-act="prune" ${this.#prune.inProgress ? 'disabled' : ''}>
          ${this.#prune.inProgress ? '<span class="fs-spinner fs-spinner--sm"></span>' : icon('trash')} Prune</button>
          <span class="muted">${esc(this.#prune.result)}</span></p>
      </section>`;
  }

  backupCard() {
    const info = this.#backupInfo;
    return `
      <section class="fs-sheet settings-card"><h2>Backup</h2>
        <p class="muted">A backup is done automatically every night. New backups overwrite the old ones.
          Even after your Shard is deleted, you can still access your backups.</p>
        <p class="muted">We are currently working on self-service access to your backups. Until then, please
          <a href="mailto:contact@freeshard.net">contact us</a> if you need access, so we can guide you through the process.</p>
        <p>
          <button class="fs-btn" data-act="toggle-backup-stats">Show latest backup stats</button>
          <button class="fs-btn" data-act="start-backup">Start backup now</button>
        </p>
        ${this.#backupStatsOpen ? `<pre class="mono backup-report">${esc(info.last_report || 'No backup was done yet.')}</pre>` : ''}
        <hr class="hairline">
        <p class="muted">Backups are encrypted on this Shard before being sent to the backup server.
          The encryption key is your personal passphrase. In order to access your backups later, it is
          essential to <b>write down your passphrase</b>. If you lose it, you will not be able to access
          your backups. There is no other way to recover them.</p>
        ${!info.last_passphrase_access_info ? `<p class="alert alert--danger">${icon('warn')} You have never viewed your passphrase. Please write it down as soon as possible.</p>` : ''}
        <p><button class="fs-btn" data-act="toggle-passphrase">Reveal passphrase</button></p>
        ${this.#passphraseOpen ? `
          <div class="alert alert--warn passphrase-box">
            <p>This is very sensitive information. Make sure no one else is watching!</p>
            ${this.#passphrase
              ? `<p>Your passphrase:</p><p class="mono passphrase-value">${esc(this.#passphrase)}</p>`
              : `<button class="fs-btn" data-act="fetch-passphrase">Reveal now</button>`}
            ${info.last_passphrase_access_info ? `<p class="muted">Your passphrase was last revealed
              ${formatRelative(info.last_passphrase_access_info.time)} from device
              <i>${esc(info.last_passphrase_access_info.terminal_name)}</i>
              (ID: ${esc(info.last_passphrase_access_info.terminal_id)}).</p>` : ''}
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
      <section class="fs-sheet settings-card" id="section-size"><h2>Size</h2>
        <p class="muted">Change the size of your Shard. This sets the number of CPUs and the amount of
          RAM your Shard can use.</p>
        <p class="muted">To unlock larger sizes, please <a href="mailto:contact@freeshard.net">contact us</a>.</p>
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
              ${icon('refresh')} Resize to ${this.#selectedSize.toUpperCase()} and restart</button>
            <button class="fs-btn fs-btn--danger" data-act="cancel-resize" ${this.#waitingForRestart ? 'disabled' : ''}>
              ${icon('x')} Cancel</button>
          </p>` : ''}
        ${pending ? '<p class="muted">A size change is already pending; new resizes are disabled until it completes.</p>' : ''}
      </section>`;
  }

  tourCard() {
    return `
      <section class="fs-sheet settings-card"><h2>Reset welcome screen</h2>
        <p class="muted">Reset the welcome screen so you can look at it again.</p>
        <p><button class="fs-btn" data-act="reset-tours">${icon('left')} Reset</button></p>
      </section>`;
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
    return [
      profile ? field('Machine ID', esc(profile.vm_id || 'unknown'), true) : '',
      field('Shard ID', esc(wrapped || 'unknown'), true),
      profile ? field('Owner', esc(profile.owner || 'unknown')) : '',
      profile ? field('Owner email', esc(profile.owner_email || 'unknown')) : '',
      profile ? field('Created', profile.time_created ? formatRelative(profile.time_created) : 'unknown') : '',
      profile ? field('Assigned', profile.time_assigned ? formatRelative(profile.time_assigned) : 'unknown') : '',
      profile ? field('Scheduled to delete', profile.delete_after ? formatRelative(profile.delete_after) : 'never') : '',
      field('UI version', `${esc(VERSION)} (Sundial)`),
      field('Public key', esc(state.meta.identity.public_key_pem || 'unknown'), true),
    ].join('');
  }

  // ---- wiring ----

  wire() {
    const act = (name, fn) =>
      this.querySelectorAll(`[data-act="${name}"]`).forEach((b) => b.addEventListener('click', fn));

    act('refresh', async () => {
      try { await queryProfile({ refresh: true }); } catch (e) { toastError('Error during loading', errorMessage(e)); }
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
        if (data?.approval_url) { location = data.approval_url; return; }
        toastError('Subscription error', 'No approval URL returned.');
      } catch (e) {
        toastError('Subscription error', errorMessage(e));
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
        this.#prune = { inProgress: false, result: res.message || 'Done' };
      } catch {
        this.#prune = { inProgress: false, result: 'Error during pruning' };
      }
      this.render();
    });
    act('toggle-backup-stats', () => { this.#backupStatsOpen = !this.#backupStatsOpen; this.render(); });
    act('start-backup', async () => {
      try {
        await api.startBackup();
        toastSuccess('Backup started.');
      } catch (e) {
        toastError('Error during starting', errorMessage(e));
      }
      this.refreshBackupInfo();
    });
    act('toggle-passphrase', () => { this.#passphraseOpen = !this.#passphraseOpen; this.render(); });
    act('fetch-passphrase', async () => {
      try {
        const res = await api.getBackupPassphrase();
        this.#passphrase = res.passphrase;
      } catch (e) {
        toastError('Error during loading', errorMessage(e));
      }
      this.refreshBackupInfo();
    });
    act('reset-tours', async () => {
      try {
        await api.resetTours();
        toastSuccess('Welcome screen reset.');
      } catch (e) {
        toastError('Error during resetting', errorMessage(e));
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
        if (data?.approval_url) { location = data.approval_url; return; }
        navigate('restart', { replace: true });
        return;
      } catch (e) {
        toastError('Error during resize', errorMessage(e));
        queryProfile({ refresh: true }).catch(() => {});
      } finally {
        this.#waitingForRestart = false;
      }
      this.render();
    });
    act('cancel-resize', () => { this.#selectedSize = null; this.render(); });
    this.querySelectorAll('.size-btn').forEach((b) =>
      b.addEventListener('click', () => { this.#selectedSize = b.dataset.size; this.render(); }));
  }
}

customElements.define('view-settings', ViewSettings);
