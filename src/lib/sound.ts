/** Lightweight WebAudio feedback — no asset downloads, safe on mobile. */
let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx ??= new Ctor();
  void ctx.resume();
  return ctx;
}

function tone(freq: number, start: number, duration: number, gain = 0.15) {
  const ac = audio();
  if (!ac) return;
  const osc = ac.createOscillator();
  const vol = ac.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  vol.gain.setValueAtTime(0.0001, ac.currentTime + start);
  vol.gain.exponentialRampToValueAtTime(gain, ac.currentTime + start + 0.02);
  vol.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + start + duration);
  osc.connect(vol).connect(ac.destination);
  osc.start(ac.currentTime + start);
  osc.stop(ac.currentTime + start + duration + 0.05);
}

/** Happy chime — order placed / delivered. */
export function playSuccessChime() {
  tone(660, 0, 0.18);
  tone(880, 0.16, 0.22);
  tone(1180, 0.34, 0.3);
}

/** Radar-style ping for riders when a new task appears. */
export function playRadarPing() {
  tone(520, 0, 0.12, 0.12);
  tone(760, 0.14, 0.18, 0.12);
}

/** Loud repeating alert for sellers until the order is accepted. */
export function startOrderAlarm() {
  const ring = () => {
    tone(880, 0, 0.25, 0.25);
    tone(1100, 0.28, 0.25, 0.25);
    tone(880, 0.6, 0.25, 0.25);
  };
  ring();
  const id = window.setInterval(ring, 1600);
  return () => window.clearInterval(id);
}
