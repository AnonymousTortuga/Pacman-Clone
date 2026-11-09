// Keyboard, touch/mouse and gamepad -> one intent per game tick:
// { dir: 'up'|'down'|'left'|'right'|null, start: boolean, pause: boolean }

const KEY_DIRS = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
};
const SWIPE_MIN_PX = 18;

export function createInput({ canvas, isPauseArea }) {
  const held = []; // direction keys currently down, most recent last
  let swipeDir = null; // a swipe keeps steering until the next swipe or key
  let startQueued = false;
  let pauseQueued = false;
  let enabled = true;
  let pointer = null;
  const padPrev = { start: false, a: false };

  const typingInField = (e) => e.target instanceof HTMLElement && e.target.closest('input, select, textarea, button');

  function onKeyDown(e) {
    if (!enabled || typingInField(e)) return;
    const dir = KEY_DIRS[e.code];
    if (dir) {
      e.preventDefault();
      swipeDir = null;
      const i = held.indexOf(dir);
      if (i !== -1) held.splice(i, 1);
      held.push(dir);
    } else if (e.code === 'KeyP' || e.code === 'Escape') {
      e.preventDefault();
      if (!e.repeat) pauseQueued = true;
    } else if (e.code === 'Enter' || e.code === 'Space') {
      e.preventDefault();
      if (!e.repeat) startQueued = true;
    }
  }

  function onKeyUp(e) {
    const dir = KEY_DIRS[e.code];
    if (!dir) return;
    const i = held.indexOf(dir);
    if (i !== -1) held.splice(i, 1);
  }

  function onPointerDown(e) {
    if (!enabled) return;
    pointer = { id: e.pointerId, x: e.clientX, y: e.clientY };
    canvas.setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e) {
    if (!pointer || pointer.id !== e.pointerId) return;
    const dx = e.clientX - pointer.x;
    const dy = e.clientY - pointer.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN_PX) return;
    // Steer as soon as the finger has moved far enough; a long drag can re-steer.
    swipeDir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    pointer = { id: e.pointerId, x: e.clientX, y: e.clientY, swiped: true };
  }

  function onPointerUp(e) {
    if (!pointer || pointer.id !== e.pointerId) return;
    if (!pointer.swiped) {
      if (isPauseArea(e.clientX, e.clientY)) pauseQueued = true;
      else startQueued = true;
    }
    pointer = null;
  }

  function onBlur() {
    held.length = 0;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', () => (pointer = null));
  canvas.style.touchAction = 'none';

  function readGamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const pad of pads) {
      if (!pad) continue;
      const b = (i) => !!pad.buttons[i]?.pressed;
      const ax = pad.axes[0] || 0;
      const ay = pad.axes[1] || 0;
      let dir = null;
      if (b(12) || ay < -0.5) dir = 'up';
      else if (b(13) || ay > 0.5) dir = 'down';
      else if (b(14) || ax < -0.5) dir = 'left';
      else if (b(15) || ax > 0.5) dir = 'right';
      const start = b(9);
      const a = b(0);
      if (start && !padPrev.start) pauseQueued = true;
      if (a && !padPrev.a) startQueued = true;
      padPrev.start = start;
      padPrev.a = a;
      return dir;
    }
    return null;
  }

  return {
    /** Read and clear this tick's input. Call once per game tick. */
    consume() {
      const padDir = readGamepad();
      const intent = {
        dir: enabled ? held[held.length - 1] || padDir || swipeDir : null,
        start: enabled && startQueued,
        pause: enabled && pauseQueued,
      };
      startQueued = false;
      pauseQueued = false;
      return intent;
    },
    setEnabled(on) {
      enabled = on;
      if (!on) {
        held.length = 0;
        swipeDir = null;
      }
    },
    /** Forget a lingering swipe, e.g. when a new game starts. */
    clearSwipe() {
      swipeDir = null;
    },
  };
}
