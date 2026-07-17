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

class ViewTerminals extends FsElement {
  #editing = new Map();   // id -> { name, icon, syncing }

  connectedCallback() {
    document.title = `Shard [${shortShardId()}] - Devices`;
    this.watch(['terminals'], () => this.render());
    this.every(30_000, () => this.renderTimes());
    refreshTerminals().catch(() => {});
  }

  render() {
    const terminals = store.state.terminals;
    this.innerHTML = `
      <div class="page-title"><h1>Devices</h1></div>
      <div class="terminal-grid">
        ${terminals.map((t) => this.cardHtml(t)).join('')}
      </div>
      <div class="terminal-actions">
        <button class="fs-btn fs-btn--primary fs-focusable pair-new">${icon('plus')} Pair new device</button>
      </div>`;

    this.querySelector('.pair-new').addEventListener('click', () => this.startPairing());
    for (const card of this.querySelectorAll('.terminal-card')) {
      this.wireCard(card, terminals.find((t) => t.id === card.dataset.id));
    }
  }

  deviceIcon(name) {
    return ['smartphone', 'tablet', 'notebook', 'desktop'].includes(name) ? name : 'box';
  }

  cardHtml(t) {
    const edit = this.#editing.get(t.id);
    const isThis = store.state.meta.device_id.substring(0, 6) === t.id;
    const glyph = this.deviceIcon(edit ? edit.icon : t.icon);
    return `
      <div class="terminal-card fs-sheet" data-id="${esc(t.id)}">
        <div class="terminal-card__icon">
          ${icon(glyph, 'icon--xl')}
          ${edit ? `
            <span class="terminal-card__rotate">
              <button class="icon-btn" data-act="icon-prev" aria-label="Previous icon">${icon('left')}</button>
              <button class="icon-btn" data-act="icon-next" aria-label="Next icon">${icon('right')}</button>
            </span>` : ''}
          ${isThis && !edit ? '<span class="terminal-card__this fs-label">this</span>' : ''}
        </div>
        <div class="terminal-card__body">
          ${edit
            ? `<input class="fs-input" data-field="name" ${edit.syncing ? 'disabled' : ''}>`
            : `<h3 class="terminal-card__name">${esc(t.name)}</h3>`}
          <p class="muted terminal-card__time" data-ts="${esc(t.last_connection || '')}">${this.timeText(t)}</p>
        </div>
        <div class="terminal-card__controls">
          ${edit ? `
            <button class="icon-btn" data-act="cancel" aria-label="Cancel">${icon('x')}</button>
            <button class="icon-btn icon-btn--ok" data-act="confirm" aria-label="Save">${icon('check')}</button>
            ${!isThis ? `<button class="icon-btn icon-btn--danger" data-act="delete" aria-label="Remove device">${icon('trash')}</button>` : ''}
          ` : `
            <button class="icon-btn fs-focusable" data-act="edit" aria-label="Edit device">${icon('pencil')}</button>
          `}
        </div>
      </div>`;
  }

  timeText(t) {
    return t.last_connection
      ? `Last connection: ${formatRelative(t.last_connection)}`
      : 'Last connection: unknown';
  }

  renderTimes() {
    for (const p of this.querySelectorAll('.terminal-card__time')) {
      if (p.dataset.ts) p.textContent = `Last connection: ${formatRelative(p.dataset.ts)}`;
    }
  }

  wireCard(card, t) {
    const edit = this.#editing.get(t.id);
    const confirm = async () => {
      edit.syncing = true;
      this.render();
      try {
        await api.editTerminal(t.id, { ...t, name: edit.name, icon: edit.icon });
      } finally {
        this.#editing.delete(t.id);
        await refreshTerminals().catch(() => {});
        this.render();
      }
    };
    const input = card.querySelector('[data-field="name"]');
    if (input) {
      input.value = edit.name;
      input.addEventListener('input', () => { edit.name = input.value; });
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') confirm(); });
      input.focus();
    }
    const rotate = (dir) => {
      const icons = ['unknown', 'smartphone', 'tablet', 'notebook', 'desktop'];
      const i = icons.indexOf(edit.icon);
      edit.icon = icons[(i + dir + icons.length) % icons.length];
      this.render();
    };
    card.querySelector('[data-act="edit"]')?.addEventListener('click', () => {
      this.#editing.set(t.id, { name: t.name, icon: t.icon, syncing: false });
      this.render();
    });
    card.querySelector('[data-act="cancel"]')?.addEventListener('click', () => {
      this.#editing.delete(t.id);
      this.render();
    });
    card.querySelector('[data-act="confirm"]')?.addEventListener('click', confirm);
    card.querySelector('[data-act="icon-prev"]')?.addEventListener('click', () => rotate(-1));
    card.querySelector('[data-act="icon-next"]')?.addEventListener('click', () => rotate(1));
    card.querySelector('[data-act="delete"]')?.addEventListener('click', async () => {
      await api.deleteTerminalById(t.id);
      this.#editing.delete(t.id);
      await refreshTerminals().catch(() => {});
    });
  }

  async startPairing() {
    const body = document.createElement('div');
    body.innerHTML = '<span class="fs-spinner"></span>';
    let cleanup = () => {};
    const modal = openModal({
      title: 'Pair new device',
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

    const link = `${shardHref()}/pair?code=${code.code}`;
    const validStart = parseUtc(code.created).getTime();
    const validEnd = parseUtc(code.valid_until).getTime();

    body.innerHTML = `
      <div class="pairing-progress"><div class="pairing-progress__bar"></div></div>
      <div class="pairing-modal">
        <p>Scan this QR-code with another device to pair it</p>
        <canvas class="pairing-qr" aria-label="Pairing QR code"></canvas>
        <div class="hr-label"><span class="fs-label">or</span></div>
        <p>Navigate to <a href="${esc(shardHref())}" target="_blank" rel="noopener">${esc(store.state.meta.identity.domain)}</a>
           and use the one-time pairing code</p>
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
          <p>Pairing code expired</p>
          <button class="fs-btn fs-btn--primary">${icon('refresh')} Refresh</button>`;
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
