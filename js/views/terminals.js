// Devices — paired terminals: edit name/icon, delete, pair new device
// (QR + one-time code with validity countdown).

import { FsElement, esc } from '../components/base.js';
import { store, shortShardId, shardHref } from '../store.js';
import { refreshTerminals } from '../actions.js';
import * as api from '../api/client.js';
import { icon } from '../components/icons.js';
import { openModal } from '../components/modal.js';
import { formatRelative, parseUtc } from '../util.js';
import { onMessage } from '../ws.js';
import { generate } from 'lean-qr';
import { t } from '../i18n.js';

class ViewTerminals extends FsElement {
  #editing = new Map();   // id -> { name, icon, syncing }

  connectedCallback() {
    this.watch(['terminals'], () => this.render());
    this.every(30_000, () => this.renderTimes());
    refreshTerminals().catch(() => {});
  }

  render() {
    document.title = t('title.terminals', { id: shortShardId() });
    const terminals = store.state.terminals;
    this.innerHTML = `
      <div class="page-title"><h1>${t('terminals.title')}</h1></div>
      <div class="terminal-grid">
        ${terminals.map((term) => this.cardHtml(term)).join('')}
      </div>
      <div class="terminal-actions">
        <button class="fs-btn fs-btn--primary fs-focusable pair-new">${icon('plus')} ${t('terminals.pairNew')}</button>
      </div>`;

    this.querySelector('.pair-new').addEventListener('click', () => this.startPairing());
    for (const card of this.querySelectorAll('.terminal-card')) {
      this.wireCard(card, terminals.find((term) => term.id === card.dataset.id));
    }
  }

  deviceIcon(name) {
    return ['smartphone', 'tablet', 'notebook', 'desktop'].includes(name) ? name : 'box';
  }

  cardHtml(term) {
    const edit = this.#editing.get(term.id);
    const isThis = store.state.meta.device_id.substring(0, 6) === term.id;
    const glyph = this.deviceIcon(edit ? edit.icon : term.icon);
    return `
      <div class="terminal-card fs-sheet" data-id="${esc(term.id)}">
        <div class="terminal-card__icon">
          ${icon(glyph, 'icon--xl')}
          ${edit ? `
            <span class="terminal-card__rotate">
              <button class="icon-btn" data-act="icon-prev" aria-label="${t('terminals.prevIcon')}">${icon('left')}</button>
              <button class="icon-btn" data-act="icon-next" aria-label="${t('terminals.nextIcon')}">${icon('right')}</button>
            </span>` : ''}
          ${isThis && !edit ? `<span class="terminal-card__this fs-label">${t('terminals.thisBadge')}</span>` : ''}
        </div>
        <div class="terminal-card__body">
          ${edit
            ? `<input class="fs-input" data-field="name" ${edit.syncing ? 'disabled' : ''}>`
            : `<h3 class="terminal-card__name">${esc(term.name)}</h3>`}
          <p class="muted terminal-card__time" data-ts="${esc(term.last_connection || '')}">${this.timeText(term)}</p>
        </div>
        <div class="terminal-card__controls">
          ${edit ? `
            <button class="icon-btn" data-act="cancel" aria-label="${t('common.cancel')}">${icon('x')}</button>
            <button class="icon-btn icon-btn--ok" data-act="confirm" aria-label="${t('common.save')}">${icon('check')}</button>
            ${!isThis ? `<button class="icon-btn icon-btn--danger" data-act="delete" aria-label="${t('terminals.removeDevice')}">${icon('trash')}</button>` : ''}
          ` : `
            <button class="icon-btn fs-focusable" data-act="edit" aria-label="${t('terminals.editDevice')}">${icon('pencil')}</button>
          `}
        </div>
      </div>`;
  }

  timeText(term) {
    return term.last_connection
      ? t('terminals.lastConnection', { when: formatRelative(term.last_connection) })
      : t('terminals.lastConnectionUnknown');
  }

  renderTimes() {
    for (const p of this.querySelectorAll('.terminal-card__time')) {
      if (p.dataset.ts) p.textContent = t('terminals.lastConnection', { when: formatRelative(p.dataset.ts) });
    }
  }

