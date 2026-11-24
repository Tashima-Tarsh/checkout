import {test} from 'node:test';
import assert from 'node:assert/strict';
test('cooperating message endpoints carry claims, not debit proof', async()=>{
 const channel=new MessageChannel();
 try {
 const received=new Promise(resolve=>channel.port2.onmessage=e=>resolve(e.data));
 channel.port1.postMessage({kind:'synthetic-receipt',session:'lab'});
 assert.deepEqual(await received,{kind:'synthetic-receipt',session:'lab'});
 } finally {channel.port1.close();channel.port2.close();}
});
