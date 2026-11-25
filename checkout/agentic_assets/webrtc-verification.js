// WebRTC Verification Client Bundle
// This is a browser-compatible bundle of the WebRTC verification client

// Export the WebRTC verification classes
// In a real build, this would be bundled by a bundler like esbuild/rollup
// For now, we export the classes directly

// Re-export from the webrtc-verification package
// This file serves as the entry point for the browser

// The actual implementation is in packages/webrtc-verification/src/
// This file would be replaced by a bundled version in production

// For now, we'll create a minimal wrapper that loads the actual implementation
// from the compiled output

console.log('WebRTC Verification module loaded - use dynamic import from packages/webrtc-verification/dist');

// Placeholder - actual implementation loaded via dynamic import
export const MerchantWebRTCClient = class {
  constructor() { throw new Error('Use dynamic import from packages/webrtc-verification/dist'); }
};

export const PayerWebRTCClient = class {
  constructor() { throw new Error('Use dynamic import from packages/webrtc-verification/dist'); }
};