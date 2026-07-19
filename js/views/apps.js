// Apps — the app store: installed + available, redesigned cards, app detail
// modal, update-all, custom app upload. Store branch fixed to master (the old
// branch-switching feature is deliberately not ported).

import { FsElement, esc } from '../components/base.js';
import { store, shortShardId } from '../store.js';
import { refreshApps } from '../actions.js';
import * as api from '../api/client.js';
import { icon } from '../components/icons.js';
import { openModal } from '../components/modal.js';
import { toastError, errorMessage } from '../components/toast.js';
import { fetchStoreApps, storeIconUrl, storeInfo } from '../appstore.js';
import { BUSY_STATUSES, VM_SIZES, appDisplayName, attachIconFallback, canBeStarted, openApp } from '../components/app-tile.js';
import { href } from '../router.js';
import { t } from '../i18n.js';

function minimumVmSize(app) {
  return app.meta?.minimum_vm_size || app.minimum_vm_size || app.minimum_portal_size;
}

function sizeCompatible(app) {
  const profile = store.state.profile;
  const min = minimumVmSize(app);
  if (!profile || !min) return true;
  return VM_SIZES.indexOf(profile.vm_size) >= VM_SIZES.indexOf(min);
}

class ViewApps extends FsElement {
  #storeApps = [];
  #loading = true;

  connectedCallback() {
    this.watch(['apps'], () => this.render());
    this.refresh();
  }

