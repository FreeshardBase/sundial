// Welcome — the shard's public page (no auth): avatar, name, description,
// identity badge. Pair (anonymous) or Edit (authed).

import { FsElement, esc } from '../components/base.js';
import { store, shortShardId } from '../store.js';
import { queryMetaData } from '../actions.js';
import { href } from '../router.js';
import { icon } from '../components/icons.js';
import { marked } from 'marked';
import '../components/avatar.js';
import '../components/shard-badge.js';

class ViewWelcome extends FsElement {
  connectedCallback() {
    document.title = `Shard [${shortShardId()}] - Welcome`;
    this.watch(['meta'], () => this.render());
    queryMetaData().catch(() => {});
  }

  render() {
    const { identity, is_anonymous } = store.state.meta;
    this.innerHTML = `
      <div class="welcome">
        <fs-avatar src="/core/public/meta/avatar" name="${esc(identity.name)}" size="10rem"></fs-avatar>
        <h1>${esc(identity.name)}</h1>
        ${identity.email ? `<p><a href="mailto:${esc(identity.email)}">${esc(identity.email)}</a></p>` : ''}
        <div class="welcome-desc">${marked.parse(identity.description || '')}</div>
        <div class="welcome-foot">
          <fs-shard-badge shard-id="${esc(shortShardId())}"></fs-shard-badge>
          ${is_anonymous
            ? `<a class="fs-btn fs-btn--primary fs-focusable" href="${href('pair')}">${icon('link')} Pair</a>`
            : `<a class="fs-btn fs-focusable" href="${href('public')}">${icon('person')} Edit</a>`}
        </div>
        <p class="muted welcome-learn"><a href="https://freeshard.net" target="_blank" rel="noopener">Learn more</a> about Shard</p>
      </div>`;
  }
}

customElements.define('view-welcome', ViewWelcome);
