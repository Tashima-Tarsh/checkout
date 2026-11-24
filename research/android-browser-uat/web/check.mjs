// Offline classifier, not payment verification.
export function classify({expected, observed, explicitDisclosure=false}) {
 if (!/^LAB-[a-f0-9]{32}$/.test(expected)) return 'INVALID_CANARY';
 if (!Array.isArray(observed) || !observed.every(x=>typeof x==='string')) return 'INVALID_OBSERVATION';
 if (!observed.includes(expected)) return 'NO_EXPOSURE_OBSERVED';
 return explicitDisclosure ? 'POSITIVE_CONTROL_ONLY' : 'CANDIDATE_EXPOSURE_REQUIRES_INVESTIGATION';
}
