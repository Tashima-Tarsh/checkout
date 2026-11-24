// Synthetic visual acquisition experiment. Never a payment verdict.
export const palette = [[230,30,110],[25,190,230],[240,185,20],[95,210,65],[125,55,215],[235,95,30]];
export function observedMarker(data,width,height,challenge){
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<48||height<12||
     width*height>12000000||data.length!==width*height*4||
     !Array.isArray(challenge)||challenge.length!==4||
     challenge.some(i=>!Number.isInteger(i)||!palette[i])||new Set(challenge).size!==4) return false;
  const close=(offset,c)=>Math.abs(data[offset]-c[0])+Math.abs(data[offset+1]-c[1])+Math.abs(data[offset+2]-c[2])<=24;
  // Four adjacent distinct color bands, each at least 12 pixels wide,
  // on three neighboring sampled rows. No frame storage or transmission.
  function rowMatch(y){
    let index=0,run=0;
    for(let x=0;x<width;x++){
      const at=(y*width+x)*4;
      if(close(at,palette[challenge[index]])){run++;if(index===3&&run>=12)return true;continue;}
      if(run>=12&&index<3&&close(at,palette[challenge[index+1]])){index++;run=1;continue;}
      index=0;run=close(at,palette[challenge[0]])?1:0;
    }
    return false;
  }
  for(let y=0;y+8<height;y+=4)if(rowMatch(y)&&rowMatch(y+4)&&rowMatch(y+8))return true;
  return false;
}
export function classifyExperiment({supported,consented,markerObserved,elapsedMs}){
  if(!supported)return 'CAPTURE_UNSUPPORTED';
  if(!consented)return 'CAPTURE_NOT_AUTHORIZED';
  if(!Number.isFinite(elapsedMs)||elapsedMs<0||elapsedMs>120000)return 'WINDOW_EXPIRED';
  return markerObserved?'SYNTHETIC_PIXELS_OBSERVED':'MARKER_NOT_OBSERVED';
}
