import {test} from 'node:test';
import assert from 'node:assert/strict';
const matches=(order,claim,now)=>Number.isSafeInteger(now)&&now>=order.start&&now<order.end&&['id','amount','recipient','nonce'].every(k=>claim[k]===order[k]);
test('exact synthetic scope and deadline',()=>{
 const order={id:'lab',amount:100,recipient:'fixture',nonce:'test',start:0,end:90000};
 assert.equal(matches(order,order,1),true);
 for(const k of ['id','amount','recipient','nonce']) assert.equal(matches(order,{...order,[k]:null},1),false);
 for(const t of [-1,90000,NaN]) assert.equal(matches(order,order,t),false);
 // Matching is not financial verification.
});
