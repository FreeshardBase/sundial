// Shard-down overlay — full-screen status display while the WS connection to
// the shard is lost. This is the single source of truth for "shard
// unreachable": the dock used to carry a small warn icon for the same signal
// (see dock.js history), which is easy to miss and has no touch-friendly
// tooltip. Removed in favor of this, so the signal isn't shown twice with two
// different timings.
//
// Deliberately NOT built on openModal() — that system is a closeable stack
// (Escape, click-outside, a close button) for user-initiated dialogs. This is
// a status display that must only disappear when the socket actually
// reconnects, so it mounts/unmounts itself directly into #overlay-slot and
// reuses the modal's visual classes (.modal-overlay/.modal-sheet, same
// page-receded dimming, same z-index layer) without any dismiss affordance.

import { FsElement } from './base.js';
import { store } from '../store.js';
import { t } from '../i18n.js';

const GRACE_MS = 5000;              // same grace period the old dock icon used
const ESCALATE_MS = 5 * 60 * 1000;  // 5 minutes: switch to the "serious problem" message

function pageLayers() {
  return [document.getElementById('view'), document.getElementById('dock-slot')];
}

// Pure + exported so the escalation threshold is testable without a real
// 5-minute wait (see tests/unit/shard-down-overlay.test.js).
export function message(elapsedMs) {
  return elapsedMs < ESCALATE_MS ? t('shardDown.early') : t('shardDown.late');
}

class FsShardDownOverlay extends FsElement {
  #shown = false;
  #graceTimer = null;
  #tickTimer = null;

  connectedCallback() {
    this.watch('ws', (state) => this.sync(state));
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#cancelGrace();
    clearInterval(this.#tickTimer);
  }

  sync(state) {
    const since = state.ws.disconnectedSince;
    if (since === null) {
      this.#cancelGrace();
      this.hide();
      return;
    }
    if (this.#shown) {
      this.render();  // keep title/message translated if locale changed mid-outage
      return;
    }
    if (this.#graceTimer) return;  // already waiting out the grace period
    this.#graceTimer = setTimeout(() => {
      this.#graceTimer = null;
      if (store.state.ws.disconnectedSince !== null) this.show();
    }, GRACE_MS);
  }

  #cancelGrace() {
    if (this.#graceTimer) {
      clearTimeout(this.#graceTimer);
      this.#graceTimer = null;
    }
  }

  show() {
    if (this.#shown) return;
    this.#shown = true;
    for (const layer of pageLayers()) layer?.classList.add('page-receded');
    this.render();
    this.#tickTimer = setInterval(() => this.renderMessage(), 1000);
  }

  hide() {
    if (!this.#shown) return;
    this.#shown = false;
    clearInterval(this.#tickTimer);
    this.#tickTimer = null;
    for (const layer of pageLayers()) layer?.classList.remove('page-receded');
    this.innerHTML = '';
  }

  render() {
    this.innerHTML = `
      <div class="modal-overlay shard-down-overlay">
        <div class="modal-sheet shard-down-sheet" aria-live="polite">
          <span class="fs-spinner fs-spinner--lg"></span>
          <h2>${t('shardDown.title')}</h2>
          <p class="shard-down-message muted"></p>
        </div>
      </div>`;
    this.renderMessage();
  }

  renderMessage() {
    const p = this.querySelector('.shard-down-message');
    if (!p) return;
    const since = store.state.ws.disconnectedSince;
    const elapsed = since === null ? 0 : Date.now() - since;
    p.innerHTML = message(elapsed);
  }
}

customElements.define('fs-shard-down-overlay', FsShardDownOverlay);
