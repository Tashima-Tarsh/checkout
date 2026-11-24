// Diagnostic Bayesian model with illustrative likelihoods, not trained or calibrated.
export function fuse({returned=false,matched=false,replay=false,expired=false}={}){
 const anomalies=[];if(replay)anomalies.push('REPLAY');if(expired)anomalies.push('EXPIRED');
 // Return is deliberately neutral: cancel and success can look identical.
 const prior=0.5, likelihood=matched?2:1;
 const score=anomalies.length?0:(prior*likelihood)/(1-prior+prior*likelihood);
 return {score,anomalies,returned:returned===true,model:'synthetic-uncalibrated',financially_verified:false};
}
