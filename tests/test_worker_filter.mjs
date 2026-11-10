/**
 * Test suite for sensitive species filter in worker-safe.js
 * Run with: node tests/test_worker_filter.mjs
 */
import assert from 'node:assert';
import {
  isBadgerRecord,
  hasSensitive,
  snapToCouncilHq,
  sanitizeBadgerText,
  stripHouseNumber,
  COUNCIL_HQ_POLYGON,
  handleSubmission
} from '../worker/worker-safe.js';

console.log('Testing sensitive species filter in worker-safe.js...');

// 1. isBadgerRecord tests
assert.strictEqual(isBadgerRecord('badger', ''), true, 'species tag "badger" should match');
assert.strictEqual(isBadgerRecord('Badgers', ''), true, 'species tag "Badgers" should match');
assert.strictEqual(isBadgerRecord('meles meles', ''), true, 'species tag "meles meles" should match');
assert.strictEqual(isBadgerRecord('', 'Saw a badger crossing'), true, 'free text "badger" should match');
assert.strictEqual(isBadgerRecord('', 'Active sett found in hedge'), true, 'free text "sett" should match');
assert.strictEqual(isBadgerRecord('', 'Two setts near field edge'), true, 'free text "setts" should match');
assert.strictEqual(isBadgerRecord('', 'Brock spotted at dusk'), true, 'free text "brock" should match');
assert.strictEqual(isBadgerRecord('birds', 'Robins and starlings'), false, 'birds should not match badger');
assert.strictEqual(isBadgerRecord('', 'Green field with trees'), false, 'plain green space should not match badger');
console.log('  PASS: isBadgerRecord detection tests');

// 2. hasSensitive tests
assert.strictEqual(hasSensitive('sett entrance here'), true, 'sett is sensitive');
assert.strictEqual(hasSensitive('bird nest in tree'), true, 'nest is sensitive');
assert.strictEqual(hasSensitive('bat roost in attic'), true, 'roost is sensitive');
assert.strictEqual(hasSensitive('fox den near bank'), true, 'den is sensitive');
assert.strictEqual(hasSensitive('nice walking route'), false, 'walking route is not sensitive');
console.log('  PASS: hasSensitive shelter detection tests');

// 3. snapToCouncilHq tests (Swindon Borough Council Civic Offices, Euclid St)
var rawPoint = { type: 'Point', coordinates: [-1.785432, 51.562341] };
var hqPoly = snapToCouncilHq(rawPoint);
assert.strictEqual(hqPoly.type, 'Polygon', 'Must be converted to a Polygon');
assert.strictEqual(Array.isArray(hqPoly.coordinates), true, 'Must have coordinates array');
assert.strictEqual(hqPoly.coordinates[0].length, 5, 'Must be a closed 5-vertex ring');

// Verify coordinates encompass Civic Offices (-1.77796, 51.56011)
var ring = hqPoly.coordinates[0];
var minLon = Math.min(...ring.map(p => p[0]));
var maxLon = Math.max(...ring.map(p => p[0]));
var minLat = Math.min(...ring.map(p => p[1]));
var maxLat = Math.max(...ring.map(p => p[1]));
assert.ok(minLon <= -1.77796 && -1.77796 <= maxLon, 'Council HQ lon must be inside polygon bounds');
assert.ok(minLat <= 51.56011 && 51.56011 <= maxLat, 'Council HQ lat must be inside polygon bounds');
console.log('  PASS: snapToCouncilHq geometry tests');

// 4. sanitizeBadgerText tests
assert.strictEqual(
  sanitizeBadgerText('Active sett entrance near bushes'),
  'Active [presence noted] near bushes',
  'sett entrance should be sanitized'
);
assert.strictEqual(
  sanitizeBadgerText('Main badger sett discovered'),
  'Main badger presence discovered',
  'badger sett should be sanitized'
);
assert.strictEqual(
  sanitizeBadgerText('42 High Street'),
  'High Street',
  'house numbers should be stripped'
);
assert.strictEqual(
  sanitizeBadgerText('Flat 3B, 15 Church Road'),
  'Church Road',
  'flat/unit numbers should be stripped'
);
console.log('  PASS: sanitizeBadgerText redaction tests');

// 5. handleSubmission end-to-end integration tests (with mock GitHub fetch)
var capturedPuts = [];
var originalFetch = globalThis.fetch;

globalThis.fetch = async function (url, opts) {
  var u = String(url);
  if (u.includes('/git/ref/heads/')) {
    return new Response(JSON.stringify({ object: { sha: 'mock-sha-123' } }), { status: 200 });
  }
  if (u.includes('/git/refs')) {
    return new Response(JSON.stringify({ ref: 'mock-ref' }), { status: 201 });
  }
  if (u.includes('/contents/')) {
    var bodyObj = JSON.parse(opts.body);
    var contentJson = JSON.parse(atob(bodyObj.content));
    capturedPuts.push({ url: u, record: contentJson, message: bodyObj.message });
    return new Response(JSON.stringify({ content: { sha: 'file-sha-456' } }), { status: 201 });
  }
  if (u.includes('/pulls')) {
    return new Response(JSON.stringify({ number: 99, html_url: 'https://github.com/mock/pr/99' }), { status: 201 });
  }
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};

