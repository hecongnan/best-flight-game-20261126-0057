// Ember Canyon's aircraft: "Kestrel", a small single-prop bush plane
// built from three.js primitives — fuselage, wings, tail, canopy and a
// spinning propeller. No model file is loaded; the plane is assembled
// here so it always matches the game's art direction.

import * as THREE from 'three';
import { CONFIG } from './config.js';

const C = CONFIG.colors;

/** A standard material in one line, for the plane's parts. */
function part(color, roughness = 0.55, metalness = 0.15) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

/**
 * Build the Kestrel and return its group plus the propeller spinner
 * (spin it every frame) and a reference to the landing-gear group.
 * The plane faces -Z when its rotation is zero.
 */
export function buildPlane() {
  const plane = new THREE.Group();
  plane.name = 'kestrelPlane';
  const cream = part(C.planeCream, 0.5, 0.1);
  const orange = part(C.planeOrange, 0.5, 0.1);
  const dark = part(C.planeDark, 0.6, 0.3);
  const glass = new THREE.MeshStandardMaterial({
    color: 0x1c2f4a,
    roughness: 0.12,
    metalness: 0.7,
  });

  // Fuselage: a stretched sphere, nose toward -Z.
  const fuselage = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), cream);
  fuselage.scale.set(1, 0.92, 3.4);
  fuselage.position.set(0, 0, 0.4);
  plane.add(fuselage);

  // Nose cone and engine cowling.
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.82, 1.5, 16), orange);
  nose.rotation.x = -Math.PI / 2;
  nose.position.set(0, 0.05, -2.9);
  plane.add(nose);

  // A dark cheatline stripe along each side.
  for (const side of [-1, 1]) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.28, 5.4), orange);
    stripe.position.set(side * 0.98, -0.12, 0.4);
    plane.add(stripe);
  }

  // Canopy: a dark glass bubble over the cockpit.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.62, 16, 12), glass);
  canopy.scale.set(0.85, 0.75, 1.5);
  canopy.position.set(0, 0.72, -0.6);
  plane.add(canopy);

  // Main wings: one bar with orange tips, slight dihedral.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(11, 0.22, 2.3), cream);
  wing.position.set(0, 0.05, -0.2);
  wing.rotation.z = 0;
  plane.add(wing);
  for (const side of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.24, 2.3), orange);
    tip.position.set(side * 5.0, 0.05, -0.2);
    plane.add(tip);
    // Wingtip navigation lights.
    const nav = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 8, 6),
      new THREE.MeshStandardMaterial({
        color: side < 0 ? 0xff3b30 : 0x35e065,
        emissive: side < 0 ? 0xff3b30 : 0x35e065,
        emissiveIntensity: 2.5,
      }),
    );
    nav.position.set(side * 5.55, 0.05, -0.2);
    plane.add(nav);
  }

  // Tail: horizontal stabiliser and a tall vertical fin.
  const tailplane = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.16, 1.15), cream);
  tailplane.position.set(0, 0.28, 3.2);
  plane.add(tailplane);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.35, 1.5), orange);
  fin.position.set(0, 0.78, 3.15);
  plane.add(fin);

  // Landing gear: two wheels on struts plus a tail wheel.
  const gear = new THREE.Group();
  gear.name = 'landingGear';
  for (const side of [-1, 1]) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.1, 8), dark);
    strut.position.set(side * 0.85, -0.95, -0.6);
    gear.add(strut);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 14), dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(side * 0.85, -1.5, -0.6);
    gear.add(wheel);
  }
  const tailWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.18, 10), dark);
  tailWheel.rotation.z = Math.PI / 2;
  tailWheel.position.set(0, -1.15, 3.1);
  gear.add(tailWheel);
  plane.add(gear);

  // Propeller: a hub and two blades, spinning around the nose axis (Z).
  const propeller = new THREE.Group();
  propeller.name = 'propeller';
  propeller.position.set(0, 0.05, -3.75);
  const hub = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.7, 10), dark);
  hub.rotation.x = -Math.PI / 2;
  propeller.add(hub);
  for (const angle of [0, Math.PI]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.34, 2.6, 0.1), dark);
    blade.position.set(0, 0, 0);
    blade.rotation.z = angle;
    // Give each blade a slight pitch so it reads as a propeller.
    blade.rotation.y = 0.35;
    propeller.add(blade);
  }
  plane.add(propeller);

  return { group: plane, propeller, gear };
}
