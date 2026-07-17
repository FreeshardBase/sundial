// Pair — enter a pairing code to bind this browser to the shard.
// Supports ?code= auto-pairing; redirects home if already paired.

import { FsElement, esc } from '../components/base.js';
import { shortShardId } from '../store.js';
import * as api from '../api/client.js';
import * as actions from '../actions.js';
import { navigate } from '../router.js';
import { makeDeviceObject } from '../util.js';
import { icon } from '../components/icons.js';
import '../components/shard-badge.js';

class ViewPair extends FsElement {
  #shardId = null;
  #error = null;
  #busy = false;

  async connectedCallback() {
    this.render();

    const params = new URLSearchParams(location.search);
    const urlCode = params.get('code');
    if (urlCode) {
      try {
        await api.addTerminal(makeDeviceObject(), { code: urlCode });
        location.replace('.');
        return;
      } catch (e) {
        console.log('Error during auto-pairing', e);
      }
    }

    const whoami = await api.whoAmI().catch(() => null);
    if (whoami?.type === 'terminal') {
      navigate('', { replace: true });
      return;
    }
    const whoareyou = await api.whoAreYou().catch(() => null);
    this.#shardId = whoareyou?.id ?? null;
    document.title = `Shard [${(this.#shardId || 'unknow').substring(0, 6)}] - Hello`;
    this.render();
  }

  async pair(code) {
    this.#busy = true;
    this.#error = null;
    this.render();
    try {
      await api.addTerminal(makeDeviceObject(), { code });
    } catch (e) {
      this.#busy = false;
      this.#error = e.detail || e.message;
      this.render();
      return;
    }
    await Promise.all([
      actions.queryMetaData(),
      actions.queryTours().catch(() => {}),
      actions.queryProfile().catch(() => {}),
      actions.queryUiVersion(),
      actions.queryDiskUsage().catch(() => {}),
    ]).catch((e) => console.log(e));
    navigate('', { replace: true });
  }

  render() {
    const shortId = this.#shardId ? this.#shardId.substring(0, 6) : shortShardId() || 'unknow';
    this.innerHTML = `
      <div class="center-page">
        <h1>Pair this browser</h1>
        <p>This Shard is</p>
        <fs-shard-badge shard-id="${esc(shortId)}"></fs-shard-badge>
        <form class="pair-form">
          <label class="fs-label" for="pair-code">Enter a pairing code</label>
          <input id="pair-code" class="fs-input mono pair-input" placeholder="******"
                 autocomplete="one-time-code" ${this.#busy ? 'disabled' : ''}>
          <button type="submit" class="fs-btn fs-btn--primary fs-focusable" ${this.#busy ? 'disabled' : ''}>
            ${this.#busy ? '<span class="fs-spinner fs-spinner--sm"></span>' : icon('link')} Pair
          </button>
        </form>
        ${this.#error ? `<p class="alert alert--danger">${esc(this.#error)}</p>` : ''}
      </div>`;

    this.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      const code = this.querySelector('#pair-code').value.trim();
      if (code) this.pair(code);
    });
    if (!this.#busy) this.querySelector('#pair-code').focus();
  }
}

customElements.define('view-pair', ViewPair);
