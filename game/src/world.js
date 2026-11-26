// Ember Canyon's world: a seeded canyon valley with a river, a runway,
// eight glowing rings and a sunset sky. Everything is built from
// three.js primitives; nothing is loaded from a file. The height
// function here is the same one the game uses for terrain collision.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { clamp, fbm2, lerp, mulberry32, range } from './random.js';

const C = CONFIG.colors;

/** Smoothstep 0..1. */
function smooth01(t) {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

/**
 * The canyon's height at (x, z), in metres. Valley floor near x = 0,
 * walls rising beyond the valley half width, a river channel at the
 * centre, and level ground flattened around the runway.
 */
export function terrainHeight(x, z, seed) {
  const ax = Math.abs(x);
  // Gentle rolling floor.
  let h = (fbm2(x * 0.008, z * 0.008, seed, 3) - 0.5) * 2 * CONFIG.floorBump;
  // A shallow channel for the river at the centreline.
  const channel = Math.max(0, 1 - ax / 20);
  h -= channel * 1.4;
  // Canyon walls.
  if (ax > CONFIG.valleyHalfWidth) {
    const t = (ax - CONFIG.valleyHalfWidth) / (CONFIG.rimHalfWidth - CONFIG.valleyHalfWidth);
    const wall = Math.pow(t, 1.6) * CONFIG.wallHeight;
    const ridge = fbm2(x * 0.02 + 11, z * 0.015, seed + 5, 3) * 36 * t;
    h += wall + ridge;
  }
  // Flatten the ground around the runway so the strip sits level.
  const rdx = Math.abs(x - CONFIG.runwayX) / 60;
  const rdz = Math.abs(z - CONFIG.runwayZ) / (CONFIG.runwayLength / 2 + 70);
  const flat = smooth01(1 - Math.max(rdx, rdz));
  h = lerp(h, 0.6, flat);
  return h;
}

/** Paint one terrain vertex by height and noise: sand, grass, dry scrub, rock. */
function terrainColor(x, y, z, seed, out) {
  const n = fbm2(x * 0.05 + 3, z * 0.05, seed + 9, 2);
  const sand = new THREE.Color(0xc9a06a);
  const grass = new THREE.Color(C.floorGrass);
  const dry = new THREE.Color(C.floorDry);
  const rock = new THREE.Color(C.wallRock);
  const top = new THREE.Color(C.wallTop);
  if (y < 1.6) {
    out.copy(sand).lerp(grass, 0.45 + n * 0.3);
  } else if (y < 9) {
    out.copy(grass).lerp(dry, smooth01((y - 2) / 7) * 0.5 + n * 0.2);
  } else if (y < 55) {
    out.copy(dry).lerp(rock, smooth01((y - 9) / 46));
  } else {
    out.copy(rock).lerp(top, smooth01((y - 55) / 90));
  }
  const shade = 0.86 + n * 0.28;
  out.multiplyScalar(shade);
  return out;
}

function buildTerrain(scene, seed) {
  const width = CONFIG.rimHalfWidth * 2;
  const length = CONFIG.worldStart - CONFIG.worldEnd;
  const zCentre = (CONFIG.worldStart + CONFIG.worldEnd) / 2;
  const geo = new THREE.PlaneGeometry(width, length, 96, 176);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i) + zCentre;
    const y = terrainHeight(x, z, seed);
    pos.setY(i, y);
    pos.setZ(i, z);
    terrainColor(x, y, z, seed, c);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.96,
    metalness: 0,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'canyonTerrain';
  scene.add(mesh);
  return mesh;
}

function buildRiver(scene) {
  const length = CONFIG.worldStart - CONFIG.worldEnd;
  const zCentre = (CONFIG.worldStart + CONFIG.worldEnd) / 2;
  const geo = new THREE.PlaneGeometry(11, length, 1, 120);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({
    color: C.river,
    roughness: 0.1,
    metalness: 0.3,
    transparent: true,
    opacity: 0.9,
  });
  const river = new THREE.Mesh(geo, mat);
  river.position.set(0, 0.75, zCentre);
  river.name = 'valleyRiver';
  scene.add(river);
  return river;
}

