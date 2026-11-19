// Pure helpers for the Devices view's "pending disconnects" section: devices
// that are unpaired but still hold undelivered app lockouts (OIDC back-channel
// logouts). Kept DOM-free so the state ranking and copy mapping stay
// unit-testable, mirroring js/owner-email.js.

import { appDisplayName } from './components/app-tile.js';

// Lockout states, worst first. A device's pill takes the appearance of its
// worst lockout (see worstLockoutState); `failed` is the only state the owner
// can act on, so it ranks highest.
export const LOCKOUT_STATES = ['failed', 'waiting_for_install', 'retrying', 'waiting_for_start'];

// The highest-severity lockout state across a device's lockouts, or null when
// there are none. A state this client doesn't know (a newer server) sorts below
// every known state rather than being dropped.
export function worstLockoutState(lockouts = []) {
  let worst = null;
  let worstRank = Infinity;
  for (const { state } of lockouts) {
    const known = LOCKOUT_STATES.indexOf(state);
    const rank = known === -1 ? LOCKOUT_STATES.length : known;
    if (rank < worstRank) { worstRank = rank; worst = state; }
  }
  return worst;
}

// Whether a device has at least one lockout that could not be delivered — the
// trigger for the distinct pill styling and the retry/dismiss actions.
export function hasFailedLockout(terminal) {
  return (terminal.lockouts ?? []).some((l) => l.state === 'failed');
}

// i18n key suffix for a lockout state's copy. Unknown states fall back to a
// generic "pending" line so a newer server never renders a raw enum value.
export function lockoutStateKey(state) {
  return LOCKOUT_STATES.includes(state) ? state : 'unknown';
}

// The app's display name if Sundial knows the app from its installed list,
// otherwise the raw app_name the lockout carries.
export function lockoutAppLabel(appName, apps = []) {
  const app = apps.find((a) => a.name === appName);
  return app ? appDisplayName(app) : appName;
}
