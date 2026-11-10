/**
 * Community mapping submission worker (Cloudflare Worker style).
 * Receives indicative geometry + attributes from the az-viewer, validates/sanitizes,
 * then opens a GitHub PR adding the submission as a draft record.
 *
 * Secrets (Worker env / wrangler secrets) - NEVER in page JS:
 *   GITHUB_TOKEN   - fine-grained PAT with contents:write, pull_requests:write on the repo
 *   GITHUB_OWNER   - repo owner (e.g. GNKNG)
 *   GITHUB_REPO    - repo name (e.g. green-corridor)
 *   GITHUB_BRANCH  - base branch (default: main)
 *
 * No respondent email is collected or stored.
 * ASCII only in stored text fields. Indicative only; not a boundary/designation/claim.
 */
export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405, cors);

    try {
      const body = await request.json();
      const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('x-forwarded-for') || 'unknown';
      const result = await handleSubmission(body, ip, env);
      return json(result.body, result.status || 200, cors);
    } catch (e) {
      return json({ ok: false, error: 'Invalid request' }, 400, cors);
    }
  },
};

function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), { status: status || 200, headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {}) });
}

function asciiOnly(s) {
  if (s == null) return '';
  return String(s).replace(/[^\x20-\x7E\n\r\t]/g, '').trim();
}
function stripHouseNumber(street) {
  var s = asciiOnly(street);
  // remove leading house/flat numbers and common unit prefixes to keep street-level only
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

function generaliseTo500mGrid(geom) {
  if (!geom) return null;
  var lon = 0, lat = 0;
  if (geom.type === 'Point' && geom.coordinates) {
    lon = geom.coordinates[0];
    lat = geom.coordinates[1];
  } else if (geom.type === 'Polygon' && geom.coordinates && geom.coordinates[0] && geom.coordinates[0].length > 0) {
    var pts = geom.coordinates[0];
    var sx = 0, sy = 0;
    for (var i = 0; i < pts.length; i++) { sx += pts[i][0]; sy += pts[i][1]; }
    lon = sx / pts.length;
    lat = sy / pts.length;
  } else {
    return null;
  }
  var lonStep = 0.008; // ~554m
  var latStep = 0.005; // ~556m
  var minLon = Math.floor(lon / lonStep) * lonStep;
  var minLat = Math.floor(lat / latStep) * latStep;
  var maxLon = minLon + lonStep;
  var maxLat = minLat + latStep;
  function r(n) { return Math.round(n * 1000000) / 1000000; }
  return {
    type: 'Polygon',
    coordinates: [[
      [r(minLon), r(minLat)],
      [r(maxLon), r(minLat)],
      [r(maxLon), r(maxLat)],
      [r(minLon), r(maxLat)],
      [r(minLon), r(minLat)]
    ]]
  };
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
  // very small Douglas-Peucker-like pass in degrees (indicative only)
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
  var tol = 0.00008; // ~8-9m, indicative
  if (geom.type === 'Point') return { type: 'Point', coordinates: geom.coordinates };
  if (geom.type === 'Polygon' && geom.coordinates && geom.coordinates[0]) {
    return { type: 'Polygon', coordinates: [simplifyRing(geom.coordinates[0], tol)] };
  }
  if (geom.type === 'MultiPolygon' && geom.coordinates) {
    return { type: 'MultiPolygon', coordinates: geom.coordinates.map(function (p) { return [simplifyRing(p[0], tol)]; }).slice(0, 10) };
  }
  return null;
}
function ringArea(coords) {
  var a = 0;
  if (!coords || coords.length < 4) return 0;
  for (var i = 0, j = coords.length - 1; i < coords.length; j = i++) {
    a += (coords[j][0] + coords[i][0]) * (coords[j][1] - coords[i][1]);
  }
  return Math.abs(a / 2);
}

async function handleSubmission(body, ip, env) {
  var honeypot = asciiOnly((body && body.website) || '');
  if (honeypot) return { status: 200, body: { ok: true, queued: true } }; // silent drop

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
    if (EXPLICIT_SETT_LOC_RE.test(textScan) && SENSITIVE_TERMS_RE.test(textScan)) {
      // Pinpoint sett in private/residential area cannot be generalised safely
      geom = null;
      status = 'withheld_sensitive';
      holdReason = 'explicit_sett_location_withheld';
      auditLogs.push({
        timestamp: nowIso,
        action: 'withhold_geometry',
        rule: 'Protection of Badgers Act 1992',
        reason: 'explicit_sett_location_pinpoint_risk'
      });
    } else {
      // Default to generalising, not hiding: snap to 500m grid square
      geom = generaliseTo500mGrid(geom);
      isGeneralised = true;
      notes = sanitizeBadgerText(notes);
      place = sanitizeBadgerText(place);
      street = sanitizeBadgerText(street);
      auditLogs.push({
        timestamp: nowIso,
        action: 'generalise_500m_grid',
        rule: 'Protection of Badgers Act 1992',
        reason: 'badger_presence_generalised_500m'
      });
    }
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
      generalisation_grid: isGeneralised ? '500m' : null,
      privacy_protection: isSensitive ? 'Protection of Badgers Act 1992' : null,
      hold_reason: holdReason,
      photo_restricted: photoRestricted,
      audit_log: auditLogs
    }
  };

  // Create a GitHub PR with the submission as a draft JSON file (moderation queue).
  var owner = env.GITHUB_OWNER;
  var repo = env.GITHUB_REPO;
  var token = env.GITHUB_TOKEN;
  var base = env.GITHUB_BRANCH || 'main';
  if (!owner || !repo || !token) {
    return { status: 503, body: { ok: false, error: 'Submissions are not configured yet. Please use the contact form for now.' } };
  }

  var ts = Date.now();
  var short = Math.random().toString(36).slice(2, 8);
  var branch = 'community/submission-' + ts + '-' + short;
  var path = 'az-viewer/data/submissions/pending-' + ts + '-' + short + '.json';
  var content = JSON.stringify(record, null, 2) + '\n';
  var b64 = btoa(unescape(encodeURIComponent(content)));

  try {
    var refRes = await gh(token, 'GET', '/repos/' + owner + '/' + repo + '/git/ref/heads/' + base);
    if (!refRes.ok) throw new Error('base ref');
    var refData = await refRes.json();
    var sha = refData.object.sha;

    var mk = await gh(token, 'POST', '/repos/' + owner + '/' + repo + '/git/refs', { ref: 'refs/heads/' + branch, sha: sha });
    if (!mk.ok) throw new Error('branch');

    var put = await gh(token, 'PUT', '/repos/' + owner + '/' + repo + '/contents/' + path, {
      message: 'community: pending submission ' + ts,
      content: b64,
      branch: branch
    });
    if (!put.ok) throw new Error('content');

    var prTitle = isBadger
      ? 'Community submission [BADGER - 500m Generalised] ' + nowIso.slice(0, 10)
      : (holdReason
        ? 'Community submission [HELD - ' + holdReason + '] ' + nowIso.slice(0, 10)
        : 'Community submission (pending review) ' + nowIso.slice(0, 10));

    var prBody = 'Pending community map submission.\n' +
      'Species: ' + (record.properties.species || 'unclassified') + '\n' +
      'Status: ' + status + '\n' +
      (isGeneralised ? 'Protection: Generalised to 500m grid cell per Protection of Badgers Act 1992 (raw pin never stored).\n' : '') +
      (holdReason ? 'Hold reason: ' + holdReason + '\n' : '') +
      'Indicative only, no house numbers, no precise wildlife locations. Approve by merging into approved community data; reject by closing.';

    var pr = await gh(token, 'POST', '/repos/' + owner + '/' + repo + '/pulls', {
      title: prTitle,
      head: branch,
      base: base,
      body: prBody
    });
    if (!pr.ok) throw new Error('pr');
    var prData = await pr.json();
    return { status: 200, body: { ok: true, queued: true, message: 'Thank you. Your suggestion was queued for review before it appears on the map.' } };
  } catch (e) {
    return { status: 502, body: { ok: false, error: 'Could not queue the suggestion right now. Please try the contact form.' } };
  }
}

async function gh(token, method, path, body) {
  return fetch('https://api.github.com' + path, {
    method: method,
    headers: {
      'Authorization': 'Bearer ' + token,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'green-corridor-community-worker'
    },
    body: body ? JSON.stringify(body) : undefined
  });
}

async function hashIp(ip) {
  try {
    var data = new TextEncoder().encode(String(ip || '') + ':gc-community');
    var buf = await crypto.subtle.digest('SHA-256', data);
    var arr = Array.from(new Uint8Array(buf)).slice(0, 8);
    return arr.map(function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  } catch (e) { return ''; }
}
