// Peers — list, add by id, refresh, delete. (Hidden from the dock in the old
// app too; reachable by URL.)

import { FsElement, esc } from '../components/base.js';
import { shortShardId } from '../store.js';
import * as api from '../api/client.js';
import { icon } from '../components/icons.js';

class ViewPeers extends FsElement {
  #peers = [];
  #adding = false;

  async connectedCallback() {
    document.title = `Shard [${shortShardId()}] - Peers`;
    this.render();
    await this.refresh();
  }

  async refresh() {
    this.#peers = await api.listAllPeers().catch(() => []);
    this.render();
  }

  render() {
    this.innerHTML = `
      <div class="page-title">
        <h1>Peers</h1>
        ${this.#adding
          ? `<form class="peer-add-form">
               <input class="fs-input mono" placeholder="peer id" autofocus>
               <button type="submit" class="fs-btn fs-btn--primary">${icon('plus')} Add</button>
             </form>`
          : `<button class="fs-btn fs-btn--primary fs-focusable peer-add">${icon('plus')} Add peer</button>`}
      </div>
      <div class="peer-list">
        ${this.#peers.map((p) => `
          <div class="peer-row" data-id="${esc(p.id)}">
            <span class="peer-name">${esc(p.name || '[Unknown]')}</span>
            <a class="mono" href="https://${esc(p.id.substring(0, 6))}.freeshard.cloud" target="_blank" rel="noopener">${esc(p.id.substring(0, 6))}</a>
            <span class="peer-actions">
              <button class="icon-btn" data-act="refresh" aria-label="Refresh peer">${icon('refresh')}</button>
              <button class="icon-btn icon-btn--danger" data-act="delete" aria-label="Delete peer">${icon('trash')}</button>
            </span>
          </div>`).join('')}
        ${this.#peers.length === 0 ? '<p class="muted">No peers yet.</p>' : ''}
      </div>`;

    this.querySelector('.peer-add')?.addEventListener('click', () => {
      this.#adding = true;
      this.render();
    });
    this.querySelector('.peer-add-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = this.querySelector('.peer-add-form input').value.trim();
      if (!id) return;
      try { await api.putPeer({ id }); } catch (err) { console.log(err); }
      this.#adding = false;
      await this.refresh();
    });
    for (const row of this.querySelectorAll('.peer-row')) {
      row.querySelector('[data-act="refresh"]').addEventListener('click', async () => {
        await api.putPeer({ id: row.dataset.id });
        await this.refresh();
      });
      row.querySelector('[data-act="delete"]').addEventListener('click', async () => {
        await api.deletePeer(row.dataset.id);
        await this.refresh();
      });
    }
    this.querySelector('.peer-add-form input')?.focus();
  }
}

customElements.define('view-peers', ViewPeers);
