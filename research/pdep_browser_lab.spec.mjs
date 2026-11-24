import {test} from 'node:test';
import assert from 'node:assert/strict';
test('isolated same-origin channel delivers synthetic messages',async()=>{
 const name='pdep-lab-'+crypto.randomUUID(),a=new BroadcastChannel(name),b=new BroadcastChannel(name);
 try{const received=new Promise(resolve=>b.onmessage=e=>resolve(e.data));a.postMessage({type:'fixture',verified:false});assert.deepEqual(await received,{type:'fixture',verified:false});}finally{a.close();b.close();}
});
