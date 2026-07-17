// First-visit usage prompt — "What would you like to do?" app picker.
// Curated use-cases; installs the selected store apps.

import { esc } from './base.js';
import { openModal } from './modal.js';
import { store } from '../store.js';
import { installApp } from '../api/client.js';
import { fetchStoreApps } from '../appstore.js';
import { toastError, errorMessage } from './toast.js';

const CASES = [
  {
    app: 'vaultwarden', title: 'Manage Passwords', image: 'vaultwarden.jpg',
    text: `Keep your passwords on Shard, securely encrypted with your master password.
           Fill them easily using the browser extension and smartphone app. Secure your
           online life by easily using a different and strong password for every website.`,
  },
  {
    app: 'paperless-ngx', title: 'Digitize Physical Documents', image: 'paperless.jpg',
    text: `Replace your filing cabinet with Shard. Store your scanned physical documents
           and access them from anywhere. Sort and organize them by correspondent, type,
           date, tags, and other metadata. Search for text inside your documents.`,
  },
  {
    app: 'navidrome', title: 'Listen to Your MP3 Collection', image: 'navidrome.jpg',
    text: `Upload your MP3 collection to Shard and listen to it from anywhere.
           Use the browser-based music player or any Subsonic client.`,
  },
  {
    app: 'linkding', title: 'Organize Bookmarks', image: 'linkding.jpg',
    text: `Store and organize your bookmarks on Shard. Tag them for easy search and
           retrieval. Use the browser extension to access them and easily add new ones.`,
  },
  {
    app: 'immich', title: 'Keep Photos and Videos', image: 'immich.jpg',
    text: `Backup and organize the photos from your phone. View them in a timeline, by
           location, or by tags. Share galleries with others and allow them to upload
           their photos as well.`,
  },
  {
    app: 'actual', title: 'Get a Handle on Your Finances', image: 'actual.jpg',
    text: `Save real money by tracking your expenses and income. Import your bank
           statements, categorize your transactions, and create net worth and cash flow
           reports. Plan ahead by setting budgets and goals using envelope budgeting.`,
  },
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
    <p><b>What would you like to do?</b></p>
    <p class="muted">Your shard offers a variety of apps for many different use cases.
      Here are a few that are particularly useful. You can also install these and more
      from the app store.</p>
    ${CASES.map((c, i) => {
      const disabled = installed.has(c.app);
      const meta = storeApps.find((a) => a.name === c.app);
      const pretty = meta?.pretty_name || c.app;
      return `
      <button class="usage-card ${disabled ? 'usage-card--disabled' : ''}" data-i="${i}" ${disabled ? 'disabled' : ''}>
        <img src="assets/img/${c.image}" alt="">
        <span class="usage-card__body">
          <span class="usage-card__title">${esc(c.title)}
            <span class="usage-card__check" aria-hidden="true"></span></span>
          <span class="usage-card__text">${c.text}</span>
          <span class="muted usage-card__note">${disabled
            ? `${esc(pretty)} is already installed`
            : `Installs ${esc(pretty)}`}</span>
        </span>
      </button>`;
    }).join('')}`;

  const footer = document.createElement('div');
  footer.innerHTML = `
    <button class="fs-btn" data-act="cancel">Nevermind</button>
    <button class="fs-btn fs-btn--primary" data-act="install" disabled>Install selected apps</button>`;
  const installBtn = footer.querySelector('[data-act="install"]');

  const modal = openModal({ title: 'Welcome to your Shard!', body, footer, size: 'lg' });

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
      toastError('Install failed', errorMessage(e));
    }
    modal.close();
  });
}
