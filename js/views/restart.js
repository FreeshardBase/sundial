// Restart — shown while the shard restarts; polls until it's back, then
// returns to the app root. Escalating messages, honest about failure.

import { FsElement, esc } from '../components/base.js';
import { store } from '../store.js';
import { whoAreYou } from '../api/client.js';
import { BASE } from '../router.js';
import '../components/shard-badge.js';

const SUPPORT = '<a href="mailto:contact@freeshard.net">contact support</a>';

function message(phase, seconds) {
  if (phase === 'pending') {
    if (seconds < 10) return 'Shard restart was triggered';
    if (seconds < 30) return 'Restarting Shard soon';
    if (seconds < 50) return 'Any second now...';
    return `Shard is still alive and kicking. Maybe something went wrong. Try again or ${SUPPORT}.`;
  }
  if (seconds < 45) return 'Shard went down, waiting for restart';
  if (seconds < 90) return 'Be patient, sometimes it may take a moment';
  if (seconds < 60 * 4) return 'Perhaps this time there is a lot to do...';
  if (seconds < 60 * 7) return 'Something is strange, it usually does not take so long';
  if (seconds < 60 * 12) return `It seems like something went wrong. Better ${SUPPORT}.`;
  if (seconds < 60 * 20) return `Wow, you are really patient. But this Shard is most probably broken. You should really ${SUPPORT}.`;
  return `Knock knock! Is someone there? This Shard broke down and needs help. Please ${SUPPORT}.`;
}

class ViewRestart extends FsElement {
  #phase = 'pending';
  #seconds = 0;

  connectedCallback() {
    document.title = `Shard [${store.state.meta.identity.id.substring(0, 6)}] - Restarting`;
    this.render();
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
    this.innerHTML = `
      <div class="center-page">
        <h1>Restarting Shard</h1>
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
