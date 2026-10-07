// Home — the dashboard: app grid + resource monitor.

import { FsElement, esc } from '../components/base.js';
import { store, shortShardId, tourSeen } from '../store.js';
import { refreshApps, markTourSeen } from '../actions.js';
import { fillDiskBar, formatRelative, formatAbsolute } from '../util.js';
import { href } from '../router.js';
import { icon } from '../components/icons.js';
import { t, fmtNumber } from '../i18n.js';
import '../components/app-tile.js';
import { showUsagePrompt } from '../components/usage-prompt.js';
import '../components/resource-monitor.js';

class ViewHome extends FsElement {
  connectedCallback() {
    this.watch(['apps', 'terminals', 'disk_usage'], () => this.render());
    refreshApps().catch(() => {});
    if (!tourSeen('usage prompt')) {
      showUsagePrompt();
      markTourSeen('usage prompt').catch(() => {});
    }
  }

  render() {
    document.title = t('title.home', { id: shortShardId() });
    const apps = store.state.apps;
    const running = apps.filter((a) => a.status === 'running').length;
    this.innerHTML = `
      <div class="home-layout">
        <section class="home-apps">
          <div class="home-status">
            <span class="fs-label">${t('home.appsLabel')}</span>
            <span class="muted mono">${t('home.running', { count: running })}</span>
          </div>
          <div class="app-grid"></div>
        </section>
        <section class="home-monitor">
          <fs-resource-monitor></fs-resource-monitor>
          ${this.summaryHtml()}
        </section>
      </div>`;

    const grid = this.querySelector('.app-grid');
    for (const app of apps) {
      const tile = document.createElement('fs-app-tile');
      tile.app = app;
      grid.appendChild(tile);
    }
    const add = document.createElement('a');
    add.className = 'app-tile app-tile--add fs-focusable';
    add.href = href('apps');
    add.innerHTML = `
      <span class="app-tile__glyph app-tile__glyph--dashed">${icon('plus')}</span>
      <span class="app-tile__status"></span>
      <span class="app-tile__name">${t('home.addApp')}</span>`;
    grid.appendChild(add);
    fillDiskBar(this.querySelector('.summary-disk .disk-bar__fill'), store.state.disk_usage);
  }

  summaryHtml() {
    const { terminals, disk_usage: du, profile } = store.state;
    const used = du.total_gb - du.free_gb;
    const rows = [];
    const gb = (v) => fmtNumber(v, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    rows.push(`
      <div class="summary-row">
        <span class="fs-label">${t('home.diskLabel')}</span>
        <div class="disk-bar summary-disk"><div class="disk-bar__fill"></div></div>
        <span class="mono">${gb(used)} / ${gb(du.total_gb)} GiB</span>
      </div>`);
    rows.push(`
      <div class="summary-row">
        <span class="fs-label">${t('home.devicesLabel')}</span>
        <span>${t('home.paired', { count: terminals.length })}</span>
        <a href="${href('terminals')}">${t('home.manage')}</a>
      </div>`);
    if (profile?.delete_after && !profile.subscription) {
      rows.push(`
        <div class="summary-row">
          <span class="fs-label">${t('home.trialLabel')}</span>
          <span title="${esc(formatAbsolute(profile.delete_after))}">${t('home.trialDelete', { when: formatRelative(profile.delete_after) })}</span>
          <a href="${href('settings')}">${t('home.subscribe')}</a>
        </div>`);
    }
    return `
      <div class="monitor-head"><span class="fs-label">${t('home.shardLabel')}</span></div>
      <div class="fs-sheet summary-card">${rows.join('')}</div>`;
  }
}

customElements.define('view-home', ViewHome);
