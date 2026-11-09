// The one chase rule every chaser shares, and the eyes-home step.
//
// At an intersection: roll a number; below the chaser's aggression, take the
// exit that brings it closest (straight-line) to Munch; otherwise pick a
// random exit. Frightened chasers always pick randomly. No reversing.

import { DIRS, opposite } from './dirs.js';

export function chooseExit({ maze, col, row, dir, target, aggression, rng, frightened = false }) {
  let exits = maze.exits(col, row).filter((d) => d !== opposite(dir));
  if (exits.length === 0) exits = maze.exits(col, row); // only possible in a dead end
  if (exits.length === 0) return dir;
  if (exits.length === 1) return exits[0];

  if (!frightened && rng() < aggression) {
    let best = exits[0];
    let bestDist = Infinity;
    for (const d of exits) {
      const nc = col + DIRS[d].x;
      const nr = row + DIRS[d].y;
      const dist = (nc - target.col) ** 2 + (nr - target.row) ** 2;
      if (dist < bestDist) {
        // strict < keeps the spec's tie-break order (exits come up, left, down, right)
        best = d;
        bestDist = dist;
      }
    }
    return best;
  }
  return exits[Math.floor(rng() * exits.length)];
}

/** Direction that walks one tile down the distance map toward the house door. */
export function stepHome({ maze, map, col, row, dir }) {
  let best = dir;
  let bestDist = Infinity;
  for (const d of maze.exits(col, row)) {
    const nr = row + DIRS[d].y;
    const nc = (((col + DIRS[d].x) % maze.width) + maze.width) % maze.width;
    const v = map[nr][nc];
    if (v >= 0 && v < bestDist) {
      best = d;
      bestDist = v;
    }
  }
  return best;
}
