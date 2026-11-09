// Shared movement for the player and chasers: pixel position, facing
// direction, and a move routine that stops at every tile centre so the
// subclass can decide what to do there.

import { DIRS, TILE, centerPx, tileOf } from './dirs.js';

export class Actor {
  constructor(maze) {
    this.maze = maze;
    this.x = 0;
    this.y = 0;
    this.dir = 'left';
    this.stopped = false;
    this.centered = false; // true when sitting on a tile centre that has already been decided
  }

  get col() {
    return tileOf(this.x);
  }

  get row() {
    return tileOf(this.y);
  }

  placeAtTile(c, r, dir = 'left') {
    this.x = centerPx(c);
    this.y = centerPx(r);
    this.dir = dir;
    this.stopped = false;
    this.centered = false;
  }

  /** Signed distance from the current position to the centre of the current tile along `dir`. */
  offsetToCenter(dir = this.dir) {
    const d = DIRS[dir];
    if (d.x) return (centerPx(this.col) - this.x) * d.x;
    return (centerPx(this.row) - this.y) * d.y;
  }

  snapToCenter() {
    this.x = centerPx(this.col);
    this.y = centerPx(this.row);
  }

  wrap() {
    const w = this.maze.width * TILE;
    if (this.x < 0) this.x += w;
    else if (this.x >= w) this.x -= w;
  }

  /** Can the actor step from its current tile in direction `dir`? */
  canMove(dir) {
    const d = DIRS[dir];
    return this.maze.isOpen(this.col + d.x, this.row + d.y);
  }

  /**
   * Move up to `dist` pixels. Stops exactly on each tile centre it reaches and
   * calls onCenter(), which may turn, stop, or leave the direction alone.
   */
  advance(dist) {
    let guard = 0;
    while (dist > 1e-9 && !this.stopped && guard++ < 16) {
      const d = DIRS[this.dir];
      let to = this.offsetToCenter();
      if (to < 0 || (to === 0 && this.centered)) to += TILE;
      if (dist < to) {
        this.x += d.x * dist;
        this.y += d.y * dist;
        this.centered = false;
        this.wrap();
        return;
      }
      this.x += d.x * to;
      this.y += d.y * to;
      dist -= to;
      this.wrap();
      this.snapToCenter();
      this.centered = true;
      this.onCenter();
    }
  }

  /** Called on reaching a tile centre. Subclasses override. */
  onCenter() {}
}
