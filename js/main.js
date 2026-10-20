// Boot: register views, hydrate the store (load-all-upfront), route, connect WS.

import { defineRoutes, startRouter, navigate, currentRoute, href } from './router.js';
import { store } from './store.js';
import * as actions from './actions.js';
import { startWebSocket, onMessage } from './ws.js';
import { toastSuccess, toastError } from './components/toast.js';
import { startKeynav } from './keynav.js';
import { startMetrics } from './metrics.js';
import { initI18n, t } from './i18n.js';
import { registerServiceWorker } from './pwa.js';
import { followOidcReturn, oidcReturnQuery } from './oidc-return.js';
import { readConfirmEmailToken, searchWithoutConfirmToken } from './owner-email.js';
import { holdConfirmToken } from './views/confirm-email.js';

import './components/dock.js';
import './components/banner.js';
import './components/shard-down-overlay.js';
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
import './views/confirm-email.js';

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
  'confirm-email': { tag: 'view-confirm-email' },
});

// Routes an unpaired browser may stay on. The confirmation link is opened in
// whatever reads mail, usually a device this shard has never seen.
const PUBLIC_ROUTES = ['pair', 'welcome', 'confirm-email'];

// The mail link is `<shard>/?confirm_email=<token>`, whatever path it lands
// on. Take the token out of the URL (address bar, history, Referer) and hand
// it to the confirmation view, before anything else routes.
function takeConfirmEmailLink() {
  const token = readConfirmEmailToken(location.search);
  if (!token) return false;
  holdConfirmToken(token);
  history.replaceState(null, '', href('confirm-email') + searchWithoutConfirmToken(location.search));
  return true;
}

async function boot() {
  const confirming = takeConfirmEmailLink();
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

  // Already paired and sent here by an app login: go straight back to it.
  // A confirmation link wins: leaving would drop its token unspent.
  if (!confirming && !store.state.meta.is_anonymous && followOidcReturn()) return;

  startRouter();

  if (store.state.meta.is_anonymous && !PUBLIC_ROUTES.includes(currentRoute())) {
    navigate('welcome', { replace: true, query: oidcReturnQuery() });
  }

  document.getElementById('splash').remove();
  document.getElementById('dock-slot').replaceChildren(document.createElement('fs-dock'));
  document.getElementById('overlay-slot').appendChild(document.createElement('fs-shard-down-overlay'));

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