  async refresh({ refreshStore = false } = {}) {
    this.#loading = true;
    this.render();
    await Promise.all([
      refreshApps().catch(() => {}),
      fetchStoreApps({ refresh: refreshStore })
        .then((apps) => { this.#storeApps = apps; })
        .catch(() => {}),
    ]);
    this.#loading = false;
    this.render();
  }

  installedApps() {
    return store.state.apps.map((app) => {
      const storeApp = this.#storeApps.find((s) => s.name === app.name);
      return {
        ...app,
        update_available: Boolean(storeApp && app.meta && app.meta.app_version !== storeApp.app_version),
        store_info: storeApp?.store_info,
      };
    });
  }

  availableApps() {
    const installed = new Set(store.state.apps.map((a) => a.name));
    return this.#storeApps
      .filter((a) => !installed.has(a.name))
      .sort((a, b) => {
        const fa = Boolean(a.store_info?.is_featured);
        const fb = Boolean(b.store_info?.is_featured);
        if (fa === fb) return a.name.localeCompare(b.name);
        return Number(fb) - Number(fa);
      });
  }

  appsWithUpdates() {
    return this.installedApps().filter(
      (app) => app.update_available && ['stopped', 'running', 'down'].includes(app.status));
  }

  render() {
    document.title = t('title.apps', { id: shortShardId() });
    const installed = this.installedApps();
    const available = this.availableApps();
    const updates = this.appsWithUpdates();

    this.innerHTML = `
      <div class="page-title">
        <h1>${t('apps.title')}</h1>
        <span class="page-title__actions">
          <button class="icon-btn fs-focusable" data-act="refresh" aria-label="${t('apps.refreshStore')}" title="${t('apps.refreshStore')}">${icon('refresh')}</button>
          <button class="icon-btn fs-focusable" data-act="dev-tools" aria-label="${t('apps.devTools')}" title="${t('apps.devTools')}">${icon('upload')}</button>
        </span>
      </div>

      ${updates.length > 0 ? `
        <p class="alert alert--warn store-update-alert">
          ${t('apps.updatesAvailable', { count: updates.length })}
          <button class="fs-btn" data-act="update-all">${icon('update')} ${t('apps.updateAll', { count: updates.length })}</button>
        </p>` : ''}

      <section>
        <h2 class="store-section-title"><span class="fs-label">${t('apps.installedLabel')}</span><span class="hairline-grow"></span></h2>
        <div class="store-grid">
          ${installed.map((app) => this.cardHtml(app, true)).join('')
            || `<p class="muted">${t('apps.noneInstalled')}</p>`}
        </div>
      </section>

      <section>
        <h2 class="store-section-title"><span class="fs-label">${t('apps.availableLabel')}</span><span class="hairline-grow"></span></h2>
        ${this.#loading && available.length === 0 ? '<p><span class="fs-spinner"></span></p>' : ''}
        <div class="store-grid">
          ${available.map((app) => this.cardHtml(app, false)).join('')}
        </div>
        ${!this.#loading && available.length === 0 && this.#storeApps.length === 0
          ? `<p class="alert alert--warn">${t('apps.storeLoadFailed')}</p>` : ''}
      </section>`;

    attachIconFallback(this, 'store-card__fallback');
    this.querySelector('[data-act="refresh"]').addEventListener('click', () => this.refresh({ refreshStore: true }));
    this.querySelector('[data-act="dev-tools"]').addEventListener('click', () => this.openCustomAppModal());
    this.querySelector('[data-act="update-all"]')?.addEventListener('click', async () => {
      await Promise.all(this.appsWithUpdates().map((app) => api.reinstallApp(app.name).catch((e) => e)));
    });
    for (const card of this.querySelectorAll('.store-card')) {
      card.addEventListener('click', () => {
        const isInstalled = card.dataset.installed === 'true';
        const app = (isInstalled ? this.installedApps() : this.availableApps())
          .find((a) => a.name === card.dataset.name);
        if (app) this.openDetails(app, isInstalled);
      });
    }
  }

  cardHtml(app, isInstalled) {
    const info = storeInfo(app);
    const busy = BUSY_STATUSES.includes(app.status);
    const iconUrl = isInstalled ? `/core/protected/apps/${encodeURIComponent(app.name)}/icon` : storeIconUrl(app);
    return `
      <button class="store-card fs-focusable" data-name="${esc(app.name)}" data-installed="${isInstalled}">
        <span class="store-card__icon">
          ${busy ? '<span class="fs-spinner"></span>'
            : `<img src="${esc(iconUrl)}" alt="" loading="lazy" data-icon-fallback>`}
        </span>
        <span class="store-card__body">
          <span class="store-card__name">
            ${esc(appDisplayName(app))}
            ${info.is_featured ? `<span class="store-card__mark store-card__mark--featured" title="${t('apps.featured')}">${icon('star')}</span>` : ''}
            ${app.update_available ? `<span class="store-card__mark store-card__mark--update" title="${t('apps.updateAvailable')}">${icon('update')}</span>` : ''}
            ${!sizeCompatible(app) ? `<span class="store-card__mark store-card__mark--warn" title="${t('apps.needsLarger')}">${icon('warn')}</span>` : ''}
            ${app.status === 'error' ? `<span class="store-card__mark store-card__mark--error" title="${t('apps.errorState')}">${icon('warn')}</span>` : ''}
          </span>
          <span class="store-card__desc">${esc(info.description_short || '')}</span>
          ${isInstalled ? `<span class="store-card__status mono">${esc(app.status || '')}</span>` : ''}
        </span>
      </button>`;
  }

  openDetails(app, isInstalled) {
    const info = storeInfo(app);
    const iconUrl = isInstalled ? `/core/protected/apps/${encodeURIComponent(app.name)}/icon` : storeIconUrl(app);
    const longDesc = Array.isArray(info.description_long)
      ? info.description_long
      : info.description_long ? [info.description_long] : [info.description_short];
    const hints = info.hint ? (Array.isArray(info.hint) ? info.hint : [info.hint]) : [];

    const body = document.createElement('div');
    body.innerHTML = `
      <div class="app-detail__head">
        <img class="app-detail__icon" src="${esc(iconUrl)}" alt="" data-icon-fallback>
        <div>
          <h2>${esc(appDisplayName(app))}</h2>
          <p class="muted mono app-detail__status">
            ${isInstalled ? esc(app.status) : t('apps.notInstalled')}
            ${app.meta?.app_version || app.app_version ? ` · v${esc(app.meta?.app_version || app.app_version)}` : ''}
          </p>
          ${app.installation_reason === 'custom' ? `<p class="muted">${t('apps.customApp')}</p>` : ''}
          ${app.installation_reason === 'config' ? `<p class="muted">${t('apps.preconfiguredApp')}</p>` : ''}
          ${info.is_featured ? `<p class="muted">${icon('star')} ${t('apps.featuredNote')}</p>` : ''}
        </div>
      </div>
      ${longDesc.map((p) => `<p>${esc(p)}</p>`).join('')}
      ${hints.length ? `<div class="alert alert--info"><b>${t('apps.hints')}</b><ul>${hints.map((h) => `<li>${esc(h)}</li>`).join('')}</ul></div>` : ''}
      <p class="app-detail__error muted"></p>`;
    attachIconFallback(body, 'store-card__fallback');

    const footer = document.createElement('div');
    const modal = openModal({ body, footer, size: 'lg' });
    const errorLine = body.querySelector('.app-detail__error');

    const renderFooter = (busyMessage = null) => {
      if (busyMessage) {
        footer.innerHTML = `<span class="fs-spinner fs-spinner--sm"></span> <span class="muted">${esc(busyMessage)}</span>`;
        return;
      }
      if (!sizeCompatible(app)) {
        footer.innerHTML = `
          <p class="muted">${icon('warn')} ${t('apps.upgradeNeeded', {
            link: `<a href="${href('settings', 'section=size')}">${t('apps.upgradeLinkText')}</a>`,
            size: (minimumVmSize(app) || '?').toUpperCase(),
          })}</p>`;
        return;
      }
      if (isInstalled) {
        footer.innerHTML = `
          ${app.update_available ? `<button class="fs-btn" data-act="update">${icon('update')} ${t('apps.update')}</button>` : ''}
          ${app.status === 'error' && !app.update_available ? `<button class="fs-btn" data-act="update">${icon('refresh')} ${t('apps.reinstall')}</button>` : ''}
          <button class="fs-btn fs-btn--danger" data-act="remove">${t('apps.remove')}</button>
          ${app.status !== 'error' ? `<button class="fs-btn fs-btn--primary" data-act="open">${icon('open')} ${t('apps.open')}</button>` : ''}`;
      } else {
        footer.innerHTML = `<button class="fs-btn fs-btn--primary" data-act="install">${icon('plus')} ${t('apps.install')}</button>`;
      }
      const run = (message, fn, closeAfter = false) => async () => {
        renderFooter(message);
        try {
          await fn();
          if (closeAfter) modal.close();
          else renderFooter();
        } catch (e) {
          errorLine.textContent = errorMessage(e);
          renderFooter();
        }
      };
      footer.querySelector('[data-act="install"]')
        ?.addEventListener('click', run(t('apps.installing', { name: app.name }), () => api.installApp(app.name), true));
      footer.querySelector('[data-act="remove"]')
        ?.addEventListener('click', run(t('apps.removing', { name: app.name }), () => api.uninstallApp(app.name), true));
      footer.querySelector('[data-act="update"]')
        ?.addEventListener('click', run(t('apps.updating', { name: app.name }), () => api.reinstallApp(app.name), true));
      footer.querySelector('[data-act="open"]')?.addEventListener('click', () => openApp(app));
    };
    renderFooter();
  }

  openCustomAppModal() {
    const body = document.createElement('div');
    body.innerHTML = `
      <p>${t('apps.customIntro')}</p>
      <p class="alert alert--danger">${t('apps.customWarning')}</p>
      <input type="file" multiple class="custom-app-files">
      <p class="custom-app-error muted"></p>`;
    const footer = document.createElement('div');
    footer.innerHTML = `<button class="fs-btn fs-btn--primary" disabled>${icon('upload')} ${t('apps.install')}</button>`;
    const installBtn = footer.querySelector('button');
    const modal = openModal({ title: t('apps.customTitle'), body, footer });

    const files = body.querySelector('.custom-app-files');
    files.addEventListener('change', () => { installBtn.disabled = files.files.length === 0; });
    installBtn.addEventListener('click', async () => {
      installBtn.disabled = true;
      const failures = [];
      for (const file of files.files) {
        const form = new FormData();
        form.append('file', file);
        try {
          await api.installCustomApp(form);
        } catch (e) {
          failures.push(e);
        }
      }
      await this.refresh();
      if (failures.length === 0) modal.close();
      else {
        body.querySelector('.custom-app-error').textContent = errorMessage(failures[0]);
        installBtn.disabled = false;
      }
    });
  }
}

customElements.define('view-apps', ViewApps);
