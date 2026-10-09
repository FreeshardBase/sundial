// GENERATED FILE — do not edit by hand. Regenerate with tools/gen_client.py
// Source of truth: js/api/openapi.json (dumped from shard_core's FastAPI app).
//
// All functions return parsed JSON (or Response for binary endpoints) and
// throw ApiError on non-2xx, with .status and .detail extracted the way the
// backend reports errors.

// The REST API is same-origin at an absolute path — independent of the
// subpath the app itself is served under.
export const API_ROOT = '/core';

export class ApiError extends Error {
  constructor(status, detail, body) {
    super(`${status}: ${detail}`);
    this.status = status;
    this.detail = detail;
    this.body = body;
  }
}

// Exported for the few endpoints outside the generated surface
// (management passthrough calls with bodies, cache-busted avatar fetches).
export async function call(method, path, { query, json, form } = {}) {
  const url = new URL(API_ROOT + path, location.origin);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, v);
    }
  }
  const init = { method, headers: {} };
  if (json !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(json);
  } else if (form !== undefined) {
    init.body = form; // FormData — browser sets the multipart boundary
  }
  const res = await fetch(url, init);
  if (!res.ok) {
    let detail = res.statusText;
    let body = null;
    try {
      body = await res.json();
      detail = body.detail || body.error || body.message || JSON.stringify(body);
    } catch { try { detail = await res.text() || detail; } catch { /* keep statusText */ } }
    throw new ApiError(res.status, detail, body);
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  return res;
}

// ---- schema typedefs ----

/**
 * @typedef {Object} AppMeta
 * @property {string} v
 * @property {string} app_version
 * @property {string|null=} upstream_repo
 * @property {string|null=} homepage
 * @property {string} name
 * @property {string} pretty_name
 * @property {string} icon
 * @property {Array<Entrypoint>} entrypoints
 * @property {Object} paths
 * @property {Lifecycle=} lifecycle
 * @property {VMSize=} minimum_portal_size
 * @property {StoreInfo|null=} store_info
 */

/**
 * @typedef {Object} BackupInfoResponse
 * @property {BackupReport|null} last_report
 * @property {BackupPassphraseLastAccessInfoResponse|null} last_passphrase_access_info
 */

/**
 * @typedef {Object} BackupPassphraseLastAccessInfoResponse
 * @property {string} time
 * @property {string} terminal_id
 * @property {string} terminal_name
 */

/**
 * @typedef {Object} BackupPassphraseResponse
 * @property {string} passphrase
 */

/**
 * @typedef {Object} BackupReport
 * @property {Array<BackupStats>} directories
 * @property {string} startTime
 * @property {string} endTime
 */

/**
 * @typedef {Object} BackupStats
 * @property {string} directory
 * @property {string} startTime
 * @property {string} endTime
 * @property {Object} rclone_stats
 */

/**
 * @typedef {Object} Body_install_custom_app_protected_apps_post
 * @property {string} file
 */

/**
 * @typedef {Object} Body_put_avatar_protected_identities__id__avatar_put
 * @property {string} file
 */

/**
 * @typedef {Object} Body_put_default_avatar_protected_identities_default_avatar_put
 * @property {string} file
 */

/**
 * @typedef {Object} DiskUsage
 * @property {number} total_gb
 * @property {number} free_gb
 * @property {boolean} disk_space_low
 */

/**
 * @typedef {Object} Entrypoint
 * @property {string} container_name
 * @property {number} container_port
 * @property {EntrypointPort} entrypoint_port
 */

/**
 * @typedef {Object} Health
 * @property {string} status
 */

/**
 * @typedef {Object} InputIdentity
 * @property {string|null=} id
 * @property {string|null=} name
 * @property {string|null=} email
 * @property {string|null=} description
 */

/**
 * @typedef {Object} InputPeer
 * @property {string} id
 * @property {string|null=} name
 */

/**
 * @typedef {Object} InputTerminal
 * @property {string} name
 * @property {Icon=} icon
 */

/**
 * @typedef {Object} InstalledAppWithMeta
 * @property {string} name
 * @property {InstallationReason=} installation_reason
 * @property {string=} status
 * @property {string|null=} last_access
 * @property {AppMeta|null} meta
 */

/**
 * @typedef {Object} Lifecycle
 * @property {boolean=} always_on
 * @property {boolean=} skip_pause
 * @property {number|null=} idle_for_pause
 * @property {number|null=} idle_for_stop
 */

/**
 * @typedef {Object} NotifyRequest
 * @property {string} type
 */

/**
 * @typedef {Object} OutputIdentity
 * @property {string} id
 * @property {string} name
 * @property {string|null=} email
 * @property {string|null=} description
 * @property {boolean} is_default
 * @property {string} public_key_pem
 * @property {string} domain
 */

