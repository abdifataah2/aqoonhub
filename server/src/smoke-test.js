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

const fakeToken='not-a-real-jwt';
const noAuth=await fetch(origin+'/api/schools/demo/admin/summary');
assert.ok([401,403].includes(noAuth.status),'Admin API must reject missing credentials');
const badAuth=await fetch(origin+'/api/schools/demo/admin/summary',{headers:{Authorization:'Bearer '+fakeToken}});
assert.ok([401,403].includes(badAuth.status),'Admin API must reject forged credentials');
const malformedLogin=await fetch(origin+'/api/schools/INVALID%20SLUG/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'not-email',password:'x'})});
assert.equal(malformedLogin.status,404,'Invalid school slug must be rejected');
console.log('Authentication boundary checks passed');
