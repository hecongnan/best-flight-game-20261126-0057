// Procedural sound for Ember Canyon: no audio files are shipped.
// Everything is synthesized with the Web Audio API — engine drone,
// wind rush, ring chimes, a crash thud and a landing fanfare. Audio
// only starts after the player's first gesture, as browsers require.

/** A tiny helper: an oscillator with a gain envelope. */
function tone(ctx, type, freq, when, dur, peak) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, when);
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), when + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(when);
  osc.stop(when + dur + 0.05);
}

/** Create the sound engine. Call `unlock()` from a user gesture. */
export function createSoundEngine() {
  let ctx = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let windSource = null;
  let windGain = null;
  let windFilter = null;
  let muted = false;
  let unlocked = false;

  function makeNoiseBuffer() {
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function unlock() {
    if (unlocked) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      unlocked = true;
      // Engine: two detuned saws through a low-pass, pitch by throttle.
      engineOsc = ctx.createOscillator();
      engineOsc2 = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc2.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineOsc2.frequency.value = 55 * 1.007;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineOsc2.connect(engineFilter);
      engineFilter.connect(engineGain).connect(ctx.destination);
      engineOsc.start();
      engineOsc2.start();
      // Wind: looped noise through a band-pass, loudness by speed.
      windSource = ctx.createBufferSource();
      windSource.buffer = makeNoiseBuffer();
      windSource.loop = true;
      windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 700;
      windFilter.Q.value = 0.6;
      windGain = ctx.createGain();
      windGain.gain.value = 0;
      windSource.connect(windFilter).connect(windGain).connect(ctx.destination);
      windSource.start();
    } catch {
      ctx = null;
      unlocked = false;
    }
  }

  return {
    unlock,
    get isMuted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      if (ctx && ctx.destination) {
        // Mute by suspending the whole context: cheap and total.
        if (muted) ctx.suspend();
        else ctx.resume();
      }
      return muted;
    },
    /** Continuous engine/wind bed, called every frame while flying. */
    update(throttle, speedNorm, running) {
      if (!ctx || !unlocked || muted) return;
      const now = ctx.currentTime;
      const rpm = 52 + throttle * 68;
      engineOsc.frequency.setTargetAtTime(rpm, now, 0.08);
      engineOsc2.frequency.setTargetAtTime(rpm * 1.007 + 0.6, now, 0.08);
      engineGain.gain.setTargetAtTime(running ? 0.05 + throttle * 0.075 : 0, now, 0.1);
      windFilter.frequency.setTargetAtTime(500 + speedNorm * 900, now, 0.1);
      windGain.gain.setTargetAtTime(running ? speedNorm * 0.11 : 0, now, 0.12);
    },
    /** A bright two-note chime when a ring is threaded. */
    ringChime(deadCentre) {
      if (!ctx || !unlocked || muted) return;
      const now = ctx.currentTime;
      tone(ctx, 'sine', 880, now, 0.35, 0.22);
      tone(ctx, 'sine', 1318, now + 0.09, 0.45, 0.2);
      if (deadCentre) tone(ctx, 'sine', 1760, now + 0.18, 0.5, 0.18);
    },
    /** A low thud and noise burst for a crash. */
    crash() {
      if (!ctx || !unlocked || muted) return;
      const now = ctx.currentTime;
      tone(ctx, 'sine', 70, now, 0.5, 0.5);
      tone(ctx, 'triangle', 46, now, 0.7, 0.4);
      const noise = ctx.createBufferSource();
      noise.buffer = makeNoiseBuffer();
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 900;
      noise.connect(filter).connect(gain).connect(ctx.destination);
      noise.start(now);
      noise.stop(now + 0.7);
    },
    /** A short rising fanfare for a landing. */
    landFanfare() {
      if (!ctx || !unlocked || muted) return;
      const now = ctx.currentTime;
      [523, 659, 784, 1047].forEach((f, i) => tone(ctx, 'triangle', f, now + i * 0.11, 0.5, 0.2));
    },
    /** A soft warning blip for low fuel. */
    warnBlip() {
      if (!ctx || !unlocked || muted) return;
      tone(ctx, 'square', 440, ctx.currentTime, 0.12, 0.06);
    },
  };
}
