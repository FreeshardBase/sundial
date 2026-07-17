// App launcher tile (Home grid). Design-guide .fs-tile: 100×88, cool border,
// icon + name, status dot (live glow in dark), busy spinner, blocked state
// when the shard's vm size is below the app's minimum.

import { FsElement, esc } from './base.js';
import { store } from '../store.js';
import { openModal } from './modal.js';
import { href } from '../router.js';

export const BUSY_STATUSES = [
  'installation_queued', 'installing',
  'uninstallation_queued', 'uninstalling',
  'reinstallation_queued', 'reinstalling',
];

export const VM_SIZES = ['xs', 's', 'm', 'l', 'xl'];

export function appDisplayName(app) {
  return app.meta?.pretty_name || app.pretty_name || app.name;
}

export function canBeStarted(app) {
  const profile = store.state.profile;
  if (!profile || !app.meta?.minimum_vm_size) return true;
  return VM_SIZES.indexOf(profile.vm_size) >= VM_SIZES.indexOf(app.meta.minimum_vm_size);
}

export function openApp(app) {
  window.open(`${location.protocol}//${app.name}.${location.host}`, '_blank');
}

class FsAppTile extends FsElement {
  app = null;

  connectedCallback() {
    this.render();
  }

  render() {
    const app = this.app;
    if (!app) return;
    const busy = BUSY_STATUSES.includes(app.status);
    const blocked = !canBeStarted(app);
    this.innerHTML = `
      <button class="app-tile fs-focusable ${busy ? 'app-tile--busy' : ''} ${blocked ? 'app-tile--blocked' : ''}"
              data-keyseq aria-label="Open ${esc(appDisplayName(app))}">
        <span class="app-tile__glyph">
          ${busy
            ? '<span class="fs-spinner"></span>'
            : `<img src="/core/protected/apps/${esc(app.name)}/icon" alt=""
                    onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'app-tile__fallback'}))">`}
        </span>
        <span class="app-tile__status">
          ${app.status === 'running' ? '<span class="fs-dot" data-live="true"></span>' : ''}
          ${app.status === 'error' ? '<span class="app-tile__error" title="App is in error state">!</span>' : ''}
        </span>
        <span class="app-tile__name">${esc(appDisplayName(app))}</span>
      </button>`;

    this.querySelector('button').addEventListener('click', () => {
      if (busy) return;
      if (blocked) {
        openModal({
          title: appDisplayName(app),
          body: `<p>This app requires a shard of size
                 <b>${esc((app.meta?.minimum_vm_size || '?').toUpperCase())}</b> or larger —
                 current size: <b>${esc((store.state.profile?.vm_size || '?').toUpperCase())}</b>.</p>
                 <p><a href="${href('settings', 'section=size')}">Upgrade your shard</a></p>`,
        });
        return;
      }
      openApp(app);
    });
  }
}

customElements.define('fs-app-tile', FsAppTile);
