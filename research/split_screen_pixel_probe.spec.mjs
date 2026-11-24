import {test} from 'node:test';
import assert from 'node:assert/strict';
import {palette,observedMarker,classifyExperiment} from './split_screen_pixel_probe.mjs';
const challenge=[2,0,4,1],w=100,h=24;
function frame(order){
  const data=new Uint8ClampedArray(w*h*4);
  for(let y=4;y<20;y++)for(let x=10;x<90;x++){
    const c=palette[order[Math.floor((x-10)/20)]];
    data.set([...c,255],(y*w+x)*4);
  }
  return data;
}
test('actual pixel bytes required; matching synthetic target is detected',()=>{
  assert.equal(observedMarker(frame(challenge),w,h,challenge),true);
  assert.equal(observedMarker(frame([1,4,0,2]),w,h,challenge),false);
  assert.equal(observedMarker(new Uint8ClampedArray(w*h*4),w,h,challenge),false);
  assert.equal(observedMarker(frame(challenge),w,h,[0,0,0,0]),false);
});
test('focus, notification timing or an expired window cannot replace pixels',()=>{
  const good={supported:true,consented:true,markerObserved:true,elapsedMs:1000};
  assert.equal(classifyExperiment(good),'SYNTHETIC_PIXELS_OBSERVED');
  assert.equal(classifyExperiment({...good,markerObserved:false}),'MARKER_NOT_OBSERVED');
  assert.equal(classifyExperiment({...good,supported:false}),'CAPTURE_UNSUPPORTED');
  assert.equal(classifyExperiment({...good,consented:false}),'CAPTURE_NOT_AUTHORIZED');
  assert.equal(classifyExperiment({...good,elapsedMs:120001}),'WINDOW_EXPIRED');
});
