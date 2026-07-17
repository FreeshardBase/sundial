// Avatar with initials fallback. Attributes: src, name, size (css length).

import { esc } from './base.js';

class FsAvatar extends HTMLElement {
  static observedAttributes = ['src', 'name', 'size'];

  attributeChangedCallback() { this.render(); }
  connectedCallback() { this.render(); }

  initials() {
    const name = (this.getAttribute('name') || '').trim();
    if (!name) return '';
    const words = name.split(/\s+/);
    if (words.length === 1) return words[0][0].toUpperCase();
    return (words[0][0] + words.at(-1)[0]).toUpperCase();
  }

  render() {
    const size = this.getAttribute('size') || '48px';
    const src = this.getAttribute('src');
    this.style.setProperty('--avatar-size', size);
    this.classList.add('fs-avatar');
    this.innerHTML = `<span class="fs-avatar__text">${esc(this.initials())}</span>
      ${src ? `<img src="${esc(src)}" alt="">` : ''}`;
    const img = this.querySelector('img');
    if (img) {
      img.addEventListener('error', () => img.remove());
    }
  }
}

customElements.define('fs-avatar', FsAvatar);
