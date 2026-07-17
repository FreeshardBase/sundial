// Placeholder — replaced by the real view in the parity pass.
import { FsElement } from '../components/base.js';

class View extends FsElement {
  connectedCallback() {
    this.innerHTML = '<h1>apps</h1><p class="muted">Not built yet.</p>';
  }
}

customElements.define('view-apps', View);
