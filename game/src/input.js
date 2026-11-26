// Keyboard and mouse input for Ember Canyon. Keys are the primary
// controls; the mouse steers too (move to bank and pitch) once the
// pointer is over the canvas. All state is read fresh every frame, so
// the game never depends on key-repeat timing.

/** Keys we care about, by KeyboardEvent.code. */
const THROTTLE_UP = ['KeyW', 'NumpadAdd'];
const THROTTLE_DOWN = ['KeyS', 'NumpadSubtract'];
const PITCH_UP = ['ArrowUp'];
const PITCH_DOWN = ['ArrowDown'];
const ROLL_LEFT = ['ArrowLeft', 'KeyA'];
const ROLL_RIGHT = ['ArrowRight', 'KeyD'];

/** Create the input state. `element` is the canvas wrapper to watch. */
export function createInput(element) {
  const keys = new Set();
  const mouse = { x: 0, y: 0, active: false, inside: false };
  const pressed = new Set();
  let lastPointer = { x: 0, y: 0 };

  function codeOf(e) {
    return e.code || '';
  }

  window.addEventListener('keydown', (e) => {
    const code = codeOf(e);
    if (code === '') return;
    if (
      THROTTLE_UP.includes(code) ||
      THROTTLE_DOWN.includes(code) ||
      PITCH_UP.includes(code) ||
      PITCH_DOWN.includes(code) ||
      ROLL_LEFT.includes(code) ||
      ROLL_RIGHT.includes(code) ||
      code === 'Space'
    ) {
      e.preventDefault();
    }
    if (!keys.has(code)) pressed.add(code);
    keys.add(code);
  });
  window.addEventListener('keyup', (e) => {
    keys.delete(codeOf(e));
  });
  window.addEventListener('blur', () => {
    keys.clear();
    mouse.active = false;
  });

  element.addEventListener('pointermove', (e) => {
    const rect = element.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1;
    mouse.y = ((e.clientY - rect.top) / Math.max(rect.height, 1)) * 2 - 1;
    mouse.inside = true;
    mouse.active = true;
    lastPointer = { x: e.clientX, y: e.clientY };
  });
  element.addEventListener('pointerleave', () => {
    mouse.inside = false;
    mouse.active = false;
  });
  element.addEventListener('pointerdown', () => {
    mouse.active = true;
  });

  const has = (list) => list.some((c) => keys.has(c));

  return {
    /** -1, 0 or +1: throttle down, hold, up. */
    get throttleDir() {
      return (has(THROTTLE_UP) ? 1 : 0) - (has(THROTTLE_DOWN) ? 1 : 0);
    },
    /** -1 (nose down) .. +1 (nose up) from keys and mouse. */
    get pitchInput() {
      let v = (has(PITCH_UP) ? 1 : 0) - (has(PITCH_DOWN) ? 1 : 0);
      if (mouse.active && mouse.inside) v += -mouse.y * 0.9;
      return Math.max(-1, Math.min(1, v));
    },
    /** -1 (bank left) .. +1 (bank right) from keys and mouse. */
    get rollInput() {
      let v = (has(ROLL_RIGHT) ? 1 : 0) - (has(ROLL_LEFT) ? 1 : 0);
      if (mouse.active && mouse.inside) v += mouse.x * 0.9;
      return Math.max(-1, Math.min(1, v));
    },
    /** True once for a key pressed since the last call to `consume`. */
    wasPressed(code) {
      return pressed.has(code);
    },
    /** Clear the just-pressed set; call once per frame. */
    consume() {
      pressed.clear();
    },
    get pointer() {
      return lastPointer;
    },
    get mouseActive() {
      return mouse.active;
    },
  };
}
