import test from 'node:test';
import assert from 'node:assert/strict';
import {receiptRecognized} from '../checkout/agentic_assets/checkout-vision.mjs';
const id='a'.repeat(48);
const good={order_id:id,decision:'VISUAL_SUCCESS',advance_research:true,financially_verified:false,checkout_changed:false};
test('receipt recognition requires exact scoped server observation, never implies paid',()=>{
  assert.equal(receiptRecognized(good,id),true);
  for(const bad of [null,{}, {...good,order_id:'wrong'}, {...good,decision:'AMOUNT_UNCONFIRMED'},
    {...good,decision:'NOT_SUCCESS'}, {...good,advance_research:false},
    {...good,financially_verified:true}, {...good,checkout_changed:true}])
    assert.equal(receiptRecognized(bad,id),false);
  assert.equal(receiptRecognized(good,''),false);
});
