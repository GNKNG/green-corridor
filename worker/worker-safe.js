/**
 * Community submission worker (Cloudflare Worker, ES Module). "Safe" variant.
 * Secrets (env): GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH(main)
 * No respondent email collected. ASCII only. Indicative only.
 */
export default {
  async fetch(request, env) {
    var cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST') return j({ ok: false, error: 'POST only' }, 405, cors);
    try {
      var body = await request.json();
      var ip = request.headers.get('CF-Connecting-IP') || request.headers.get('x-forwarded-for') || 'unknown';
      var res = await handleSubmission(body, ip, env);
      return j(res.body, res.status || 200, cors);
    } catch (e) {
      return j({ ok: false, error: 'Invalid request' }, 400, cors);
    }
  }
};

export {
  handleSubmission,
  isBadgerRecord,
  hasSensitive,
  snapToCouncilHq,
  sanitizeBadgerText,
  stripHouseNumber,
  COUNCIL_HQ_POLYGON
};

function j(obj, status, headers) {
  var h = { 'Content-Type': 'application/json' };
  if (headers) { for (var k in headers) h[k] = headers[k]; }
  return new Response(JSON.stringify(obj), { status: status || 200, headers: h });
}
function asciiOnly(s) {
  if (s == null) return '';
  return String(s).replace(/[^\x20-\x7E\n\r\t]/g, '').trim();
}
function stripHouseNumber(street) {
  var s = asciiOnly(street);
  s = s.replace(/^\s*(flat|unit|apt|apartment)?\s*\d+[a-zA-Z]?([\/\-]\d+[a-zA-Z]?)?\s*,?\s*/i, '');
  s = s.replace(/^\s*(no\.?|number)?\s*\d+[a-zA-Z]?([\/\-]\d+[a-zA-Z]?)?\s*,?\s*/i, '');
  s = s.replace(/^\s*\d+\s*-\s*\d+\s*,?\s*/i, '');
  return s.trim();
}
var BADGER_TERMS_RE = /\b(badger|badgers|sett|setts|brock|meles|meles meles)\b/i;
var SENSITIVE_TERMS_RE = /\b(sett|setts|den|dens|roost|roosts|nest|nests)\b/i;
var EXPLICIT_SETT_LOC_RE = /\b(at|near|behind|under|in garden of|number|no\.)\s+\d+/i;

function isBadgerRecord(species, text) {
  var s = String(species || '').toLowerCase().trim();
  if (s === 'badger' || s.indexOf('badger') !== -1 || s.indexOf('meles') !== -1) return true;
  return BADGER_TERMS_RE.test(String(text || ''));
}

function hasSensitive(text) {
  return SENSITIVE_TERMS_RE.test(String(text || ''));
}

// Swindon Borough Council Civic Offices, Euclid Street, SN1 2JH (51.56011 N, -1.77796 W)
var COUNCIL_HQ_POLYGON = {
  type: 'Polygon',
  coordinates: [[
    [-1.7798, 51.5593],
    [-1.7761, 51.5593],
    [-1.7761, 51.5609],
    [-1.7798, 51.5609],
    [-1.7798, 51.5593]
  ]]
};

function snapToCouncilHq(geom) {
  return COUNCIL_HQ_POLYGON;
}