function buildRunway(scene) {
  const group = new THREE.Group();
  group.name = 'runway';
  const z = CONFIG.runwayZ;
  const strip = new THREE.Mesh(
    new THREE.BoxGeometry(CONFIG.runwayWidth, 0.4, CONFIG.runwayLength),
    new THREE.MeshStandardMaterial({ color: C.runway, roughness: 0.9, metalness: 0.05 }),
  );
  strip.position.set(CONFIG.runwayX, 0.9, z);
  group.add(strip);
  // Centreline dashes and threshold bars.
  const dashMat = new THREE.MeshStandardMaterial({ color: 0xf5f2e8, roughness: 0.6 });
  for (let i = 0; i < 9; i++) {
    const dash = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 9), dashMat);
    dash.position.set(CONFIG.runwayX, 1.12, z - CONFIG.runwayLength / 2 + 22 + i * 24);
    group.add(dash);
  }
  for (const end of [-1, 1]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(CONFIG.runwayWidth - 4, 0.08, 3), dashMat);
    bar.position.set(CONFIG.runwayX, 1.12, z + end * (CONFIG.runwayLength / 2 - 6));
    group.add(bar);
  }
  // Edge lights: warm glowing studs down both sides.
  const lightGeo = new THREE.SphereGeometry(0.55, 8, 6);
  const lightMat = new THREE.MeshStandardMaterial({
    color: 0xffc46b,
    emissive: 0xff9a2a,
    emissiveIntensity: 2.2,
  });
  for (let i = 0; i <= 10; i++) {
    const zz = z - CONFIG.runwayLength / 2 + (i * CONFIG.runwayLength) / 10;
    for (const side of [-1, 1]) {
      const lamp = new THREE.Mesh(lightGeo, lightMat);
      lamp.position.set(CONFIG.runwayX + side * (CONFIG.runwayWidth / 2 + 1.2), 1.35, zz);
      group.add(lamp);
    }
  }
  // Windsock on a pole beside the strip.
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 9, 8),
    new THREE.MeshStandardMaterial({ color: 0xd8d2c4, roughness: 0.7 }),
  );
  pole.position.set(22, 4.5, z + 96);
  group.add(pole);
  const sock = new THREE.Mesh(
    new THREE.ConeGeometry(1.1, 4.4, 10, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xff6a2a, roughness: 0.8, side: THREE.DoubleSide }),
  );
  sock.rotation.z = Math.PI / 2 + 0.25;
  sock.position.set(24.4, 8.4, z + 96);
  group.add(sock);
  // Two low hangars past the far end.
  const hangarMat = new THREE.MeshStandardMaterial({ color: 0x8a8f96, roughness: 0.85 });
  const doorMat = new THREE.MeshStandardMaterial({ color: C.planeOrange, roughness: 0.8 });
  for (const hx of [-34, 34]) {
    const hangar = new THREE.Mesh(new THREE.BoxGeometry(20, 9, 16), hangarMat);
    hangar.position.set(hx, 4.5, z - CONFIG.runwayLength / 2 - 34);
    group.add(hangar);
    const door = new THREE.Mesh(new THREE.BoxGeometry(14, 6, 0.4), doorMat);
    door.position.set(hx, 3, z - CONFIG.runwayLength / 2 - 25.8);
    group.add(door);
  }
  scene.add(group);
  return group;
}

/** Ring centres for a seed: gentle S-curves down the valley. */
export function ringLayout(seed) {
  const rng = mulberry32(seed * 7 + 3);
  const rings = [];
  for (let i = 0; i < CONFIG.ringCount; i++) {
    rings.push({
      index: i,
      x: range(rng, -46, 46),
      y: range(rng, 32, 72),
      z: CONFIG.firstRingZ - i * CONFIG.ringSpacing,
    });
  }
  return rings;
}

function buildRings(scene, seed) {
  const layout = ringLayout(seed);
  const rings = [];
  for (const spec of layout) {
    const group = new THREE.Group();
    group.position.set(spec.x, spec.y, spec.z);
    const torus = new THREE.Mesh(
      new THREE.TorusGeometry(CONFIG.ringRadius, 1.15, 12, 42),
      new THREE.MeshStandardMaterial({
        color: 0x7a4a08,
        emissive: C.ringNext,
        emissiveIntensity: 1.5,
        roughness: 0.4,
        metalness: 0.2,
      }),
    );
    group.add(torus);
    // A faint portal glow inside the ring.
    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(CONFIG.ringRadius - 0.8, 40),
      new THREE.MeshBasicMaterial({
        color: C.ringNext,
        transparent: true,
        opacity: 0.18,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    group.add(glow);
    // A small beacon light on top so the ring reads at distance.
    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(1.4, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xffe9b0, emissive: C.ringNext, emissiveIntensity: 3 }),
    );
    beacon.position.set(0, CONFIG.ringRadius + 2.2, 0);
    group.add(beacon);
    scene.add(group);
    rings.push({ ...spec, group, torus, glow, beacon, passed: false });
  }
  return rings;
}

