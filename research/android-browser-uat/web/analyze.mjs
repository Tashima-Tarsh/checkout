import {readFileSync} from 'node:fs';import {classify} from './check.mjs';
const [file, expected]=process.argv.slice(2);
if(!file||!/^LAB-[a-f0-9]{32}$/.test(expected??''))process.exit(2);
const {events}=JSON.parse(readFileSync(file,'utf8'));
if(!Array.isArray(events))throw Error('Invalid log');
const explicit=events.some(e=>e.type==='explicit_positive_control'&&e.canary===expected);
console.log(JSON.stringify({result:classify({expected,observed:events.filter(e=>typeof e.canary==='string').map(e=>e.canary),explicitDisclosure:explicit}),coverage:'Logged lifecycle and intentional controls only; not a scanner.'},null,2));
