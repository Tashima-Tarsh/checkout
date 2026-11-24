import {palette,observedMarker,classifyExperiment} from '/assets/split-screen-pixel-probe.mjs';
const el=id=>document.getElementById(id);
const q=new URLSearchParams(location.search),given=q.get('target');
if(given&&/^[0-5]{4}$/.test(given)&&new Set(given).size===4){
 el('open').hidden=el('start').hidden=true;
 el('instructions').textContent='Synthetic target only. Keep this visible in the second pane.';
 for(const c of given){const band=document.createElement('span');band.style.backgroundColor='rgb('+palette[Number(c)].join(',')+')';el('target').append(band);}
}else{
 const candidates=[0,1,2,3,4,5],challenge=[];
 while(challenge.length<4){const value=crypto.getRandomValues(new Uint32Array(1))[0];challenge.push(candidates.splice(value%candidates.length,1)[0]);}
 const url=new URL(location.href);url.search='';url.searchParams.set('target',challenge.join(''));el('open').href=url.href;
 const begin=performance.now();
 const supported=typeof navigator.mediaDevices?.getDisplayMedia==='function';
 el('result').textContent=supported?'Capture API available. Select only the synthetic target tab.':'CAPTURE_UNSUPPORTED';
 el('start').disabled=!supported;
 el('start').onclick=async()=>{
  el('start').disabled=true;
  let stream,video,canvas;
  try{
   stream=await navigator.mediaDevices.getDisplayMedia({video:{displaySurface:'browser'},audio:false});
   if(stream.getVideoTracks()[0]?.getSettings().displaySurface!=='browser')throw Error('SELECT_SYNTHETIC_TAB_ONLY');
   if(performance.now()-begin>120000)throw Error('WINDOW_EXPIRED');
   video=document.createElement('video');video.muted=true;video.srcObject=stream;await Promise.race([video.play(),new Promise((_,reject)=>setTimeout(()=>reject(Error('FRAME_TIMEOUT')),4000))]);
   if(!video.videoWidth||!video.videoHeight||video.videoWidth*video.videoHeight>12000000)throw Error('FRAME_UNAVAILABLE');
   canvas=document.createElement('canvas');canvas.width=video.videoWidth;canvas.height=video.videoHeight;
   const context=canvas.getContext('2d');context.drawImage(video,0,0);
   const pixels=context.getImageData(0,0,canvas.width,canvas.height);
   const markerObserved=observedMarker(pixels.data,canvas.width,canvas.height,challenge);
   pixels.data.fill(0);
   el('result').textContent=classifyExperiment({supported:true,consented:true,markerObserved,elapsedMs:performance.now()-begin});
  }catch(e){el('result').textContent=['WINDOW_EXPIRED','SELECT_SYNTHETIC_TAB_ONLY','FRAME_TIMEOUT','FRAME_UNAVAILABLE'].includes(e.message)?e.message:'CAPTURE_NOT_AVAILABLE_OR_DENIED';}
  finally{stream?.getTracks().forEach(t=>t.stop());if(video)video.srcObject=null;if(canvas){canvas.width=0;canvas.height=0;}}
 };
}