import assert from 'node:assert/strict';import {classify} from './check.mjs';
const expected='LAB-'+'a'.repeat(32);
assert.equal(classify({expected,observed:[]}), 'NO_EXPOSURE_OBSERVED');
assert.equal(classify({expected,observed:['LAB-'+'b'.repeat(32)]}), 'NO_EXPOSURE_OBSERVED');
assert.equal(classify({expected,observed:[expected],explicitDisclosure:true}), 'POSITIVE_CONTROL_ONLY');
assert.equal(classify({expected,observed:[expected]}), 'CANDIDATE_EXPOSURE_REQUIRES_INVESTIGATION');
assert.equal(classify({expected:'bad',observed:[]}), 'INVALID_CANARY');
assert.equal(classify({expected,observed:[null]}), 'INVALID_OBSERVATION');
console.log('6 classifier assertions passed (synthetic fixtures only)');
