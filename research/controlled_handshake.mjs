// Synthetic lab only. Keys are provisioned to cooperating test endpoints.
import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
const mac=(key,parts)=>createHmac('sha256',key).update(JSON.stringify(parts)).digest('hex');
export function endpoint(key,clock=Date.now){
 if(!Buffer.isBuffer(key)||key.length<32)throw Error('invalid key');
 const sessions=new Map();
 return {
 open(){const id=randomBytes(16).toString('hex'),nonce=randomBytes(32).toString('hex'),expires=clock()+90000;const c={id,nonce,expires};sessions.set(id,{...c,seq:0});return {...c,tag:mac(key,['challenge',id,nonce,expires])};},
 receive(e){const s=sessions.get(e?.id);if(!s||clock()>=s.expires||e.seq!==s.seq+1||e.seq>128||!['depart','return','synthetic-receipt'].includes(e.kind)||typeof e.tag!=='string'||!/^[a-f0-9]{64}$/.test(e.tag))return false;
 const expected=mac(key,['event',s.id,s.nonce,s.expires,e.seq,e.kind]);if(!timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(e.tag,'hex')))return false;s.seq=e.seq;return true;},
 close(id){sessions.delete(id);}
 };
}
export function syntheticPeer(key,c,clock=Date.now){
 if(clock()>=c.expires||c.tag!==mac(key,['challenge',c.id,c.nonce,c.expires]))throw Error('invalid challenge');
 let seq=0;return kind=>{if(clock()>=c.expires)throw Error('expired');const n=++seq;return {id:c.id,seq:n,kind,tag:mac(key,['event',c.id,c.nonce,c.expires,n,kind])};};
}
