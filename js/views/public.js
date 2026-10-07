// Public — edit the identity shown on the public welcome page:
// avatar, name, email, description (markdown).

import { FsElement, esc } from '../components/base.js';
import { shortShardId } from '../store.js';
import { queryMetaData } from '../actions.js';
import * as api from '../api/client.js';
import { href } from '../router.js';
import { icon } from '../components/icons.js';
import { toastError, errorMessage } from '../components/toast.js';
import { t } from '../i18n.js';
import '../components/avatar.js';
import '../components/editable-text.js';

class ViewPublic extends FsElement {
  #identity = { id: '', name: '', email: '', description: '' };
  #avatarRef = `/core/protected/identities/default/avatar?${performance.now()}`;

  async connectedCallback() {
    this.watch('locale', () => this.render());
    await this.refresh();
  }

  async refresh() {
    this.#identity = await api.getDefaultIdentity();
    await queryMetaData().catch(() => {});
    this.render();
  }

  refreshAvatar() {
    this.#avatarRef = `/core/protected/identities/default/avatar?${performance.now()}`;
    this.render();
  }

  render() {
    document.title = t('title.public', { id: shortShardId() });
    const id = this.#identity;
    this.innerHTML = `
      <div class="page-title"><h1>${t('public.title')}</h1></div>
      <p class="alert alert--info public-note">${icon('warn')}
        ${t('public.visibleNote', { link: `<a href="${href('welcome')}" target="_blank">${t('public.publicPage')} ${icon('open')}</a>` })}
      </p>
      <div class="public-avatar">
        <span class="fs-label">${t('public.image')}</span>
        <fs-avatar src="${esc(this.#avatarRef)}" name="${esc(id.name)}" size="7rem"></fs-avatar>
        <div class="public-avatar__controls">
          <input type="file" accept="image/*" class="fs-file avatar-file">
          <p class="muted">${icon('warn')} ${t('public.squareWarning')}</p>
          <div>
            <button class="fs-btn avatar-upload" disabled>${icon('upload')} ${t('public.upload')}</button>
            <button class="fs-btn fs-btn--danger avatar-clear">${icon('trash')} ${t('public.clear')}</button>
          </div>
        </div>
      </div>
      <fs-editable-text id="f-name" title="${t('public.name')}" value="${esc(id.name)}"></fs-editable-text>
      <fs-editable-text id="f-email" title="${t('public.email')}" value="${esc(id.email)}"></fs-editable-text>
      <fs-editable-text id="f-description" title="${t('public.description')}" value="${esc(id.description)}" rows="5"></fs-editable-text>`;

    const file = this.querySelector('.avatar-file');
    const upload = this.querySelector('.avatar-upload');
    file.addEventListener('change', () => { upload.disabled = !file.files.length; });
    upload.addEventListener('click', async () => {
      const form = new FormData();
      form.append('file', file.files[0]);
      try {
        await api.putDefaultAvatar(form);
        this.refreshAvatar();
      } catch (e) {
        toastError(t('toast.avatarUploadFailed'), errorMessage(e));
      }
    });
    this.querySelector('.avatar-clear').addEventListener('click', async () => {
      try {
        await api.deleteDefaultAvatar();
        this.refreshAvatar();
      } catch (e) {
        toastError(t('toast.avatarClearFailed'), errorMessage(e));
      }
    });

    for (const field of ['name', 'email', 'description']) {
      this.querySelector(`#f-${field}`).addEventListener('edited', async (e) => {
        try {
          await api.putIdentity({ id: this.#identity.id, [field]: e.detail.value });
          e.detail.done();
          await this.refresh();
        } catch (err) {
          toastError(t('toast.updateFailed'), errorMessage(err));
          e.detail.done();
        }
      });
    }
  }
}

customElements.define('view-public', ViewPublic);