/**
 * @typedef {Object} OutputVersion
 * @property {string} version
 */

/**
 * @typedef {Object} OutputWhoAmI
 * @property {ClientType} type
 * @property {string|null=} id
 * @property {string|null=} name
 */

/**
 * @typedef {Object} PairingCode
 * @property {string} code
 * @property {string} created
 * @property {string} valid_until
 */

/**
 * @typedef {Object} Path
 * @property {Access} access
 * @property {Object|null=} headers
 */

/**
 * @typedef {Object} Peer
 * @property {string} id
 * @property {string|null=} name
 * @property {string|null=} public_bytes_b64
 * @property {boolean|null=} is_reachable
 */

/**
 * @typedef {Object} Profile
 * @property {string} vm_id
 * @property {string|null=} owner
 * @property {string|null=} owner_email
 * @property {string} time_created
 * @property {string|null=} time_assigned
 * @property {string|null=} delete_after
 * @property {VMSize} vm_size
 * @property {VMSize|null=} max_vm_size
 * @property {number|null=} volume_size_gb
 * @property {ShardSubscriptionSummary|null=} subscription
 * @property {boolean=} billing_enabled
 * @property {string|null=} paypal_client_id
 * @property {string|null=} paypal_environment
 */

/**
 * @typedef {Object} QuickFeedbackInput
 * @property {string} text
 */

/**
 * @typedef {Object} ShardSubscriptionSummary
 * @property {SubscriptionStatus} status
 * @property {number} price_cents
 * @property {string} currency
 * @property {string|null=} next_billing_date
 * @property {string|null=} last_payment_failed_at
 * @property {string|null=} ended
 * @property {string|null=} payer_email
 * @property {VmSize|null=} pending_vm_size
 * @property {number|null=} pending_price_cents
 * @property {string} paypal_manage_url
 */

/**
 * @typedef {Object} StoreInfo
 * @property {string|null=} description_short
 * @property {string|Array<string>|null=} description_long
 * @property {string|Array<string>|null=} hint
 * @property {boolean|null=} is_featured
 */

/**
 * @typedef {Object} Terminal
 * @property {string} id
 * @property {string} name
 * @property {Icon=} icon
 * @property {string|null=} last_connection
 */

/**
 * @typedef {Object} Tour
 * @property {string} name
 * @property {TourStatus} status
 */

// ---- operations ----

/** GET /public/health — Health
 * @returns {Promise<Health>}
 */
export function health() {
  return call('GET', `/public/health`);
}

/** GET /public/meta/version — Get Version
 * @returns {Promise<OutputVersion>}
 */
export function getVersion() {
  return call('GET', `/public/meta/version`);
}

/** GET /public/meta/whoareyou — Who Are You
 * @returns {Promise<OutputIdentity>}
 */
export function whoAreYou() {
  return call('GET', `/public/meta/whoareyou`);
}

/** GET /public/meta/avatar — Get Default Avatar
 * @returns {Promise<Response>}
 */
export function getDefaultAvatar() {
  return call('GET', `/public/meta/avatar`);
}

/** GET /public/meta/whoami — Who Am I
 * @param {Object} [query] — {authorization?}
 * @returns {Promise<OutputWhoAmI>}
 */
export function whoAmI(query = {}) {
  return call('GET', `/public/meta/whoami`, { query });
}

/** POST /public/pair/terminal — Add Terminal
 * @param {InputTerminal} body
 * @param {Object} [query] — {code}
 * @returns {Promise<Response>}
 */
export function addTerminal(body, query = {}) {
  return call('POST', `/public/pair/terminal`, { query, json: body });
}

/** GET /protected/apps — List All Apps
 * @returns {Promise<Array<InstalledAppWithMeta>>}
 */
export function listAllApps() {
  return call('GET', `/protected/apps`);
}

/** POST /protected/apps — Install Custom App
 * @param {FormData} body
 * @returns {Promise<Response>}
 */
export function installCustomApp(body) {
  return call('POST', `/protected/apps`, { form: body });
}

/** GET /protected/apps/{name} — Get App
 * @param {string} name
 * @returns {Promise<InstalledAppWithMeta>}
 */
export function getApp(name) {
  return call('GET', `/protected/apps/${encodeURIComponent(name)}`);
}

/** DELETE /protected/apps/{name} — Uninstall App
 * @param {string} name
 * @returns {Promise<Response>}
 */
export function uninstallApp(name) {
  return call('DELETE', `/protected/apps/${encodeURIComponent(name)}`);
}

/** POST /protected/apps/{name} — Install App
 * @param {string} name
 * @returns {Promise<Response>}
 */
export function installApp(name) {
  return call('POST', `/protected/apps/${encodeURIComponent(name)}`);
}

/** GET /protected/apps/{name}/icon — Get App Icon
 * @param {string} name
 * @returns {Promise<Response>}
 */
