// First-visit usage prompt — "What would you like to do?" app picker.
// Curated use-cases; installs the selected store apps.

import { openModal } from './modal.js';
import { store } from '../store.js';
import { installApp } from '../api/client.js';
import { fetchStoreApps } from '../appstore.js';
import { toastError, errorMessage } from './toast.js';
import { t } from '../i18n.js';

// Titles/texts live in the catalogs under usage.cases.<app>.
const CASES = [
  { app: 'vaultwarden', image: 'vaultwarden.jpg' },
  { app: 'paperless-ngx', image: 'paperless.jpg' },
  { app: 'navidrome', image: 'navidrome.jpg' },
  { app: 'linkding', image: 'linkding.jpg' },
  { app: 'immich', image: 'immich.jpg' },
  { app: 'actual', image: 'actual.jpg' },
];

export async function showUsagePrompt() {
  let storeApps = [];
  try {
    storeApps = await fetchStoreApps();
  } catch { /* cards render without store metadata */ }
  const installed = new Set(store.state.apps.map((a) => a.name));
  const selected = new Set();

  const body = document.createElement('div');
  body.className = 'usage-prompt';
  body.innerHTML = `
    <p><b>${t('usage.question')}</b></p>
    <p class="muted">${t('usage.intro')}</p>
    ${CASES.map((c, i) => {
      const disabled = installed.has(c.app);
      const meta = storeApps.find((a) => a.name === c.app);
      const pretty = meta?.pretty_name || c.app;
      return `
      <button class="usage-card ${disabled ? 'usage-card--disabled' : ''}" data-i="${i}" ${disabled ? 'disabled' : ''}>
        <img src="assets/img/${c.image}" alt="">
        <span class="usage-card__body">
          <span class="usage-card__title">${t(`usage.cases.${c.app}.title`)}
            <span class="usage-card__check" aria-hidden="true"></span></span>
          <span class="usage-card__text">${t(`usage.cases.${c.app}.text`)}</span>
          <span class="muted usage-card__note">${disabled
            ? t('usage.alreadyInstalled', { name: pretty })
            : t('usage.installs', { name: pretty })}</span>
        </span>
      </button>`;
    }).join('')}`;

  const footer = document.createElement('div');
  footer.innerHTML = `
    <button class="fs-btn" data-act="cancel">${t('usage.nevermind')}</button>
    <button class="fs-btn fs-btn--primary" data-act="install" disabled>${t('usage.installSelected')}</button>`;
  const installBtn = footer.querySelector('[data-act="install"]');

  const modal = openModal({ title: t('usage.title'), body, footer, size: 'lg' });

  body.querySelectorAll('.usage-card:not([disabled])').forEach((card) => {
    card.addEventListener('click', () => {
      const name = CASES[card.dataset.i].app;
      if (selected.has(name)) selected.delete(name);
      else selected.add(name);
      card.classList.toggle('usage-card--selected', selected.has(name));
      installBtn.disabled = selected.size === 0;
    });
  });

  footer.querySelector('[data-act="cancel"]').addEventListener('click', () => modal.close());
  installBtn.addEventListener('click', async () => {
    installBtn.disabled = true;
    try {
      await Promise.all([...selected].map((name) => installApp(name)));
    } catch (e) {
      toastError(t('toast.installFailedShort'), errorMessage(e));
    }
    modal.close();
  });
}
