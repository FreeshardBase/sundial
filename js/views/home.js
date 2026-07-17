// Home — the dashboard: app grid + resource monitor.

import { FsElement, esc } from '../components/base.js';
import { store, shortShardId, tourSeen } from '../store.js';
import { refreshApps, markTourSeen } from '../actions.js';
import { formatRelative } from '../util.js';
import { href } from '../router.js';
import { icon } from '../components/icons.js';
import '../components/app-tile.js';
import { showUsagePrompt } from '../components/usage-prompt.js';
import '../components/resource-monitor.js';

class ViewHome extends FsElement {
  connectedCallback() {
    document.title = `Shard [${shortShardId()}] - Home`;
    this.watch(['apps', 'terminals', 'disk_usage'], () => this.render());
    refreshApps().catch(() => {});
    if (!tourSeen('usage prompt')) {
      showUsagePrompt();
      markTourSeen('usage prompt').catch(() => {});
    }
  }

  render() {
    const apps = store.state.apps;
    this.innerHTML = `
      <div class="home-layout">
        <section class="home-apps">
          <div class="home-status">
            <span class="fs-label">apps</span>
            <span class="muted mono">${apps.filter((a) => a.status === 'running').length} running</span>
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
      <span class="app-tile__name">Add app</span>`;
    grid.appendChild(add);
  }

  summaryHtml() {
    const { terminals, disk_usage: du, profile } = store.state;
    const used = du.total_gb - du.free_gb;
    const ratio = du.total_gb > 0 ? used / du.total_gb : 0;
    const tone = du.disk_space_low ? 'var(--danger)' : du.disk_space_warning ? 'var(--accent)' : 'var(--data)';
    const rows = [];
    rows.push(`
      <div class="summary-row">
        <span class="fs-label">disk</span>
        <div class="disk-bar summary-disk"><div class="disk-bar__fill" style="width:${(ratio * 100).toFixed(2)}%;background:${tone}"></div></div>
        <span class="mono">${used.toFixed(1)} / ${du.total_gb.toFixed(1)} GiB</span>
      </div>`);
    rows.push(`
      <div class="summary-row">
        <span class="fs-label">devices</span>
        <span>${terminals.length} paired</span>
        <a href="${href('terminals')}">Manage</a>
      </div>`);
    if (profile?.delete_after && !profile.subscription) {
      rows.push(`
        <div class="summary-row">
          <span class="fs-label">trial</span>
          <span>shard is deleted ${esc(formatRelative(profile.delete_after))}</span>
          <a href="${href('settings')}">Subscribe</a>
        </div>`);
    }
    return `
      <div class="monitor-head"><span class="fs-label">shard</span></div>
      <div class="fs-sheet summary-card">${rows.join('')}</div>`;
  }
}

customElements.define('view-home', ViewHome);