export function getAppIcon(name) {
  return call('GET', `/protected/apps/${encodeURIComponent(name)}/icon`);
}

/** POST /protected/apps/{name}/reinstall — Reinstall App
 * @param {string} name
 * @returns {Promise<Response>}
 */
export function reinstallApp(name) {
  return call('POST', `/protected/apps/${encodeURIComponent(name)}/reinstall`);
}

/** GET /protected/backup/info — Get Backup Info
 * @returns {Promise<BackupInfoResponse>}
 */
export function getBackupInfo() {
  return call('GET', `/protected/backup/info`);
}

/** GET /protected/backup/passphrase — Get Backup Passphrase
 * @param {Object} [query] — {x-ptl-client-id?}
 * @returns {Promise<BackupPassphraseResponse>}
 */
export function getBackupPassphrase(query = {}) {
  return call('GET', `/protected/backup/passphrase`, { query });
}

/** POST /protected/backup/start — Start Backup
 * @returns {Promise<Response>}
 */
export function startBackup() {
  return call('POST', `/protected/backup/start`);
}

/** POST /protected/feedback/quick — Post Quick Feedback
 * @param {QuickFeedbackInput} body
 * @returns {Promise<Response>}
 */
export function postQuickFeedback(body) {
  return call('POST', `/protected/feedback/quick`, { json: body });
}

/** GET /protected/identities — List All Identities
 * @param {Object} [query] — {name?}
 * @returns {Promise<Array<OutputIdentity>>}
 */
export function listAllIdentities(query = {}) {
  return call('GET', `/protected/identities`, { query });
}

/** PUT /protected/identities — Put Identity
 * @param {InputIdentity} body
 * @returns {Promise<OutputIdentity>}
 */
export function putIdentity(body) {
  return call('PUT', `/protected/identities`, { json: body });
}

/** GET /protected/identities/default — Get Default Identity
 * @returns {Promise<OutputIdentity>}
 */
export function getDefaultIdentity() {
  return call('GET', `/protected/identities/default`);
}

/** GET /protected/identities/{id} — Get Identity By Id
 * @param {any} id
 * @returns {Promise<OutputIdentity>}
 */
export function getIdentityById(id) {
  return call('GET', `/protected/identities/${encodeURIComponent(id)}`);
}

/** GET /protected/identities/default/avatar — Get Default Avatar
 * @returns {Promise<Response>}
 */
export function getDefaultAvatarGet() {
  return call('GET', `/protected/identities/default/avatar`);
}

/** PUT /protected/identities/default/avatar — Put Default Avatar
 * @param {FormData} body
 * @returns {Promise<Response>}
 */
export function putDefaultAvatar(body) {
  return call('PUT', `/protected/identities/default/avatar`, { form: body });
}

/** DELETE /protected/identities/default/avatar — Delete Default Avatar
 * @returns {Promise<Response>}
 */
export function deleteDefaultAvatar() {
  return call('DELETE', `/protected/identities/default/avatar`);
}

/** GET /protected/identities/{id}/avatar — Get Avatar By Identity
 * @param {any} id
 * @returns {Promise<Response>}
 */
export function getAvatarByIdentity(id) {
  return call('GET', `/protected/identities/${encodeURIComponent(id)}/avatar`);
}

/** PUT /protected/identities/{id}/avatar — Put Avatar
 * @param {string} id
 * @param {FormData} body
 * @returns {Promise<Response>}
 */
export function putAvatar(id, body) {
  return call('PUT', `/protected/identities/${encodeURIComponent(id)}/avatar`, { form: body });
}

/** DELETE /protected/identities/{id}/avatar — Delete Avatar
 * @param {string} id
 * @returns {Promise<Response>}
 */
export function deleteAvatar(id) {
  return call('DELETE', `/protected/identities/${encodeURIComponent(id)}/avatar`);
}

/** POST /protected/identities/{id}/make-default — Make Identity Default
 * @param {any} id
 * @returns {Promise<Response>}
 */
export function makeIdentityDefault(id) {
  return call('POST', `/protected/identities/${encodeURIComponent(id)}/make-default`);
}

/** GET /protected/peers — List All Peers
 * @param {Object} [query] — {name?}
 * @returns {Promise<Array<Peer>>}
 */
export function listAllPeers(query = {}) {
  return call('GET', `/protected/peers`, { query });
}

/** PUT /protected/peers — Put Peer
 * @param {InputPeer} body
 * @returns {Promise<Peer>}
 */
export function putPeer(body) {
  return call('PUT', `/protected/peers`, { json: body });
}

/** GET /protected/peers/{id} — Get Peer By Id
 * @param {any} id
 * @returns {Promise<Peer>}
 */
export function getPeerById(id) {
  return call('GET', `/protected/peers/${encodeURIComponent(id)}`);
}

