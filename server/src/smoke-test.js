// Run against a started local API: node src/smoke-test.js
import assert from 'node:assert/strict';
const origin=process.env.API_ORIGIN||'http://localhost:4000';
const health=await fetch(origin+'/api/health');
assert.equal(health.status,200);
assert.equal((await health.json()).status,'ok');
const invalid=await fetch(origin+'/api/schools/INVALID%20SLUG');
assert.equal(invalid.status,404);
const directory=await fetch(origin+'/api/schools');
assert.equal(directory.status,200);
assert.ok(Array.isArray((await directory.json()).schools));
console.log('Basic API smoke tests passed');
