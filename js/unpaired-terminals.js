// Pure helpers for the Devices view's "pending disconnects" section: devices
// that are unpaired but still hold undelivered app lockouts (OIDC back-channel
// logouts). A failed-lockout check, an i18n state-key mapping, and an app-name
// label. DOM-free and unit-tested, like js/owner-email.js.

import { appDisplayName } from './components/app-tile.js';

// The lockout states this client knows how to render. A state outside this set
// (a newer server) falls back to generic "pending" copy rather than leaking a
// raw enum value into the UI.
const KNOWN_STATES = ['waiting_for_start', 'retrying', 'waiting_for_install', 'failed'];

// Whether a device has at least one lockout that could not be delivered.
export function hasFailedLockout(terminal) {
  return (terminal.lockouts ?? []).some((l) => l.state === 'failed');
}

// i18n key suffix for a lockout state's copy; unknown states collapse to
// 'unknown'.
export function lockoutStateKey(state) {
  return KNOWN_STATES.includes(state) ? state : 'unknown';
}

// The app's display name if Sundial knows the app from its installed list,
// otherwise the raw app_name the lockout carries.
export function lockoutAppLabel(appName, apps = []) {
  const app = apps.find((a) => a.name === appName);
  return app ? appDisplayName(app) : appName;
}
