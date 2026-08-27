// Site-wide tap feedback: a short vibration + a short click tone on every
// button/link tap. No audio asset needed — the tone is synthesized with
// WebAudio so it stays tiny and works offline.
let audioCtx = null;

function getAudioCtx() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) audioCtx = new Ctx();
  return audioCtx;
}

function scheduleTone(ctx) {
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 720;
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.07);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.08);
  } catch {}
}

function playTapSound() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  // A freshly-created (or backgrounded) context starts "suspended" —
  // scheduling the tone before resume() actually completes means it's
  // scheduled against a clock that hasn't started yet, so it plays too
  // early/silently. Deferring to the resume promise fixes the first tap.
  if (ctx.state === "suspended") ctx.resume().then(() => scheduleTone(ctx)).catch(() => {});
  else scheduleTone(ctx);
}

function vibrate() {
  if (navigator.vibrate) {
    try { navigator.vibrate(15); } catch {}
  }
}

export function tapFeedback() {
  vibrate();
  playTapSound();
}

const TAPPABLE_SELECTOR = "button, a, [role='button'], input[type='submit'], input[type='button'], select, .clickable";

// One capturing listener on the whole document — fires tap feedback for
// every real tap on an interactive element, so no individual component
// needs to be touched to get sound + vibration.
export function initTapFeedback() {
  const handler = (e) => {
    if (e.target.closest?.("[data-no-tap-feedback]")) return;
    const target = e.target.closest?.(TAPPABLE_SELECTOR);
    if (!target || target.disabled) return;
    tapFeedback();
  };
  document.addEventListener("click", handler, true);
  return () => document.removeEventListener("click", handler, true);
}
