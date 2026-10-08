// Boot: register views, hydrate the store (load-all-upfront), route, connect WS.

import { defineRoutes, startRouter, navigate, currentRoute } from './router.js';
import { store } from './store.js';
import * as actions from './actions.js';
import { startWebSocket, onMessage } from './ws.js';
import { toastSuccess, toastError } from './components/toast.js';
import { startKeynav } from './keynav.js';
import { startMetrics } from './metrics.js';
import { initI18n, t } from './i18n.js';
import { registerServiceWorker } from './pwa.js';

import './components/dock.js';
import './components/banner.js';
import './components/update-banner.js';
import './views/home.js';
import './views/welcome.js';
import './views/pair.js';
import './views/terminals.js';
import './views/apps.js';
import './views/peers.js';
import './views/public.js';
import './views/settings.js';
import './views/restart.js';

defineRoutes({
  '': { tag: 'view-home' },
  welcome: { tag: 'view-welcome' },
  pair: { tag: 'view-pair' },
  terminals: { tag: 'view-terminals' },
  apps: { tag: 'view-apps' },
  peers: { tag: 'view-peers' },
  public: { tag: 'view-public' },
  settings: { tag: 'view-settings' },
  restart: { tag: 'view-restart' },
});

async function boot() {
  await Promise.all([
    initI18n().catch((e) => console.error('i18n init failed', e)),
    actions.queryMetaData().catch((e) => console.log('meta', e)),
    actions.queryTours().catch(() => console.error('Failed to load tours')),
    actions.queryProfile().catch(() => console.error('Failed to load profile')),
    actions.queryUiVersion(),
    actions.queryDiskUsage().catch(() => {}),
    actions.refreshApps().catch(() => {}),
    actions.refreshTerminals().catch(() => {}),
  ]);

  startRouter();

  if (store.state.meta.is_anonymous && !['pair', 'welcome'].includes(currentRoute())) {
    navigate('welcome', { replace: true });
  }

  document.getElementById('splash').remove();
  document.getElementById('dock-slot').replaceChildren(document.createElement('fs-dock'));

  startKeynav();
  startWebSocket();
  registerServiceWorker();
  const maybeStartMetrics = () => { if (!store.state.meta.is_anonymous) startMetrics(); };
  store.subscribe('meta', maybeStartMetrics);
  maybeStartMetrics();
  onMessage('app_install_error', (m) => toastError(t('toast.installFailed', { name: m.name }), m.error));
  onMessage('backup_update', (m) => {
    if (m?.error) toastError(t('toast.backupFailed'), m.error);
    else toastSuccess(t('toast.backupDone'));
  });

  setInterval(() => actions.queryUiVersion(), 60_000);
}

boot();
