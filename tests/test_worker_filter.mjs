/**
 * Test suite for sensitive species filter in worker-safe.js
 * Run with: node tests/test_worker_filter.mjs
 */
import assert from 'node:assert';
import {
  isBadgerRecord,
  hasSensitive,
  generaliseTo500mGrid,
  sanitizeBadgerText,
  stripHouseNumber
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

// 3. generaliseTo500mGrid tests
var rawPoint = { type: 'Point', coordinates: [-1.785432, 51.562341] };
var genPoly = generaliseTo500mGrid(rawPoint);
assert.strictEqual(genPoly.type, 'Polygon', 'Must be converted to a Polygon');
assert.strictEqual(Array.isArray(genPoly.coordinates), true, 'Must have coordinates array');
assert.strictEqual(genPoly.coordinates[0].length, 5, 'Must be a closed 5-vertex ring');

// Verify 500m grid resolution (~0.008 lon, ~0.005 lat)
var ring = genPoly.coordinates[0];
var minLon = ring[0][0], minLat = ring[0][1];
var maxLon = ring[2][0], maxLat = ring[2][1];
assert.ok(Math.abs((maxLon - minLon) - 0.008) < 0.0001, 'Longitude step must be 0.008 deg (~554m)');
assert.ok(Math.abs((maxLat - minLat) - 0.005) < 0.0001, 'Latitude step must be 0.005 deg (~556m)');

// Verify that the original pinpoint is safely contained within the 500m cell
assert.ok(rawPoint.coordinates[0] >= minLon && rawPoint.coordinates[0] <= maxLon, 'Raw lon inside grid cell');
assert.ok(rawPoint.coordinates[1] >= minLat && rawPoint.coordinates[1] <= maxLat, 'Raw lat inside grid cell');

// Verify polygon input generalisation
var rawPoly = {
  type: 'Polygon',
  coordinates: [[
    [-1.785, 51.560],
    [-1.784, 51.560],
    [-1.784, 51.561],
    [-1.785, 51.561],
    [-1.785, 51.560]
  ]]
};
var genPoly2 = generaliseTo500mGrid(rawPoly);
assert.strictEqual(genPoly2.type, 'Polygon', 'Polygon input must also snap to 500m grid');
console.log('  PASS: generaliseTo500mGrid math tests');

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
import { handleSubmission } from '../worker/worker-safe.js';

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

// Test A: Badger tag + precise pin -> snaps to 500m polygon, pin never stored
capturedPuts = [];
var resA = await handleSubmission({
  geometry: { type: 'Point', coordinates: [-1.785, 51.560] },
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
assert.strictEqual(recA.geometry.type, 'Polygon', 'Badger pin must be converted to Polygon');
assert.strictEqual(recA.geometry.coordinates[0].length, 5, 'Must be 500m grid polygon');
assert.strictEqual(recA.properties.species, 'badger', 'Species must be badger');
assert.strictEqual(recA.properties.sensitive_species, true, 'sensitive_species must be true');
assert.strictEqual(recA.properties.generalised, true, 'generalised must be true');
assert.strictEqual(recA.properties.generalisation_grid, '500m', 'grid must be 500m');
assert.strictEqual(recA.properties.privacy_protection, 'Protection of Badgers Act 1992', 'protection law must be recorded');
assert.strictEqual(recA.properties.audit_log[0].action, 'generalise_500m_grid', 'audit log action must match');
console.log('  PASS: Test A - Badger tag + precise pin generalised to 500m grid polygon');

// Test B: Badger mentioned in free text without species tag -> detected, generalised
capturedPuts = [];
var resB = await handleSubmission({
  geometry: { type: 'Point', coordinates: [-1.785, 51.560] },
  attributes: {
    place: 'Field Boundary',
    street: 'Croft Road',
    species: '',
    notes: 'Active badger sett spotted near the hedgerow'
  }
}, '127.0.0.1', mockEnv);

assert.strictEqual(resB.status, 200, 'Submission B should succeed');
var recB = capturedPuts[0].record;
assert.strictEqual(recB.geometry.type, 'Polygon', 'Badger in text must trigger Polygon generalisation');
assert.strictEqual(recB.properties.species, 'badger', 'Detected badger species');
assert.strictEqual(recB.properties.notes.includes('badger sett'), false, 'badger sett must be sanitized');
assert.strictEqual(recB.properties.notes.includes('badger presence'), true, 'sanitized to badger presence');
assert.strictEqual(recB.properties.generalised, true, 'generalised flag set');
assert.strictEqual(recB.properties.audit_log[0].action, 'generalise_500m_grid', 'audit log records generalisation');
console.log('  PASS: Test B - Badger free text detected and generalised');

// Test C: Explicit sett at residential number -> geometry withheld completely
capturedPuts = [];
var resC = await handleSubmission({
  geometry: { type: 'Point', coordinates: [-1.785, 51.560] },
  attributes: {
    place: 'Garden',
    street: 'sett at number 42 High Street',
    species: 'badger',
    notes: 'sett located in garden of number 42'
  }
}, '127.0.0.1', mockEnv);

assert.strictEqual(resC.status, 200, 'Submission C should succeed');
var recC = capturedPuts[0].record;
assert.strictEqual(recC.geometry, null, 'Explicit residential sett location geometry must be withheld');
assert.strictEqual(recC.properties.status, 'withheld_sensitive', 'Status must be withheld_sensitive');
assert.strictEqual(recC.properties.hold_reason, 'explicit_sett_location_withheld', 'Hold reason must be recorded');
assert.strictEqual(recC.properties.audit_log[0].action, 'withhold_geometry', 'Audit log must record withhold_geometry');
console.log('  PASS: Test C - Explicit sett location at house number withheld');

// Test D: Unclassified species -> default to held for review
capturedPuts = [];
var resD = await handleSubmission({
  geometry: { type: 'Point', coordinates: [-1.785, 51.560] },
  attributes: {
    place: 'Town Gardens',
    street: 'Quarry Road',
    species: '',
    notes: 'Nice grove of mature oak trees'
  }
}, '127.0.0.1', mockEnv);

assert.strictEqual(resD.status, 200, 'Submission D should succeed');
var recD = capturedPuts[0].record;
assert.strictEqual(recD.properties.species, 'unclassified', 'Unclassified species tag');
assert.strictEqual(recD.properties.status, 'pending_review', 'Unclassified status defaults to pending_review');
assert.strictEqual(recD.properties.hold_reason, 'unclassified_species_default_held', 'Hold reason set');
assert.strictEqual(recD.properties.audit_log[0].action, 'hold_for_review', 'Audit log records hold_for_review');
console.log('  PASS: Test D - Unclassified record defaults to held');

// Restore original fetch
globalThis.fetch = originalFetch;

console.log('ALL WORKER INTEGRATION & GENERALISATION TESTS PASSED SUCCESSFULLY.');
