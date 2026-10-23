// Picks a render quality tier for this device and steps it down if frames run slow.
// ?q=low|mid|high in the URL forces a tier (handy for testing).
const TIERS = ['low', 'mid', 'high'];
export const SETTINGS = {
  high: { dpr: 2, aa: true, shadows: true, shadowSize: 2048, shadowEvery: 2, foliage: 1, dust: true, fps: 60, tex: 1 },
  mid: { dpr: 1.5, aa: true, shadows: true, shadowSize: 1024, shadowEvery: 4, foliage: .7, dust: true, fps: 60, tex: 1 },
  low: { dpr: 1, aa: false, shadows: false, shadowSize: 512, shadowEvery: 0, foliage: .45, dust: false, fps: 30, tex: .5 },
};

function detect() {
  const forced = new URLSearchParams(location.search).get('q');
  if (TIERS.includes(forced)) return forced;
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;
  const phone = matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 820;
  let maxTex = 4096;
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  } catch { /* keep the default */ }
  if (cores <= 4 || mem <= 3 || maxTex < 4096) return 'low';
  if (phone || cores <= 6 || mem <= 4) return 'mid';
  return 'high';
}

export const quality = {
  tier: detect(),
  forced: new URLSearchParams(location.search).has('q'),
  get s() { return SETTINGS[this.tier]; },
};

// call once per rendered frame with the frame time in ms; onDrop(tier) fires when quality steps down
export function frameMonitor(onDrop) {
  let n = 0, sum = 0, warm = 0;
  return ms => {
    if (quality.forced || quality.tier === 'low') return;
    if (warm++ < 60) return;   // ignore shader compiles and the intro sweep
    sum += ms; n++;
    if (n < 90) return;
    const avg = sum / n;
    n = 0; sum = 0;
    if (avg > 28) {
      quality.tier = TIERS[TIERS.indexOf(quality.tier) - 1];
      warm = 0;
      onDrop(quality.tier);
    }
  };
}
