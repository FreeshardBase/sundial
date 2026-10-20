// Pending/confirm pattern: a change that has been accepted but is not in
// effect yet (an email address awaiting confirmation, and whatever else
// later needs a second step). The candidate renders apart from the live
// value, in a dashed sheet that reads "not real yet", with a label naming the
// state, a status line, and the follow-up actions at equal weight.
// Returns markup; the caller wires the buttons by their data-act.

import { esc } from './base.js';

// label/note/notice are trusted catalog strings (t() output); value is escaped.
// notice: an optional warning that replaces note (e.g. a mail that did not go out).
// actions: [{ act, label, disabled }]
export function pendingChange({ label, value, note = '', notice = '', actions = [] }) {
  return `
    <div class="pending-change">
      <span class="fs-label">${label}</span>
      <p class="pending-change__value mono">${esc(value)}</p>
      ${notice
        ? `<p class="alert alert--warn pending-change__notice">${notice}</p>`
        : note ? `<p class="muted pending-change__note">${note}</p>` : ''}
      ${actions.length ? `<p class="pending-change__actions">${actions.map((a) => `
        <button class="fs-btn" data-act="${esc(a.act)}" ${a.disabled ? 'disabled' : ''}>${a.label}</button>`).join('')}
      </p>` : ''}
    </div>`;
}
