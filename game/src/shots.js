// Deterministic screenshot states for Ember Canyon. The game reads
// ?shot=start|play|end&seed=N from the URL and renders that exact
// state, frozen, so a screenshot taken of it is reproducible: the
// same seed always builds the same valley and the same framing.

import { CONFIG } from './config.js';
import { ringLayout } from './world.js';

/** Read the shot request from the URL. `shot` is null in normal play. */
export function parseShot() {
  const q = new URLSearchParams(window.location.search);
  const raw = q.get('shot');
  const shot = raw === 'start' || raw === 'play' || raw === 'end' ? raw : null;
  const seed = Number.parseInt(q.get('seed') || '', 10);
  return { shot, seed: Number.isFinite(seed) ? seed : null };
}

/**
 * Put `game` into a shot state. The game freezes its simulation
 * afterwards, so the frame the browser paints is the state below.
 */
export function applyShotState(game, shotName) {
  const seed = game.seed;
  if (shotName === 'start') {
    game.setFlightState({
      phase: 'menu',
      x: 0,
      y: 46,
      z: 60,
      yaw: 0,
      pitch: 0,
      roll: 0,
      speed: 0,
      throttle: 0,
      score: 0,
      ringsPassed: 0,
      lives: CONFIG.lives,
      fuel: CONFIG.fuelMax,
      time: 0,
      menuTime: 2.0,
      overlay: 'start',
    });
    return;
  }

  if (shotName === 'play') {
    // Mid-flight, chasing the sixth ring with the runway in the haze
    // ahead: three rings already threaded, a slight bank, full HUD.
    const rings = ringLayout(seed);
    const target = rings[5];
    game.setFlightState({
      phase: 'playing',
      x: target.x - 8,
      y: target.y + 3,
      z: target.z + 95,
      yaw: 0.06,
      pitch: 0.02,
      roll: 0.2,
      speed: 55,
      throttle: 0.72,
      score: 1620,
      ringsPassed: 5,
      lives: 3,
      fuel: 72,
      time: 48,
      overlay: 'none',
    });
    return;
  }

  if (shotName === 'end') {
    // Wheels down on the strip, mission complete, final score up.
    // Framed from the front quarter so the Kestrel shows in profile
    // on the runway, the valley and the sunset behind it.
    game.setFlightState({
      phase: 'ended',
      x: 0,
      y: 1.8,
      z: CONFIG.runwayZ + 20,
      yaw: 0,
      pitch: 0,
      roll: 0,
      speed: 0,
      throttle: 0,
      score: 2680,
      ringsPassed: CONFIG.ringCount,
      lives: 3,
      fuel: 38,
      time: 148,
      overlay: 'end',
      camera: { position: [-15, 5.5, -1492], lookAt: [0, 0.8, -1460] },
      endResult: {
        kind: 'landed',
        title: 'MISSION COMPLETE',
        subtitle: 'Wheels down on the strip — every ring threaded, the valley behind you.',
        detail: 'Landing +1000 &nbsp;·&nbsp; fuel bonus +190 &nbsp;·&nbsp; time bonus +8',
        score: 2680,
        ringsPassed: CONFIG.ringCount,
        ringTotal: CONFIG.ringCount,
        timeText: '2:28',
        fuel: 38,
      },
    });
  }
}
