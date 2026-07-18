// Resource monitor — CPU + memory sparklines on Home (freeshard#155).
// Honest states: live data when the metrics API responds, an explicit
// "not available yet" note when the shard doesn't expose it.

import { FsElement } from './base.js';
import { store } from '../store.js';
import { formatBytes, SAMPLE_INTERVAL_MS, HISTORY_LENGTH } from '../metrics.js';
import { t, fmtNumber } from '../i18n.js';
import './sparkline.js';

class FsResourceMonitor extends FsElement {
  connectedCallback() {
    this.watch(['stats'], () => this.render());
  }

  windowLabel() {
    const minutes = Math.round(HISTORY_LENGTH * SAMPLE_INTERVAL_MS / 60000);
    return t('monitor.window', { minutes });
  }

  render() {
    const stats = store.state.stats;
    if (stats.supported === false) {
      this.innerHTML = `
        <div class="monitor-head"><span class="fs-label">${t('monitor.label')}</span></div>
        <p class="muted monitor-unsupported">${t('monitor.unsupported')}</p>`;
      return;
    }
    if (stats.supported === null && (stats.cpu?.length ?? 0) === 0) {
      this.innerHTML = `
        <div class="monitor-head"><span class="fs-label">${t('monitor.label')}</span></div>
        <p class="muted monitor-unsupported"><span class="fs-spinner fs-spinner--sm"></span> ${t('monitor.measuring')}</p>`;
      return;
    }

    const cpuNow = [...stats.cpu].reverse().find((v) => v !== null);
    const memNow = [...stats.mem].reverse().find((v) => v !== null);
    this.innerHTML = `
      <div class="monitor-head"><span class="fs-label">${t('monitor.label')}</span></div>
      <div class="monitor-grid">
        <div class="fs-sheet monitor-card">
          <div class="monitor-card__head">
            <span class="fs-label">${t('monitor.cpu')} · ${this.windowLabel()}</span>
            <span class="mono">${cpuNow != null ? `${fmtNumber(cpuNow, { maximumFractionDigits: 0 })}<span class="muted">%</span>` : '—'}</span>
          </div>
          <fs-sparkline class="monitor-spark" data-kind="cpu"></fs-sparkline>
        </div>
        <div class="fs-sheet monitor-card">
          <div class="monitor-card__head">
            <span class="fs-label">${t('monitor.memory')} · ${this.windowLabel()}</span>
            <span class="mono">${memNow != null ? formatBytes(memNow) : '—'}
              ${stats.memLimit ? `<span class="muted">/ ${formatBytes(stats.memLimit)}</span>` : ''}</span>
          </div>
          <fs-sparkline class="monitor-spark" data-kind="mem"></fs-sparkline>
        </div>
      </div>`;

    const cpuSpark = this.querySelector('[data-kind="cpu"]');
    cpuSpark.series = { values: stats.cpu, max: 100, unit: '%', maxLabel: '100' };
    const memSpark = this.querySelector('[data-kind="mem"]');
    memSpark.series = {
      values: stats.mem,
      max: stats.memLimit ?? undefined,
      format: (v) => formatBytes(v),
      maxLabel: stats.memLimit ? formatBytes(stats.memLimit) : undefined,
    };
  }
}

customElements.define('fs-resource-monitor', FsResourceMonitor);