function buildClouds(scene, seed) {
  const rng = mulberry32(seed * 13 + 5);
  const mat = new THREE.MeshStandardMaterial({
    color: C.cloud,
    roughness: 1,
    metalness: 0,
    transparent: true,
    opacity: 0.95,
    flatShading: true,
    // A warm lift so the shaded sides never go black at sunset.
    emissive: 0x8a6242,
    emissiveIntensity: 0.55,
  });
  const clouds = [];
  for (let i = 0; i < 22; i++) {
    const cloud = new THREE.Group();
    const puffs = 3 + Math.floor(rng() * 3);
    for (let p = 0; p < puffs; p++) {
      const r = range(rng, 7, 16);
      const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), mat);
      puff.position.set(range(rng, -14, 14), range(rng, -2, 3), range(rng, -9, 9));
      puff.scale.y = 0.45;
      cloud.add(puff);
    }
    cloud.position.set(range(rng, -420, 420), range(rng, 125, 195), range(rng, CONFIG.worldEnd, CONFIG.worldStart));
    scene.add(cloud);
    clouds.push({ group: cloud, drift: range(rng, 1, 2.4) });
  }
  return clouds;
}

function buildSky(scene) {
  const group = new THREE.Group();
  group.name = 'sunsetSky';
  const geo = new THREE.SphereGeometry(2600, 28, 14);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    fog: false,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(C.skyTop) },
      midColor: { value: new THREE.Color(C.skyMid) },
      horizonColor: { value: new THREE.Color(C.skyHorizon) },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying vec3 vDir;
      uniform vec3 topColor;
      uniform vec3 midColor;
      uniform vec3 horizonColor;
      void main() {
        float h = clamp(vDir.y, -0.08, 1.0);
        vec3 col = mix(horizonColor, midColor, smoothstep(0.0, 0.22, h));
        col = mix(col, topColor, smoothstep(0.18, 0.65, h));
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const dome = new THREE.Mesh(geo, mat);
  dome.renderOrder = -10;
  group.add(dome);
  // The low sun itself, a bright disc toward the west.
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(110, 40),
    new THREE.MeshBasicMaterial({ color: C.sun, fog: false, transparent: true, opacity: 0.98 }),
  );
  sun.position.set(-1350, 420, -1950);
  sun.lookAt(0, 0, 0);
  group.add(sun);
  // A soft halo around the sun.
  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(240, 40),
    new THREE.MeshBasicMaterial({ color: 0xffb060, fog: false, transparent: true, opacity: 0.28, depthWrite: false }),
  );
  halo.position.set(-1350, 420, -1952);
  halo.lookAt(0, 0, 0);
  group.add(halo);
  scene.add(group);
  return group;
}

/**
 * Build the whole world for a seed. Returns the pieces the game needs:
 * rings, clouds, the sky group (re-centred on the camera each frame),
 * and a height query for collisions.
 */
export function buildWorld(scene, seed) {
  scene.fog = new THREE.Fog(C.fog, 260, 1950);
  const sunLight = new THREE.DirectionalLight(0xffc98a, 2.4);
  sunLight.position.set(-700, 380, -500);
  scene.add(sunLight);
  const hemi = new THREE.HemisphereLight(0x8a76c9, 0x5a4632, 1.05);
  scene.add(hemi);

  buildTerrain(scene, seed);
  buildRiver(scene);
  buildRunway(scene);
  const rings = buildRings(scene, seed);
  const clouds = buildClouds(scene, seed);
  const skyGroup = buildSky(scene);

  return {
    seed,
    rings,
    clouds,
    skyGroup,
    terrainHeightAt(x, z) {
      return terrainHeight(x, z, seed);
    },
    /** Mark a ring passed: it turns green and dims. */
    setRingPassed(index) {
      const ring = rings[index];
      if (!ring) return;
      ring.passed = true;
      ring.torus.material.emissive.setHex(C.ringDone);
      ring.torus.material.emissiveIntensity = 0.7;
      ring.glow.material.color.setHex(C.ringDone);
      ring.glow.material.opacity = 0.05;
      ring.beacon.material.emissive.setHex(C.ringDone);
    },
    /** Reset all rings to their unpassed gold state. */
    resetRings() {
      for (const ring of rings) {
        ring.passed = false;
        ring.torus.material.emissive.setHex(C.ringNext);
        ring.torus.material.emissiveIntensity = 1.5;
        ring.glow.material.color.setHex(C.ringNext);
        ring.glow.material.opacity = 0.18;
        ring.beacon.material.emissive.setHex(C.ringNext);
      }
    },
    /** Animate: the next ring pulses, clouds drift. */
    update(dt, time, nextRingIndex) {
      for (let i = 0; i < rings.length; i++) {
        const ring = rings[i];
        if (ring.passed) continue;
        const isNext = i === nextRingIndex;
        const pulse = isNext ? 1.5 + Math.sin(time * 4) * 0.7 : 1.1;
        ring.torus.material.emissiveIntensity = pulse;
        ring.beacon.material.emissiveIntensity = isNext ? 3 + Math.sin(time * 4) * 1.5 : 2;
      }
      for (const cloud of clouds) {
        cloud.group.position.x += cloud.drift * dt;
        if (cloud.group.position.x > 470) cloud.group.position.x = -470;
      }
    },
  };
}
