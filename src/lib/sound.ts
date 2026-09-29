import { useSettings } from '@/stores/settings';

/**
 * Tiny WebAudio synth — no audio assets to download.
 * Respects the global "sound" setting.
 */
let ctx: AudioContext | null = null;

type Cue = 'tick' | 'confirm' | 'great' | 'good' | 'bad';

const CUES: Record<Cue, { f: number; d: number; type: OscillatorType; gain: number }[]> = {
  tick: [{ f: 880, d: 0.03, type: 'sine', gain: 0.04 }],
  confirm: [{ f: 520, d: 0.08, type: 'triangle', gain: 0.1 }],
  great: [
    { f: 660, d: 0.1, type: 'triangle', gain: 0.12 },
    { f: 880, d: 0.1, type: 'triangle', gain: 0.12 },
    { f: 1320, d: 0.22, type: 'triangle', gain: 0.1 },
  ],
  good: [
    { f: 587, d: 0.1, type: 'triangle', gain: 0.1 },
    { f: 740, d: 0.18, type: 'triangle', gain: 0.1 },
  ],
  bad: [
    { f: 300, d: 0.12, type: 'sawtooth', gain: 0.05 },
    { f: 220, d: 0.24, type: 'sawtooth', gain: 0.05 },
  ],
};

let lastTick = 0;

export function play(cue: Cue) {
  if (!useSettings.getState().sound || typeof window === 'undefined') return;
  if (cue === 'tick') {
    const now = performance.now();
    if (now - lastTick < 60) return;
    lastTick = now;
  }
  try {
    ctx ??= new AudioContext();
    let t = ctx.currentTime;
    for (const n of CUES[cue]) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = n.type;
      osc.frequency.value = n.f;
      g.gain.setValueAtTime(n.gain, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + n.d);
      osc.connect(g).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + n.d);
      t += n.d * 0.9;
    }
  } catch {
    /* audio unavailable — ignore */
  }
}
