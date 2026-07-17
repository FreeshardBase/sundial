// Placeholder — replaced by the real view in the parity pass.
import { FsElement } from '../components/base.js';

class View extends FsElement {
  connectedCallback() {
    this.innerHTML = '<h1>terminals</h1><p class="muted">Not built yet.</p>';
  }
}

customElements.define('view-terminals', View);
