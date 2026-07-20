// Inline-editable text field (off | on | syncing), single-line or markdown
// multiline. Fires 'edited' with { value, done() } — caller persists, then
// calls done() to leave syncing state.

import { FsElement, esc } from './base.js';
import { icon } from './icons.js';
import { renderMarkdown } from '../sanitize.js';
import { t } from '../i18n.js';

class FsEditableText extends FsElement {
  #state = 'off';
  #value = '';

  static observedAttributes = ['title', 'value', 'rows'];

  attributeChangedCallback(name, _old, val) {
    if (name === 'value' && this.#state === 'off') this.#value = val ?? '';
    if (this.isConnected) this.render();
  }

  connectedCallback() {
    this.#value = this.getAttribute('value') ?? '';
    this.render();
  }

  get rows() { return Number(this.getAttribute('rows') || 1); }

  render() {
    const title = this.getAttribute('title') || '';
    const multi = this.rows > 1;
    const syncing = this.#state === 'syncing';

    let bodyHtml;
    if (this.#state === 'off') {
      bodyHtml = multi
        ? `<div class="editable-md">${renderMarkdown(this.#value)}</div>`
        : `<p class="editable-value">${esc(this.#value) || `<span class="muted">${t('editable.empty')}</span>`}</p>`;
    } else {
      bodyHtml = multi
        ? `<textarea class="fs-input" rows="${this.rows}" ${syncing ? 'disabled' : ''}></textarea>
           <p class="muted editable-hint">${t('editable.markdownHint')}</p>`
        : `<input class="fs-input" ${syncing ? 'disabled' : ''}>`;
    }

    const controls = this.#state === 'off'
      ? `<button class="icon-btn" data-act="edit" aria-label="${t('editable.edit', { title })}">${icon('pencil')}</button>`
      : `<button class="icon-btn" data-act="cancel" aria-label="${t('common.cancel')}">${icon('x')}</button>
         <button class="icon-btn icon-btn--ok" data-act="confirm" aria-label="${t('common.save')}">${icon('check')}</button>`;

    this.innerHTML = `
      <div class="editable">
        <span class="fs-label">${esc(title)}</span>
        <div class="editable-row">
          <div class="editable-body">${bodyHtml}</div>
          <div class="editable-controls">${controls}</div>
        </div>
      </div>`;

    const input = this.querySelector('input, textarea');
    if (input) {
      input.value = this.#editValue ?? this.#value;
      input.addEventListener('input', () => { this.#editValue = input.value; });
      if (!multi) {
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.confirm(); });
      }
      if (this.#state === 'on' && !this.#focused) { input.focus(); this.#focused = true; }
    }
    this.querySelector('[data-act="edit"]')?.addEventListener('click', () => {
      this.#state = 'on'; this.#editValue = this.#value; this.#focused = false; this.render();
    });
    this.querySelector('[data-act="cancel"]')?.addEventListener('click', () => {
      this.#state = 'off'; this.render();
    });
    this.querySelector('[data-act="confirm"]')?.addEventListener('click', () => this.confirm());
  }

  #editValue = null;
  #focused = false;

  confirm() {
    if (this.#state !== 'on') return;
    this.#state = 'syncing';
    this.render();
    this.dispatchEvent(new CustomEvent('edited', {
      detail: {
        value: this.#editValue ?? this.#value,
        done: () => { this.#value = this.#editValue ?? this.#value; this.#state = 'off'; this.render(); },
      },
    }));
  }
}

customElements.define('fs-editable-text', FsEditableText);
