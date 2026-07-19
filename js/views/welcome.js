// Welcome — the shard's public page (no auth): avatar, name, description,
// identity badge. Pair (anonymous) or Edit (authed).

import { FsElement, esc } from '../components/base.js';
import { store, shortShardId } from '../store.js';
import { queryMetaData } from '../actions.js';
import { href } from '../router.js';
import { icon } from '../components/icons.js';
import { renderMarkdown } from '../sanitize.js';
import { t } from '../i18n.js';
import '../components/avatar.js';
import '../components/shard-badge.js';

class ViewWelcome extends FsElement {
  connectedCallback() {
    this.watch(['meta'], () => this.render());
    queryMetaData().catch(() => {});
  }

  render() {
    document.title = t('title.welcome', { id: shortShardId() });
    const { identity, is_anonymous } = store.state.meta;
    this.innerHTML = `
      <div class="welcome">
        <fs-avatar src="/core/public/meta/avatar" name="${esc(identity.name)}" size="10rem"></fs-avatar>
        <h1>${esc(identity.name)}</h1>
        ${identity.email ? `<p><a href="mailto:${esc(identity.email)}">${esc(identity.email)}</a></p>` : ''}
        <div class="welcome-desc">${renderMarkdown(identity.description)}</div>
        <div class="welcome-foot">
          <fs-shard-badge shard-id="${esc(shortShardId())}"></fs-shard-badge>
          ${is_anonymous
            ? `<a class="fs-btn fs-btn--primary fs-focusable" href="${href('pair')}">${icon('link')} ${t('welcome.pair')}</a>`
            : `<a class="fs-btn fs-focusable" href="${href('public')}">${icon('person')} ${t('welcome.edit')}</a>`}
        </div>
        <p class="muted welcome-learn">${t('welcome.learnMore')}</p>
      </div>`;
  }
}

customElements.define('view-welcome', ViewWelcome);