function sanitizeBadgerText(text) {
  var s = String(text || '');
  s = s.replace(/\b(badger\s*setts?)\b/gi, 'badger presence');
  s = s.replace(/\b(setts?(\s+(entrance|location|hole|found|here))?)\b/gi, '[presence noted]');
  s = stripHouseNumber(s);
  return s.replace(/\s+/g, ' ').trim();
}
function clampText(s, max) {
  var t = asciiOnly(s);
  return t.length > max ? t.slice(0, max) : t;
}
function simplifyRing(coords, tolDeg) {
  if (!coords || coords.length <= 4) return coords;
  var out = [coords[0]];
  for (var i = 1; i < coords.length - 1; i++) {
    var prev = out[out.length - 1], cur = coords[i], next = coords[i + 1];
    var dx = next[0] - prev[0], dy = next[1] - prev[1];
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var dist = Math.abs(dy * cur[0] - dx * cur[1] + next[0] * prev[1] - next[1] * prev[0]) / len;
    if (dist > tolDeg) out.push(cur);
  }
  out.push(coords[coords.length - 1]);
  return out.length >= 4 ? out : coords;
}
function simplifyGeometry(geom) {
  if (!geom || !geom.type) return null;
  var tol = 0.00008;
  if (geom.type === 'Point') return { type: 'Point', coordinates: geom.coordinates };
  if (geom.type === 'Polygon' && geom.coordinates && geom.coordinates[0]) {
    return { type: 'Polygon', coordinates: [simplifyRing(geom.coordinates[0], tol)] };
  }
  return null;
}
function ringArea(coords) {
  var a = 0;
  if (!coords || coords.length < 4) return 0;
  for (var i = 0, jj = coords.length - 1; i < coords.length; jj = i++) {
    a += (coords[jj][0] + coords[i][0]) * (coords[jj][1] - coords[i][1]);
  }
  return Math.abs(a / 2);
}
async function handleSubmission(body, ip, env) {
  var honeypot = asciiOnly((body && body.website) || '');
  if (honeypot) return { status: 200, body: { ok: true, queued: true } };
  var geom = simplifyGeometry(body && body.geometry);
  if (!geom) return { status: 400, body: { ok: false, error: 'A marker or freehand area is required.' } };
  if (geom.type === 'Polygon' && ringArea(geom.coordinates[0]) > 0.02) {
    return { status: 400, body: { ok: false, error: 'Area is too large. Please draw a smaller indicative area.' } };
  }
  var attrs = body.attributes || {};
  var place = clampText(attrs.place, 120);
  var street = stripHouseNumber(attrs.street || attrs.street_area || '');
  street = clampText(street, 120);
  if (!place && !street) {
    return { status: 400, body: { ok: false, error: 'Please add a place name or a street name (no house numbers).' } };
  }
  var notes = clampText(attrs.notes || attrs.notes_note, 800);
  var contact = clampText(attrs.contact, 200);
  var speciesRaw = clampText(attrs.species, 60);
  var broadType = clampText(attrs.broad_type, 60);

  var textScan = [place, street, broadType, notes, contact].join(' ');
  var isBadger = isBadgerRecord(speciesRaw, textScan);
  var auditLogs = [];
  var nowIso = new Date().toISOString().slice(0, 19) + 'Z';
  var status = 'pending_review';
  var holdReason = null;
  var isSensitive = false;
  var isGeneralised = false;
  var photoRestricted = false;

  // Treat any photo as restricted and strip metadata
  if (attrs.photo || attrs.photos || (body && body.photo)) {
    photoRestricted = true;
  }

  if (isBadger) {
    isSensitive = true;
    photoRestricted = true;
    // Snap all badger sightings for entire area to Swindon Borough Council Civic Offices
    geom = snapToCouncilHq(geom);
    isGeneralised = true;
    notes = sanitizeBadgerText(notes);
    place = 'Swindon Borough Council Civic Offices';
    street = 'Euclid Street, Swindon SN1 2JH';
    auditLogs.push({
      timestamp: nowIso,
      action: 'snap_to_council_hq',
      rule: 'Protection of Badgers Act 1992',
      reason: 'badger_presence_snapped_to_borough_council_hq',
      target: 'Swindon Borough Council Civic Offices, Euclid Street, SN1 2JH'
    });
  } else if (!speciesRaw || speciesRaw === 'unclassified') {
    // Default unclassified records to held for review
    status = 'pending_review';
    holdReason = 'unclassified_species_default_held';
    auditLogs.push({
      timestamp: nowIso,
      action: 'hold_for_review',
      reason: 'unclassified_species_default_held'
    });
    if (hasSensitive(textScan)) {
      holdReason = 'unclassified_and_sensitive_terms_detected';
      auditLogs.push({
        timestamp: nowIso,
        action: 'flag_sensitive_terms',
        terms: 'wildlife_shelter_term_detected'
      });
    }
  } else {
    // Other species (birds, bats, amphibians, flora, etc.)
    if (hasSensitive(textScan)) {
      holdReason = 'sensitive_wildlife_term_detected';
      auditLogs.push({
        timestamp: nowIso,
        action: 'hold_for_review',
        reason: 'sensitive_wildlife_term_detected'
      });
    } else {
      auditLogs.push({
        timestamp: nowIso,
        action: 'queue_standard_review'
      });
    }
  }

  var record = {
    type: 'Feature',
    geometry: geom,
    properties: {
      feature_class: 'community_suggestion',
      status: status,
      submitted_at: nowIso,
      geometry_kind: !geom ? 'none' : (geom.type === 'Point' ? 'marker' : 'area'),
      place: place,
      street_area: street,
      broad_type: broadType,
      species: isBadger ? 'badger' : (speciesRaw || 'unclassified'),
      notes: notes,
      contact_provided: !!contact,
      ip_hash: await hashIp(ip),
      sensitive_species: isSensitive,
      generalised: isGeneralised,
      generalisation_mode: isGeneralised ? 'council_hq_swindon' : null,
      generalisation_location: isGeneralised ? 'Swindon Borough Council Civic Offices, Euclid Street, SN1 2JH' : null,
      privacy_protection: isSensitive ? 'Protection of Badgers Act 1992' : null,
      hold_reason: holdReason,
      photo_restricted: photoRestricted,
      audit_log: auditLogs
    }
  };

  var owner = env.GITHUB_OWNER, repo = env.GITHUB_REPO, token = env.GITHUB_TOKEN, base = env.GITHUB_BRANCH || 'main';
  if (!owner || !repo || !token) {
    return { status: 503, body: { ok: false, error: 'Submissions are not configured yet. Please use the contact form for now.' } };
  }
  var ts = Date.now();
  var short = Math.random().toString(36).slice(2, 8);
  var branch = 'community/submission-' + ts + '-' + short;
  var path = 'az-viewer/data/submissions/pending-' + ts + '-' + short + '.json';
  var content = JSON.stringify(record, null, 2) + '\n';
  var b64 = btoa(content); // ASCII-safe (fields clamped)

  try {
    var refRes = await gh(token, 'GET', '/repos/' + owner + '/' + repo + '/git/ref/heads/' + base);
    if (!refRes.ok) throw new Error('base ref');
    var refData = await refRes.json();
    var sha = refData.object.sha;
    var mk = await gh(token, 'POST', '/repos/' + owner + '/' + repo + '/git/refs', { ref: 'refs/heads/' + branch, sha: sha });
    if (!mk.ok) throw new Error('branch');
    var put = await gh(token, 'PUT', '/repos/' + owner + '/' + repo + '/contents/' + path, { message: 'community: pending submission ' + ts, content: b64, branch: branch });
    if (!put.ok) throw new Error('content');

    var prTitle = isBadger
      ? 'Community submission [BADGER - Snapped to Council HQ] ' + nowIso.slice(0, 10)
      : (holdReason
        ? 'Community submission [HELD - ' + holdReason + '] ' + nowIso.slice(0, 10)
        : 'Community submission (pending review) ' + nowIso.slice(0, 10));

    var prBody = 'Pending community map submission.\n' +
      'Species: ' + (record.properties.species || 'unclassified') + '\n' +
      'Status: ' + status + '\n' +
      (isGeneralised ? 'Protection: Snapped to Swindon Borough Council Civic Offices per Protection of Badgers Act 1992 (raw pin never stored).\n' : '') +
      (holdReason ? 'Hold reason: ' + holdReason + '\n' : '') +
      'Indicative only, no house numbers, no precise wildlife locations. Approve by merging into approved community data; reject by closing.';

    var pr = await gh(token, 'POST', '/repos/' + owner + '/' + repo + '/pulls', {
      title: prTitle,
      head: branch,
      base: base,
      body: prBody
    });
    if (!pr.ok) throw new Error('pr');
    await pr.json();
    return { status: 200, body: { ok: true, queued: true, message: 'Thank you. Your suggestion was queued for review before it appears on the map.' } };
  } catch (e) {
    return { status: 502, body: { ok: false, error: 'Could not queue the suggestion right now. Please try the contact form.' } };
  }
}
async function gh(token, method, path, body) {
  var opts = {
    method: method,
    headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json', 'User-Agent': 'green-corridor-community-worker' }
  };
  if (body) opts.body = JSON.stringify(body);
  return fetch('https://api.github.com' + path, opts);
}
async function hashIp(ip) {
  try {
    var data = new TextEncoder().encode(String(ip || '') + ':gc-community');
    var buf = await crypto.subtle.digest('SHA-256', data);
    var arr = Array.from(new Uint8Array(buf)).slice(0, 8);
    var out = [];
    for (var i = 0; i < arr.length; i++) out.push(('0' + arr[i].toString(16)).slice(-2));
    return out.join('');
  } catch (e) { return ''; }
}