/** DELETE /protected/peers/{id} — Delete Peer
 * @param {any} id
 * @returns {Promise<Response>}
 */
export function deletePeer(id) {
  return call('DELETE', `/protected/peers/${encodeURIComponent(id)}`);
}

/** GET /protected/terminals — List All Terminals
 * @returns {Promise<Array<Terminal>>}
 */
export function listAllTerminals() {
  return call('GET', `/protected/terminals`);
}

/** GET /protected/terminals/id/{id_} — Get Terminal By Id
 * @param {string} id
 * @returns {Promise<Response>}
 */
export function getTerminalById(id) {
  return call('GET', `/protected/terminals/id/${encodeURIComponent(id)}`);
}

/** PUT /protected/terminals/id/{id_} — Edit Terminal
 * @param {string} id
 * @param {InputTerminal} body
 * @returns {Promise<Response>}
 */
export function editTerminal(id, body) {
  return call('PUT', `/protected/terminals/id/${encodeURIComponent(id)}`, { json: body });
}

/** DELETE /protected/terminals/id/{id_} — Delete Terminal By Id
 * @param {string} id
 * @returns {Promise<Response>}
 */
export function deleteTerminalById(id) {
  return call('DELETE', `/protected/terminals/id/${encodeURIComponent(id)}`);
}

/** GET /protected/terminals/name/{name} — Get Terminal By Name
 * @param {string} name
 * @returns {Promise<Terminal>}
 */
export function getTerminalByName(name) {
  return call('GET', `/protected/terminals/name/${encodeURIComponent(name)}`);
}

/** GET /protected/terminals/pairing-code — New Pairing Code
 * @param {Object} [query] — {deadline?}
 * @returns {Promise<PairingCode>}
 */
export function newPairingCode(query = {}) {
  return call('GET', `/protected/terminals/pairing-code`, { query });
}

/** GET /protected/help/tours — List Tours
 * @returns {Promise<Array<Tour>>}
 */
export function listTours() {
  return call('GET', `/protected/help/tours`);
}

/** PUT /protected/help/tours — Put Tour
 * @param {Tour} body
 * @returns {Promise<Response>}
 */
export function putTour(body) {
  return call('PUT', `/protected/help/tours`, { json: body });
}

/** DELETE /protected/help/tours — Reset Tours
 * @returns {Promise<Response>}
 */
export function resetTours() {
  return call('DELETE', `/protected/help/tours`);
}

/** GET /protected/help/tours/{name} — Get Tour
 * @param {string} name
 * @returns {Promise<Tour>}
 */
export function getTour(name) {
  return call('GET', `/protected/help/tours/${encodeURIComponent(name)}`);
}

/** GET /protected/management/profile — Get Profile
 * @param {Object} [query] — {refresh?}
 * @returns {Promise<Profile>}
 */
export function getProfile(query = {}) {
  return call('GET', `/protected/management/profile`, { query });
}

/** POST /protected/management/{rest} — Call Management
 * @param {string} rest
 * @returns {Promise<Response>}
 */
export function callManagement(rest) {
  return call('POST', `/protected/management/${encodeURIComponent(rest)}`);
}

/** DELETE /protected/management/{rest} — Call Management
 * @param {string} rest
 * @returns {Promise<Response>}
 */
export function callManagementProtectedManagementRestPost(rest) {
  return call('DELETE', `/protected/management/${encodeURIComponent(rest)}`);
}

/** PATCH /protected/management/{rest} — Call Management
 * @param {string} rest
 * @returns {Promise<Response>}
 */
export function callManagementProtectedManagementRestPostPatch(rest) {
  return call('PATCH', `/protected/management/${encodeURIComponent(rest)}`);
}

/** PUT /protected/management/{rest} — Call Management
 * @param {string} rest
 * @returns {Promise<Response>}
 */
export function callManagementProtectedManagementRestPostPut(rest) {
  return call('PUT', `/protected/management/${encodeURIComponent(rest)}`);
}

/** GET /protected/management/{rest} — Call Management
 * @param {string} rest
 * @returns {Promise<Response>}
 */
export function callManagementProtectedManagementRestPostGet(rest) {
  return call('GET', `/protected/management/${encodeURIComponent(rest)}`);
}

/** POST /protected/settings/prune-images — Prune Images
 * @returns {Promise<Response>}
 */
export function pruneImages() {
  return call('POST', `/protected/settings/prune-images`);
}

/** GET /protected/stats/disk — Disk Usage
 * @returns {Promise<DiskUsage>}
 */
export function diskUsage() {
  return call('GET', `/protected/stats/disk`);
}

/** GET /protected/stats/tasks — Tasks
 * @returns {Promise<Response>}
 */
export function tasks() {
  return call('GET', `/protected/stats/tasks`);
}
