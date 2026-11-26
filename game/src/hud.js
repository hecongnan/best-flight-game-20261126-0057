// The HUD and the game's screens for Ember Canyon: altitude, speed
// and heading, throttle, fuel, score, rings and lives, an artificial
// horizon, the next-ring pointer, plus the start, pause and end
// overlays. All DOM, laid over the 3D canvas, built once and updated
// in place every frame.

import { clamp } from './random.js';

const KNOTS_PER_MS = 1.94384;
const FEET_PER_M = 3.28084;

const CARDINALS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

/** Heading in degrees, 0 = north (-Z), clockwise. */
export function headingDegrees(yaw) {
  const deg = ((-yaw * 180) / Math.PI) % 360;
  return (deg + 360) % 360;
}

function cardinal(deg) {
  return CARDINALS[Math.round(deg / 22.5) % 16];
}

function el(tag, cls, parent, text = '') {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text) n.textContent = text;
  if (parent) parent.appendChild(n);
  return n;
}

/**
 * Build the HUD inside `root` (which also holds the canvas) and return
 * an object with update/show functions the game calls every frame.
 */
export function createHUD(root) {
  const hud = el('div', 'hud', root);

  const topLeft = el('div', 'panel top-left', hud);
  el('div', 'label', topLeft, 'SCORE');
  const scoreEl = el('div', 'big', topLeft, '0');
  const ringsEl = el('div', 'row', topLeft, 'RINGS  0 / 8');
  const livesEl = el('div', 'row lives', topLeft, '');
  const fuelWrap = el('div', 'fuel', topLeft);
  el('span', 'label', fuelWrap, 'FUEL');
  const fuelBar = el('div', 'bar', fuelWrap);
  const fuelFill = el('div', 'fill', fuelBar);

  const topRight = el('div', 'panel top-right', hud);
  const altRow = el('div', 'gauge', topRight);
  el('span', 'label', altRow, 'ALT');
  const altEl = el('span', 'big', altRow, '0');
  el('span', 'unit', altRow, 'FT');
  const spdRow = el('div', 'gauge', topRight);
  el('span', 'label', spdRow, 'SPD');
  const spdEl = el('span', 'big', spdRow, '0');
  el('span', 'unit', spdRow, 'KT');
  const hdgRow = el('div', 'gauge', topRight);
  el('span', 'label', hdgRow, 'HDG');
  const hdgEl = el('span', 'big', hdgRow, '000°');
  const hdgCard = el('span', 'unit', hdgRow, 'N');

  const bottomLeft = el('div', 'panel bottom-left', hud);
  el('div', 'label', bottomLeft, 'THROTTLE');
  const thrBar = el('div', 'bar vertical', bottomLeft);
  const thrFill = el('div', 'fill', thrBar);
  const thrEl = el('div', 'row', bottomLeft, '0%');

  const bottomRight = el('div', 'panel bottom-right', hud);
  el('div', 'label', bottomRight, 'ATTITUDE');
  const horizon = el('div', 'horizon', bottomRight);
  const horizonSky = el('div', 'horizon-sky', horizon);
  const horizonLine = el('div', 'horizon-line', horizon);
  const horizonCentre = el('div', 'horizon-centre', horizon);
  void horizonSky;

  const centre = el('div', 'centre', hud);
  const ringPointer = el('div', 'ring-pointer', centre, 'RING 1  ·  320m');
  const messageEl = el('div', 'message', centre, '');

  const overlay = el('div', 'overlay', root);
  const overlayCard = el('div', 'overlay-card', overlay);
  const overlayTitle = el('h1', '', overlayCard, 'EMBER CANYON');
  const overlaySub = el('p', 'sub', overlayCard, '');
  const overlayBody = el('div', 'body', overlayCard);
  const overlayHint = el('p', 'hint', overlayCard, '');

  let messageTimer = 0;

  function showMessage(text, seconds = 2.2) {
    messageEl.textContent = text;
    messageEl.classList.add('show');
    messageTimer = seconds;
  }

  function tickMessage(dt) {
    if (messageTimer > 0) {
      messageTimer -= dt;
      if (messageTimer <= 0) messageEl.classList.remove('show');
    }
  }

  return {
    /** Update every gauge from the flight state. */
    update(state, dt) {
      scoreEl.textContent = String(state.score);
      ringsEl.textContent = `RINGS  ${state.ringsPassed} / ${state.ringTotal}`;
      livesEl.textContent = '✈ '.repeat(Math.max(state.lives, 0)) || '—';
      fuelFill.style.width = `${clamp(state.fuel, 0, 100)}%`;
      fuelFill.classList.toggle('low', state.fuel < 25);
      altEl.textContent = String(Math.max(0, Math.round(state.altitudeM * FEET_PER_M)));
      spdEl.textContent = String(Math.round(state.speedMs * KNOTS_PER_MS));
      const hdg = headingDegrees(state.yaw);
      hdgEl.textContent = `${String(Math.round(hdg)).padStart(3, '0')}°`;
      hdgCard.textContent = cardinal(hdg);
      thrFill.style.height = `${clamp(state.throttle, 0, 1) * 100}%`;
      thrEl.textContent = `${Math.round(state.throttle * 100)}%`;
      // Artificial horizon: the sky half rotates with bank, slides with pitch.
      // The centre marker counter-rotates so the aircraft symbol stays level.
      horizon.style.transform = `rotate(${-state.roll}rad)`;
      horizonLine.style.transform = `translateY(${clamp(state.pitch * 60, -46, 46)}px)`;
      horizonCentre.style.transform = `rotate(${state.roll}rad)`;
      if (state.nextRing) {
        const d = Math.round(state.nextRing.distanceM);
        const arrow = state.nextRing.bearing < -0.25 ? '◀ ' : state.nextRing.bearing > 0.25 ? ' ▶' : '';
        ringPointer.textContent = `${arrow}RING ${state.nextRing.index + 1}  ·  ${d}m${arrow}`;
        ringPointer.classList.add('show');
      } else {
        ringPointer.textContent = 'ALL RINGS CLEAR — LAND ON THE RUNWAY';
        ringPointer.classList.add('show');
      }
      tickMessage(dt);
    },
    showMessage,
    /** The start screen. */
    showStart(best) {
      overlay.classList.add('show');
      overlayTitle.textContent = 'EMBER CANYON';
      overlaySub.textContent = 'A sunset run through the valley — thread all 8 rings, then land on the strip.';
      overlayBody.innerHTML =
        '<div class="ctl"><b>W / S</b> throttle &nbsp;·&nbsp; <b>↑ / ↓</b> pitch &nbsp;·&nbsp; <b>← / →</b> or <b>A / D</b> bank &amp; turn</div>' +
        '<div class="ctl">Move the <b>mouse</b> to steer &nbsp;·&nbsp; <b>P</b> pause &nbsp;·&nbsp; <b>M</b> mute &nbsp;·&nbsp; <b>R</b> restart</div>' +
        '<div class="ctl">Mind your <b>fuel</b> and the canyon walls — you have 3 lives.</div>' +
        (best > 0 ? `<div class="best">BEST SCORE ${best}</div>` : '');
      overlayHint.textContent = 'PRESS ENTER OR CLICK TO FLY';
    },
    /** The pause screen. */
    showPause() {
      overlay.classList.add('show');
      overlayTitle.textContent = 'PAUSED';
      overlaySub.textContent = 'The valley waits. The sun is not in a hurry either.';
      overlayBody.innerHTML = '';
      overlayHint.textContent = 'PRESS P OR CLICK TO RESUME  ·  R TO RESTART';
    },
    /** The end screen: landed (win) or out of lives / fuel. */
    showEnd(result) {
      overlay.classList.add('show');
      overlayTitle.textContent = result.title;
      overlaySub.textContent = result.subtitle;
      overlayBody.innerHTML =
        `<div class="stats">SCORE <b>${result.score}</b> &nbsp;·&nbsp; RINGS <b>${result.ringsPassed}/${result.ringTotal}</b>` +
        ` &nbsp;·&nbsp; TIME <b>${result.timeText}</b> &nbsp;·&nbsp; FUEL LEFT <b>${Math.round(result.fuel)}%</b></div>` +
        (result.detail ? `<div class="detail">${result.detail}</div>` : '');
      overlayHint.textContent = 'PRESS R OR CLICK TO FLY AGAIN';
    },
    hideOverlay() {
      overlay.classList.remove('show');
    },
    /** Dim the HUD while an overlay covers the screen. */
    setDimmed(dimmed) {
      hud.classList.toggle('dimmed', dimmed);
    },
  };
}
