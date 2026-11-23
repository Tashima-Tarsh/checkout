/**
 * Browser capture-continuity experiment. Requires direct click and browser
 * screen-picker consent. Nothing records or transmits screen pixels.
 * Observes whether a capture track survives switch to a second app.
 */
export class LiveCaptureProbe {
  constructor({mediaDevices,clock=()=>performance.now(),onEvent=()=>{}}={}) {
    this.mediaDevices=mediaDevices; this.clock=clock; this.onEvent=onEvent;
    this.stream=null; this.events=[]; this.startedAt=null;
  }
  emit(kind, fields={}) {
    const event={kind, t:this.clock(),...fields};
    this.events.push(event);this.onEvent(event);
    return event;
  }
  async start() {
    if(typeof this.mediaDevices?.getDisplayMedia!=='function'){
      this.emit('CAPTURE_UNSUPPORTED');return {status:'UNSUPPORTED'};
    }
    if(this.stream) return {status:'ALREADY_ACTIVE'};
    this.emit('CAPTURE_CONSENT_REQUESTED');
    try {
      const stream=await this.mediaDevices.getDisplayMedia({video:true,audio:false});
      const track=stream.getVideoTracks?.()[0];
      if(!track){stream.getTracks?.().forEach(t=>t.stop?.());this.emit('NO_VIDEO');return {status:'NO_VIDEO'};}
      this.stream=stream;this.startedAt=this.clock();
      track.addEventListener?.('mute',()=>this.emit('TRACK_MUTED'));
      track.addEventListener?.('unmute',()=>this.emit('TRACK_UNMUTED'));
      track.addEventListener?.('ended',()=>{
        this.emit('TRACK_ENDED');this.stream=null;
      });
      this.emit('CAPTURE_ACTIVE',{
        displaySurface:track.getSettings?.().displaySurface??'unknown',
        readyState:track.readyState??'unknown'
      });
      return {status:'ACTIVE'};
    } catch(e) {
      this.emit('CAPTURE_REJECTED',{name:String(e?.name??'Error')});
      return {status:'REJECTED'};
    }
  }
  onDocumentVisibility(hidden) {
    this.emit(hidden?'PAGE_HIDDEN':'PAGE_VISIBLE',{
      trackState:this.stream?.getVideoTracks?.()[0]?.readyState??'none',
      trackMuted:this.stream?.getVideoTracks?.()[0]?.muted??null
    });
  }
  stop(){
    const stream=this.stream;this.stream=null;
    stream?.getTracks?.().forEach(t=>t.stop?.());
    this.emit('CAPTURE_STOPPED');
  }
  report(){
    return {experiment:'LIVE_CAPTURE_CONTINUITY_V1',
      supported:typeof this.mediaDevices?.getDisplayMedia==='function',
      active:this.stream!==null,events:this.events.map(x=>({...x})),
      savedPixels:0,sharedPixels:0,realDebitObserved:false,
      debitVerified:false};
  }
}
