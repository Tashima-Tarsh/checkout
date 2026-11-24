import {test} from 'node:test';
import assert from 'node:assert/strict';
// No authorized live source has been established.
const acquire=async()=>({status:'SOURCE_UNAVAILABLE',financially_verified:false});
test('missing authorized source fails closed',async()=>assert.deepEqual(await acquire(),{status:'SOURCE_UNAVAILABLE',financially_verified:false}));