var mockEnv = {
  GITHUB_OWNER: 'testowner',
  GITHUB_REPO: 'testrepo',
  GITHUB_TOKEN: 'testtoken',
  GITHUB_BRANCH: 'main'
};

// Test A: Badger tag + precise pin -> snapped to Swindon Borough Council Civic Offices
capturedPuts = [];
var resA = await handleSubmission({
  geometry: { type: 'Point', coordinates: [-1.820, 51.580] },
  attributes: {
    place: 'Coate Water',
    street: 'Marlborough Road',
    species: 'badger',
    notes: 'Badger foraging at dusk'
  }
}, '127.0.0.1', mockEnv);

assert.strictEqual(resA.status, 200, 'Submission A should succeed');
assert.strictEqual(capturedPuts.length, 1, 'Should have created 1 file');
var recA = capturedPuts[0].record;
assert.strictEqual(recA.geometry.type, 'Polygon', 'Badger pin must be converted to Council HQ Polygon');
assert.strictEqual(recA.geometry.coordinates[0].length, 5, 'Must be closed polygon');
assert.strictEqual(recA.properties.species, 'badger', 'Species must be badger');
assert.strictEqual(recA.properties.sensitive_species, true, 'sensitive_species must be true');
assert.strictEqual(recA.properties.generalised, true, 'generalised must be true');
assert.strictEqual(recA.properties.generalisation_mode, 'council_hq_swindon', 'mode must be council_hq_swindon');
assert.strictEqual(recA.properties.place, 'Swindon Borough Council Civic Offices', 'place must be snapped to Council Offices');
assert.strictEqual(recA.properties.street_area, 'Euclid Street, Swindon SN1 2JH', 'street must be Euclid Street');
assert.strictEqual(recA.properties.privacy_protection, 'Protection of Badgers Act 1992', 'protection law must be recorded');
assert.strictEqual(recA.properties.audit_log[0].action, 'snap_to_council_hq', 'audit log action must match');
console.log('  PASS: Test A - Badger tag + pin snapped to Swindon Borough Council Civic Offices');

// Test B: Badger mentioned in free text without species tag -> detected, snapped to Council HQ
capturedPuts = [];
var resB = await handleSubmission({
  geometry: { type: 'Point', coordinates: [-1.750, 51.540] },
  attributes: {
    place: 'Field Boundary',
    street: 'Croft Road',
    species: '',
    notes: 'Active badger sett spotted near the hedgerow'
  }
}, '127.0.0.1', mockEnv);

assert.strictEqual(resB.status, 200, 'Submission B should succeed');
var recB = capturedPuts[0].record;
assert.strictEqual(recB.geometry.type, 'Polygon', 'Badger in text must snap to Council HQ Polygon');
assert.strictEqual(recB.properties.species, 'badger', 'Detected badger species');
assert.strictEqual(recB.properties.place, 'Swindon Borough Council Civic Offices', 'place snapped to Council HQ');
assert.strictEqual(recB.properties.notes.includes('badger sett'), false, 'badger sett must be sanitized');
assert.strictEqual(recB.properties.notes.includes('badger presence'), true, 'sanitized to badger presence');
assert.strictEqual(recB.properties.generalised, true, 'generalised flag set');
assert.strictEqual(recB.properties.audit_log[0].action, 'snap_to_council_hq', 'audit log records snap_to_council_hq');
console.log('  PASS: Test B - Badger free text detected and snapped to Council HQ');

// Test C: Unclassified species -> default to held for review
capturedPuts = [];
var resC = await handleSubmission({
  geometry: { type: 'Point', coordinates: [-1.785, 51.560] },
  attributes: {
    place: 'Town Gardens',
    street: 'Quarry Road',
    species: '',
    notes: 'Nice grove of mature oak trees'
  }
}, '127.0.0.1', mockEnv);

assert.strictEqual(resC.status, 200, 'Submission C should succeed');
var recC = capturedPuts[0].record;
assert.strictEqual(recC.properties.species, 'unclassified', 'Unclassified species tag');
assert.strictEqual(recC.properties.status, 'pending_review', 'Unclassified status defaults to pending_review');
assert.strictEqual(recC.properties.hold_reason, 'unclassified_species_default_held', 'Hold reason set');
assert.strictEqual(recC.properties.audit_log[0].action, 'hold_for_review', 'Audit log records hold_for_review');
console.log('  PASS: Test C - Unclassified record defaults to held');

// Restore original fetch
globalThis.fetch = originalFetch;

console.log('ALL WORKER INTEGRATION & COUNCIL HQ SNAPPING TESTS PASSED SUCCESSFULLY.');
