// Ember Canyon: the game itself. A chase-view flight through a
// seeded canyon valley — thread eight glowing rings in order, mind
// fuel and the walls, then land on the runway. One class owns the
// renderer, the flight model, collisions, scoring and the screens;
// world.js builds the scenery, plane.js the aircraft, hud.js the
// instruments, audio.js the sound, input.js the controls.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { clamp, lerp } from './random.js';
import { buildWorld } from './world.js';
import { buildPlane } from './plane.js';
import { createSoundEngine } from './audio.js';
import { createInput } from './input.js';
import { createHUD } from './hud.js';
import { applyShotState, parseShot } from './shots.js';

const START_POS = new THREE.Vector3(0, 46, 140);
const START_SPEED = 30;
const START_THROTTLE = 0.5;

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export class CanyonRunGame {
  constructor(root) {
    this.root = root;
    this.seed = CONFIG.defaultSeed;
    const shot = parseShot();
    if (shot.seed !== null) this.seed = shot.seed;
    this.shotName = shot.shot;

    this.renderer = null;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.5, 6000);
    this.clock = new THREE.Clock();
    this.simTime = 0;
    this.menuTime = 0;
    this.frozen = false;

    this.phase = 'menu';
    this.endKind = null;
    this.score = 0;
    this.ringsPassed = 0;
    this.lives = CONFIG.lives;
    this.fuel = CONFIG.fuelMax;
    this.time = 0;
    this.throttle = 0;
    this.speed = 0;
    this.pos = START_POS.clone();
    this.yaw = 0;
    this.pitch = 0;
    this.roll = 0;
    this.invulnerableUntil = 0;
    this.fuelWarned = false;
    this.best = 0;
    try {
      this.best = Number(window.localStorage.getItem('emberCanyonBest') || 0) || 0;
    } catch {
      this.best = 0;
    }

    this.world = buildWorld(this.scene, this.seed);
    const planeParts = buildPlane();
    this.plane = planeParts.group;
    this.propeller = planeParts.propeller;
    this.scene.add(this.plane);
    // A shot may fix the camera to a chosen framing (see setFlightState).
    this.fixedCamera = null;

    this.hud = createHUD(root);
    this.input = createInput(root);
    this.sound = createSoundEngine();

    this.camera.position.set(0, 52, 168);
    this.camera.lookAt(0, 44, 0);

    this.bindScreens();
    this.resize();
    window.addEventListener('resize', () => this.resize());

    // A deterministic screenshot state, or the menu.
    if (this.shotName) {
      applyShotState(this, this.shotName);
      this.frozen = true;
    } else {
      this.toMenu();
    }

    this.renderer = this.createRenderer(root);
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  createRenderer(root) {
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    } catch {
      this.hud.showEnd({
        title: 'WEBGL UNAVAILABLE',
        subtitle: 'This game needs WebGL. Try a desktop browser with hardware acceleration.',
        score: 0,
        ringsPassed: 0,
        ringTotal: CONFIG.ringCount,
        timeText: '0:00',
        fuel: 100,
        detail: '',
      });
      throw new Error('WebGL unavailable');
    }
    renderer.setPixelRatio(1);
    renderer.setSize(root.clientWidth || 1280, root.clientHeight || 720);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    const holder = document.createElement('div');
    holder.className = 'scene-holder';
    holder.appendChild(renderer.domElement);
    root.insertBefore(holder, root.firstChild);
    return renderer;
  }

  resize() {
    if (!this.renderer) return;
    const w = this.root.clientWidth || 1280;
    const h = this.root.clientHeight || 720;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ------------------------------------------------------------ screens

  bindScreens() {
    const start = () => {
      this.sound.unlock();
      if (this.phase === 'menu' || this.phase === 'ended') this.startFlight();
      else if (this.phase === 'paused') this.resume();
    };
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        if (this.phase === 'menu' || this.phase === 'ended' || this.phase === 'paused') {
          e.preventDefault();
          start();
        }
      }
      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (this.phase === 'playing') this.pause();
        else if (this.phase === 'paused') this.resume();
      }
      if (e.code === 'KeyR') {
        if (this.phase !== 'menu') this.startFlight();
      }
      if (e.code === 'KeyM') {
        this.sound.toggleMute();
      }
    });
    this.root.addEventListener('click', (e) => {
      if (e.target.closest('.overlay')) start();
    });
  }

  toMenu() {
    this.phase = 'menu';
    this.menuTime = 0;
    this.pos.copy(START_POS);
    this.yaw = 0;
    this.pitch = 0;
    this.roll = 0;
    this.speed = 0;
    this.throttle = 0;
    this.world.resetRings();
    this.hud.showStart(this.best);
    this.hud.setDimmed(false);
  }

  startFlight() {
    this.phase = 'playing';
    this.score = 0;
    this.ringsPassed = 0;
    this.lives = CONFIG.lives;
    this.fuel = CONFIG.fuelMax;
    this.time = 0;
    this.throttle = START_THROTTLE;
    this.speed = START_SPEED;
    this.pos.copy(START_POS);
    this.yaw = 0;
    this.pitch = 0;
    this.roll = 0;
    this.invulnerableUntil = 0;
    this.fuelWarned = false;
    this.world.resetRings();
    this.hud.hideOverlay();
    this.hud.setDimmed(false);
    this.hud.showMessage('THREAD RING 1 — THEN LAND ON THE STRIP', 3);
  }

  pause() {
    if (this.phase !== 'playing') return;
    this.phase = 'paused';
    this.hud.showPause();
    this.hud.setDimmed(true);
  }

  resume() {
    if (this.phase !== 'paused') return;
    this.phase = 'playing';
    this.hud.hideOverlay();
    this.hud.setDimmed(false);
  }

  endFlight(kind, title, subtitle, detail) {
    this.phase = 'ended';
    this.endKind = kind;
    if (this.score > this.best) {
      this.best = this.score;
      try {
        window.localStorage.setItem('emberCanyonBest', String(this.best));
      } catch {
        /* storage unavailable: the best score just is not kept */
      }
    }
    this.hud.showEnd({
      title,
      subtitle,
      detail,
      score: this.score,
      ringsPassed: this.ringsPassed,
      ringTotal: CONFIG.ringCount,
      timeText: formatTime(this.time),
      fuel: this.fuel,
    });
    this.hud.setDimmed(true);
    if (kind === 'landed') this.sound.landFanfare();
    else this.sound.crash();
  }

  // ------------------------------------------------------------ shot states

  /** Apply a full flight state at once (used by shots.js). */
  setFlightState(spec) {
    this.phase = spec.phase;
    this.pos.set(spec.x, spec.y, spec.z);
    this.yaw = spec.yaw ?? 0;
    this.pitch = spec.pitch ?? 0;
    this.roll = spec.roll ?? 0;
    this.speed = spec.speed ?? 0;
    this.throttle = spec.throttle ?? 0;
    this.score = spec.score ?? 0;
    this.ringsPassed = spec.ringsPassed ?? 0;
    this.lives = spec.lives ?? CONFIG.lives;
    this.fuel = spec.fuel ?? CONFIG.fuelMax;
    this.time = spec.time ?? 0;
    this.menuTime = spec.menuTime ?? 0;
    this.world.resetRings();
    for (let i = 0; i < this.ringsPassed; i++) this.world.setRingPassed(i);
    if (spec.overlay === 'start') this.hud.showStart(this.best);
    else if (spec.overlay === 'end' && spec.endResult) {
      this.endKind = spec.endResult.kind;
      this.hud.showEnd(spec.endResult);
      this.hud.setDimmed(true);
    } else {
      this.hud.hideOverlay();
    }
    this.hud.setDimmed(spec.overlay === 'end');
    // Snap the camera to the shot's framing at once: a frozen shot
    // never gets the frames a chase-camera lerp would need.
    if (spec.camera) {
      this.fixedCamera = spec.camera;
      this.camera.position.set(...spec.camera.position);
      this.camera.lookAt(new THREE.Vector3(...spec.camera.lookAt));
      this.world.skyGroup.position.copy(this.camera.position);
    } else {
      this.fixedCamera = null;
      if (spec.phase === 'menu') this.updateMenuCamera(0);
      else this.updateCamera(0, true);
    }
  }

  // ------------------------------------------------------------ flight

  forwardVector() {
    const cp = Math.cos(this.pitch);
    return new THREE.Vector3(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
  }

  nextRing() {
    if (this.ringsPassed >= CONFIG.ringCount) return null;
    return this.world.rings[this.ringsPassed];
  }

  respawn() {
    const last = this.ringsPassed > 0 ? this.world.rings[this.ringsPassed - 1] : null;
    if (last) {
      this.pos.set(last.x, last.y + 14, last.z + 70);
    } else {
      this.pos.copy(START_POS);
    }
    this.yaw = 0;
    this.pitch = 0;
    this.roll = 0;
    this.speed = 34;
    this.throttle = 0.55;
    this.invulnerableUntil = this.simTime + 2.5;
    this.hud.showMessage(`BACK IN THE AIR — ${this.lives} ${this.lives === 1 ? 'LIFE' : 'LIVES'} LEFT`, 2.5);
  }

  crash(reason) {
    if (this.simTime < this.invulnerableUntil) return;
    this.lives -= 1;
    this.sound.crash();
    if (this.lives <= 0) {
      this.endFlight(
        'crashed',
        'GAME OVER',
        reason,
        `The Kestrel is down in the canyon. Final score ${this.score} — ${this.ringsPassed} of ${CONFIG.ringCount} rings.`,
      );
    } else {
      this.hud.showMessage(`CRASHED — ${this.lives} ${this.lives === 1 ? 'LIFE' : 'LIVES'} LEFT`, 2.5);
      this.respawn();
    }
  }

  land() {
    const fuelBonus = Math.round(this.fuel * CONFIG.fuelBonusPerUnit);
    const timeBonus = Math.max(0, Math.round((CONFIG.parTime - this.time) * 4));
    this.score += CONFIG.landingPoints + fuelBonus + timeBonus;
    this.endFlight(
      'landed',
      'MISSION COMPLETE',
      'Wheels down on the strip — every ring threaded, the valley behind you.',
      `Landing +${CONFIG.landingPoints} &nbsp;·&nbsp; fuel bonus +${fuelBonus} &nbsp;·&nbsp; time bonus +${timeBonus}`,
    );
  }

  checkRingPass(prevZ) {
    const ring = this.nextRing();
    if (!ring) return;
    const dx = this.pos.x - ring.x;
    const dy = this.pos.y - ring.y;
    const dz = this.pos.z - ring.z;
    if (Math.abs(dz) < 9 && dx * dx + dy * dy < CONFIG.ringRadius * CONFIG.ringRadius) {
      const deadCentre = dx * dx + dy * dy < CONFIG.deadCentreRadius * CONFIG.deadCentreRadius;
      this.ringsPassed += 1;
      this.world.setRingPassed(ring.index);
      const speedBonus = Math.round((this.speed / CONFIG.maxSpeed) * 100);
      this.score += CONFIG.ringPoints + speedBonus + (deadCentre ? CONFIG.deadCentreBonus : 0);
      this.sound.ringChime(deadCentre);
      if (this.ringsPassed >= CONFIG.ringCount) {
        this.hud.showMessage('ALL RINGS CLEAR — LAND ON THE RUNWAY', 3);
      } else {
        this.hud.showMessage(
          deadCentre
            ? `RING ${this.ringsPassed} — DEAD CENTRE! +${CONFIG.ringPoints + speedBonus + CONFIG.deadCentreBonus}`
            : `RING ${this.ringsPassed} / ${CONFIG.ringCount}  +${CONFIG.ringPoints + speedBonus}`,
          2,
        );
      }
    }
    void prevZ;
  }

  updatePlaying(dt) {
    // Throttle.
    const dir = this.input.throttleDir;
    this.throttle = clamp(this.throttle + dir * CONFIG.throttleRate * dt, 0, 1);
    if (this.fuel <= 0) this.throttle = 0;

    // Speed chases the throttle, with a stall sink when slow.
    const targetSpeed = CONFIG.minSpeed + this.throttle * (CONFIG.maxSpeed - CONFIG.minSpeed);
    this.speed = lerp(this.speed, targetSpeed, clamp(dt * 0.9, 0, 1));

    // Pitch and roll ease toward the pilot's input.
    const targetPitch = this.input.pitchInput * CONFIG.maxPitch;
    const targetRoll = this.input.rollInput * CONFIG.maxRoll;
    this.pitch = lerp(this.pitch, targetPitch, clamp(dt * CONFIG.pitchEase, 0, 1));
    this.roll = lerp(this.roll, targetRoll, clamp(dt * CONFIG.rollEase, 0, 1));
    // A banked turn: yaw follows the roll.
    this.yaw += -this.roll * CONFIG.turnFromBank * dt;

    const prevZ = this.pos.z;
    const fwd = this.forwardVector();
    this.pos.addScaledVector(fwd, this.speed * dt);
    if (this.speed < CONFIG.stallSpeed) {
      this.pos.y -= (CONFIG.stallSpeed - this.speed) * 0.3 * dt;
    }
    this.pos.y = Math.min(this.pos.y, CONFIG.ceiling);
    this.pos.x = clamp(this.pos.x, -440, 440);
    this.pos.z = clamp(this.pos.z, CONFIG.worldEnd, CONFIG.worldStart);

    this.time += dt;
    const burn = CONFIG.fuelBurnIdle + this.throttle * CONFIG.fuelBurnFull;
    this.fuel = Math.max(0, this.fuel - burn * dt);
    if (this.fuel < 25 && !this.fuelWarned) {
      this.fuelWarned = true;
      this.hud.showMessage('FUEL LOW — HEAD FOR THE RUNWAY', 3);
      this.sound.warnBlip();
    }

    this.checkRingPass(prevZ);

    // Ground contact: a landing on the strip, or a crash.
    const groundY = this.world.terrainHeightAt(this.pos.x, this.pos.z);
    if (this.pos.y <= groundY + CONFIG.crashClearance) {
      const inRunway =
        Math.abs(this.pos.x - CONFIG.runwayX) <= CONFIG.runwayWidth / 2 + 2 &&
        Math.abs(this.pos.z - CONFIG.runwayZ) <= CONFIG.runwayLength / 2;
      const verticalSpeed = fwd.y * this.speed;
      const gentle = this.speed < 42 && Math.abs(this.pitch) < 0.3 && verticalSpeed > -7;
      if (inRunway && gentle) {
        this.pos.y = groundY + 1.1;
        this.land();
      } else {
        this.pos.y = groundY + CONFIG.crashClearance;
        this.crash(
          inRunway
            ? 'Too fast for the strip — the Kestrel ran off the runway.'
            : 'The canyon wall wins this one. Watch the terrain.',
        );
      }
    }

    this.sound.update(this.throttle, clamp(this.speed / CONFIG.maxSpeed, 0, 1), true);
  }

  // ------------------------------------------------------------ camera

  updateCamera(dt, snap = false) {
    const fwd = this.forwardVector();
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(fwd, up).normalize();
    const trueUp = new THREE.Vector3().crossVectors(right, fwd).normalize();
    const behind = fwd.clone().multiplyScalar(-15.5).addScaledVector(trueUp, 2.4);
    const desired = this.pos.clone().add(behind);
    const groundY = this.world.terrainHeightAt(desired.x, desired.z);
    desired.y = Math.max(desired.y, groundY + 2.2);
    const k = snap ? 1 : 1 - Math.exp(-7 * dt);
    this.camera.position.lerp(desired, k);
    const look = this.pos.clone().addScaledVector(fwd, 16).addScaledVector(trueUp, 0.6);
    this.camera.lookAt(look);
    this.camera.rotateZ(-this.roll * 0.28);
    this.world.skyGroup.position.copy(this.camera.position);
  }

  updateMenuCamera(dt) {
    this.menuTime += dt;
    const a = 0.6 + this.menuTime * 0.1;
    const cx = this.pos.x + Math.sin(a) * 17;
    const cz = this.pos.z + Math.cos(a) * 17;
    const groundY = this.world.terrainHeightAt(cx, cz);
    this.camera.position.set(cx, Math.max(this.pos.y + 4.5, groundY + 3), cz);
    this.camera.lookAt(this.pos.x, this.pos.y + 0.5, this.pos.z - 6);
    this.world.skyGroup.position.copy(this.camera.position);
  }

  // ------------------------------------------------------------ HUD state

  hudState() {
    const ring = this.nextRing();
    let nextRing = null;
    if (ring) {
      const toRing = new THREE.Vector3(ring.x - this.pos.x, ring.y - this.pos.y, ring.z - this.pos.z);
      const distanceM = toRing.length();
      const fwd = this.forwardVector();
      const flatFwd = new THREE.Vector3(fwd.x, 0, fwd.z).normalize();
      const flatTo = new THREE.Vector3(toRing.x, 0, toRing.z).normalize();
      const cross = flatFwd.x * flatTo.z - flatFwd.z * flatTo.x;
      const dot = flatFwd.dot(flatTo);
      const bearing = clamp(Math.atan2(cross, dot) / 1.2, -1, 1);
      nextRing = { index: ring.index, distanceM, bearing };
    }
    return {
      score: this.score,
      ringsPassed: this.ringsPassed,
      ringTotal: CONFIG.ringCount,
      lives: this.lives,
      fuel: this.fuel,
      altitudeM: this.pos.y,
      speedMs: this.speed,
      yaw: this.yaw,
      throttle: this.throttle,
      pitch: this.pitch,
      roll: this.roll,
      nextRing,
    };
  }

  // ------------------------------------------------------------ loop

  loop() {
    requestAnimationFrame(this.loop);
    const rawDt = Math.min(this.clock.getDelta(), 0.05);
    const dt = this.frozen ? 0 : rawDt;
    if (dt > 0) this.simTime += dt;

    if (this.fixedCamera) {
      // A shot's fixed framing: hold it exactly, sky follows the camera.
      this.world.skyGroup.position.copy(this.camera.position);
    } else if (this.phase === 'playing' && dt > 0) {
      this.updatePlaying(dt);
      this.propeller.rotation.z -= dt * (6 + this.throttle * 26);
      this.updateCamera(dt);
    } else if (this.phase === 'playing') {
      // A frozen play shot: hold the chase framing exactly.
      this.updateCamera(0, true);
    } else if (this.phase === 'menu' && dt > 0) {
      // The menu backdrop cruises gently down the valley and loops.
      this.pos.z -= 18 * dt;
      this.pos.y = 46 + Math.sin(this.simTime * 0.8) * 1.5;
      if (this.pos.z < -260) this.pos.z = 140;
      this.propeller.rotation.z += dt * 2;
      this.updateMenuCamera(dt);
    } else if (this.phase === 'menu') {
      this.updateMenuCamera(0);
    } else {
      // Paused or ended: hold the frame.
      this.updateCamera(0.0001);
    }

    // Pose the plane from the flight state.
    this.plane.position.copy(this.pos);
    this.plane.rotation.set(0, 0, 0);
    this.plane.rotateY(this.yaw);
    this.plane.rotateX(this.pitch);
    this.plane.rotateZ(-this.roll);

    this.world.update(dt, this.simTime, this.ringsPassed);
    this.hud.update(this.hudState(), dt);
    this.input.consume();
    this.renderer.render(this.scene, this.camera);
    if (!window.__emberReady) window.__emberReady = true;
  }
}
