// Home — the dashboard: app grid + resource monitor.

import { FsElement } from '../components/base.js';
import { store, shortShardId, tourSeen } from '../store.js';
import { refreshApps, markTourSeen } from '../actions.js';
import { href } from '../router.js';
import { icon } from '../components/icons.js';
import '../components/app-tile.js';
import { showUsagePrompt } from '../components/usage-prompt.js';

class ViewHome extends FsElement {
  connectedCallback() {
    document.title = `Shard [${shortShardId()}] - Home`;
    this.watch(['apps'], () => this.render());
    refreshApps().catch(() => {});
    if (!tourSeen('usage prompt')) {
      showUsagePrompt();
      markTourSeen('usage prompt').catch(() => {});
    }
  }

  render() {
    const apps = store.state.apps;
    this.innerHTML = `
      <section>
        <div class="home-status">
          <span class="fs-label">apps</span>
          <span class="muted mono">${apps.filter((a) => a.status === 'running').length} running</span>
        </div>
        <div class="app-grid"></div>
      </section>
      <section class="home-monitor-slot"></section>`;

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
}

customElements.define('view-home', ViewHome);