  wireCard(card, term) {
    const edit = this.#editing.get(term.id);
    const confirm = async () => {
      edit.syncing = true;
      this.render();
      try {
        await api.editTerminal(term.id, { ...term, name: edit.name, icon: edit.icon });
      } finally {
        this.#editing.delete(term.id);
        await refreshTerminals().catch(() => {});
        this.render();
      }
    };
    const cancelEdit = () => {
      this.#editing.delete(term.id);
      this.render();
    };
    const input = card.querySelector('[data-field="name"]');
    if (input) {
      input.value = edit.name;
      input.addEventListener('input', () => { edit.name = input.value; });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') confirm();
        else if (e.key === 'Escape') cancelEdit();
      });
      input.focus();
    }
    const rotate = (dir) => {
      const icons = ['unknown', 'smartphone', 'tablet', 'notebook', 'desktop'];
      const i = icons.indexOf(edit.icon);
      edit.icon = icons[(i + dir + icons.length) % icons.length];
      this.render();
    };
    card.querySelector('[data-act="edit"]')?.addEventListener('click', () => {
      this.#editing.set(term.id, { name: term.name, icon: term.icon, syncing: false });
      this.render();
    });
    card.querySelector('[data-act="cancel"]')?.addEventListener('click', cancelEdit);
    card.querySelector('[data-act="confirm"]')?.addEventListener('click', confirm);
    card.querySelector('[data-act="icon-prev"]')?.addEventListener('click', () => rotate(-1));
    card.querySelector('[data-act="icon-next"]')?.addEventListener('click', () => rotate(1));
    card.querySelector('[data-act="delete"]')?.addEventListener('click', () => this.confirmDelete(term));
  }

  confirmDelete(term) {
    const body = document.createElement('div');
    body.innerHTML = `<p>${t('terminals.removeConfirmBody')}</p>`;
    const footer = document.createElement('div');
    footer.innerHTML = `
      <button class="fs-btn" data-act="cancel">${t('common.cancel')}</button>
      <button class="fs-btn fs-btn--danger" data-act="remove">${t('terminals.remove')}</button>`;
    const modal = openModal({ title: t('terminals.removeDevice'), body, footer });
    footer.querySelector('[data-act="cancel"]').addEventListener('click', () => modal.close());
    footer.querySelector('[data-act="remove"]').addEventListener('click', async () => {
      await api.deleteTerminalById(term.id);
      this.#editing.delete(term.id);
      modal.close();
      await refreshTerminals().catch(() => {});
    });
  }

  async startPairing() {
    const body = document.createElement('div');
    body.innerHTML = '<span class="fs-spinner"></span>';
    let cleanup = () => {};
    const modal = openModal({
      title: t('terminals.pairNew'),
      body,
      onClose: () => cleanup(),
    });

    let code;
    try {
      code = await api.newPairingCode();
    } catch (e) {
      body.innerHTML = `<p class="alert alert--danger">${esc(e.detail || e.message)}</p>`;
      return;
    }

    // Classic-app hash route — resolves on any shard, with or without Sundial
    // installed alongside (the classic UI owns "/" during coexistence).
    const link = `${shardHref()}/#/pair?code=${code.code}`;
    const validStart = parseUtc(code.created).getTime();
    const validEnd = parseUtc(code.valid_until).getTime();

    body.innerHTML = `
      <div class="pairing-progress"><div class="pairing-progress__bar"></div></div>
      <div class="pairing-modal">
        <p>${t('terminals.scanQr')}</p>
        <canvas class="pairing-qr" aria-label="${t('terminals.qrLabel')}"></canvas>
        <div class="hr-label"><span class="fs-label">${t('terminals.or')}</span></div>
        <p>${t('terminals.navigateTo', { link: `<a href="${esc(shardHref())}" target="_blank" rel="noopener">${esc(store.state.meta.identity.domain)}</a>` })}</p>
        <input class="fs-input mono pairing-code" readonly value="${esc(code.code)}">
      </div>`;

    generate(link).toCanvas(body.querySelector('.pairing-qr'));

    const bar = body.querySelector('.pairing-progress__bar');
    const tick = setInterval(() => {
      const pct = Math.max((validEnd - Date.now()) / (validEnd - validStart) * 100, 0);
      bar.style.width = `${pct}%`;
      if (pct === 0) {
        clearInterval(tick);
        body.innerHTML = `
          <p>${t('terminals.codeExpired')}</p>
          <button class="fs-btn fs-btn--primary">${icon('refresh')} ${t('common.refresh')}</button>`;
        body.querySelector('button').addEventListener('click', () => {
          modal.close();
          this.startPairing();
        });
      }
    }, 1000);

    const offAdd = onMessage('terminal_add', () => modal.close());
    cleanup = () => { clearInterval(tick); offAdd(); };
  }
}

customElements.define('view-terminals', ViewTerminals);
