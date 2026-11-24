import test from 'node:test';
import assert from 'node:assert/strict';
import {visionMessage} from '../checkout/agentic_assets/checkout-vision.mjs';
const base={financially_verified:false, checkout_changed:false};
test('only a real classifier result can complete the visual research step',()=>{
  assert.equal(visionMessage({...base,decision:'VISUAL_SUCCESS',advance_research:true}), 'Visual payment success recognized. Research analysis complete.');
  assert.match(visionMessage({...base,visual_status:'SUCCESS_RECOGNIZED',decision:'AMOUNT_UNCONFIRMED'}), /Amount uncertain/);
  assert.equal(visionMessage({...base,decision:'NOT_SUCCESS'}),'Payment success not recognized.');
  assert.equal(visionMessage({...base,decision:'VISUAL_SUCCESS',advance_research:false}),'Payment success not recognized.');
  assert.equal(visionMessage({...base,financially_verified:true,decision:'VISUAL_SUCCESS',advance_research:true}),'Vision analysis unavailable.');
  assert.equal(visionMessage(null),'Vision analysis unavailable.');
});
