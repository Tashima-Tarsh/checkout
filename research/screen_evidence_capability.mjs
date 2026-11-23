/**
 * Consent-only screen evidence feasibility probe.
 *
 * Does not record, transmit, analyze, or store pixels. The browser permission
 * picker requires an explicit user action. A captured screen is payer-controlled
 * and never, by itself, authenticates a debit.
 */
export class ScreenEvidenceCapability {
  constructor({mediaDevices, now=()=>Date.now()}={}) {
    this.mediaDevices = mediaDevices;
    this.now = now;
    this.stream = null;
    this.requestedAt = null;
  }
  available() {
    return typeof this.mediaDevices?.getDisplayMedia === 'function';
  }
  async requestFromUserAction() {
    if (!this.available()) return {supported:false, status:'UNSUPPORTED', debitVerified:false};
    if (this.stream) return {supported:true,status:'ALREADY_ACTIVE',debitVerified:false};
    try {
      const stream = await this.mediaDevices.getDisplayMedia({video:true,audio:false});
      const tracks = stream.getVideoTracks?.()??[];
      if (!tracks.length) {
        stream.getTracks?.().forEach(track=>track.stop?.());
        return {supported:true,status:'NO_VIDEO_TRACK',debitVerified:false};
      }
      this.stream = stream;
      this.requestedAt = this.now();
      const capture = tracks[0];
      capture.addEventListener?.('ended',()=>{this.stream=null});
      return {supported:true,status:'CONSENTED_TRACK_READY',debitVerified:false};
    } catch (error) {
      const reason = error?.name==='NotAllowedError'?'USER_DENIED_OR_BLOCKED'
        :error?.name==='InvalidStateError'?'NO_USER_ACTIVATION_OR_FOCUS'
        :'CAPTURE_FAILED';
      return {supported:true,status:reason,debitVerified:false};
    }
  }
  stop() {
    const stream = this.stream;
    this.stream = null;
    stream?.getTracks?.().forEach(track=>track.stop?.());
    return {status:'STOPPED',debitVerified:false};
  }
  snapshot() {
    return Object.freeze({
      supported:this.available(),
      active:this.stream!==null,
      startedAt:this.requestedAt,
      retainedFrames:0,
      debitVerified:false
    });
  }
}
