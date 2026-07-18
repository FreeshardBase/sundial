// Restart — shown while the shard restarts; polls until it's back, then
// returns to the app root. Escalating messages, honest about failure.

import { FsElement, esc } from '../components/base.js';
import { store } from '../store.js';
import { whoAreYou } from '../api/client.js';
import { BASE } from '../router.js';
import { t } from '../i18n.js';
import '../components/shard-badge.js';

function message(phase, seconds) {
  if (phase === 'pending') {
    if (seconds < 10) return t('restart.triggered');
    if (seconds < 30) return t('restart.soon');
    if (seconds < 50) return t('restart.anySecond');
    return t('restart.stillAlive');
  }
  if (seconds < 45) return t('restart.wentDown');
  if (seconds < 90) return t('restart.bePatient');
  if (seconds < 60 * 4) return t('restart.lotToDo');
  if (seconds < 60 * 7) return t('restart.strange');
  if (seconds < 60 * 12) return t('restart.wentWrong');
  if (seconds < 60 * 20) return t('restart.reallyPatient');
  return t('restart.knockKnock');
}

class ViewRestart extends FsElement {
  #phase = 'pending';
  #seconds = 0;

  connectedCallback() {
    this.watch('locale', () => this.render());
    this.every(1000, () => { this.#seconds += 1; this.renderMessage(); });
    this.every(2000, () => this.retry());
  }

  async retry() {
    try {
      await whoAreYou();
    } catch {
      if (this.#phase === 'pending') {
        this.#phase = 'unresponsive';
        this.#seconds = 0;
        this.renderMessage();
      }
      return;
    }
    if (this.#phase === 'unresponsive') location.replace(BASE);
  }

  render() {
    document.title = t('title.restart', { id: store.state.meta.identity.id.substring(0, 6) });
    this.innerHTML = `
      <div class="center-page">
        <h1>${t('restart.title')}</h1>
        <fs-shard-badge shard-id="${esc(store.state.meta.identity.id.substring(0, 6))}"></fs-shard-badge>
        <div class="restart-spinner"><span class="fs-spinner fs-spinner--lg"></span></div>
        <p class="restart-message muted"></p>
      </div>`;
    this.renderMessage();
  }

  renderMessage() {
    const p = this.querySelector('.restart-message');
    if (p) p.innerHTML = message(this.#phase, this.#seconds);
  }
}

customElements.define('view-restart', ViewRestart);
