// CMS banner strip — time-windowed announcements from the Freeshard blob
// (cnc/banners.json), markdown content, shown at the top of the page.

import { marked } from 'marked';

const BANNERS_URL = 'https://storageaccountportab0da.blob.core.windows.net/cnc/banners.json';

class FsBanner extends HTMLElement {
  async connectedCallback() {
    let banners;
    try {
      const res = await fetch(BANNERS_URL);
      banners = (await res.json()).banners;
    } catch {
      return;
    }
    const now = new Date();
    for (const banner of banners) {
      const from = banner.from_ts ? new Date(banner.from_ts) : null;
      const to = banner.to_ts ? new Date(banner.to_ts) : null;
      if ((from && now < from) || (to && now > to)) continue;
      const div = document.createElement('div');
      div.className = `banner banner--${banner.variant || 'info'}`;
      div.innerHTML = marked.parse(banner.content_md || '');
      for (const a of div.querySelectorAll('a')) a.target = '_blank';
      this.replaceChildren(div);
    }
  }
}

customElements.define('fs-banner', FsBanner);
