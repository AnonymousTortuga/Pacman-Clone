// Directions and tile/pixel geometry shared by the whole core.

export const TILE = 8; // logical pixels per tile

export const DIRS = Object.freeze({
  up: Object.freeze({ x: 0, y: -1 }),
  left: Object.freeze({ x: -1, y: 0 }),
  down: Object.freeze({ x: 0, y: 1 }),
  right: Object.freeze({ x: 1, y: 0 }),
});

// Fixed tie-break order from the spec: up, left, down, right.
export const DIR_ORDER = Object.freeze(['up', 'left', 'down', 'right']);

const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };

export function opposite(dir) {
  return dir ? OPPOSITE[dir] : null;
}

export function isPerpendicular(a, b) {
  if (!a || !b) return false;
  return DIRS[a].x !== 0 ? DIRS[b].y !== 0 : DIRS[b].x !== 0;
}

/** Pixel coordinate of the centre of tile index `t`. */
export function centerPx(t) {
  return t * TILE + TILE / 2;
}

/** Tile index containing pixel coordinate `p`. */
export function tileOf(p) {
  return Math.floor(p / TILE);
}
