// Munch: continuous movement, buffered input, pre-turning, eating pauses.

import { Actor } from './actor.js';
import { opposite, isPerpendicular } from './dirs.js';

export class Player extends Actor {
  constructor(maze, rules) {
    super(maze);
    this.rules = rules;
    this.reset();
  }

  reset() {
    const [c, r] = this.maze.spawns.player;
    this.placeAtTile(c, r, 'left');
    this.want = null; // buffered direction
    this.wantAge = 0;
    this.pauseFrames = 0;
    this.distance = 0; // total pixels moved, drives the mouth animation
  }

  /** Record this tick's input. A pressed direction is remembered for a few ticks. */
  setIntent(dir) {
    if (dir) {
      this.want = dir;
      this.wantAge = 0;
    } else if (this.want && ++this.wantAge > this.rules.inputBufferTicks) {
      this.want = null;
    }
  }

  update(speed) {
    if (this.pauseFrames > 0) {
      this.pauseFrames--;
      return;
    }
    const want = this.want;
    if (want && want !== this.dir) {
      if (want === opposite(this.dir)) {
        // Reversing is always allowed, even mid-tile.
        this.dir = want;
        this.stopped = false;
        this.centered = false;
      } else if (isPerpendicular(want, this.dir) && this.canMove(want)) {
        // Pre-turn: close enough to the centre, so cut the corner.
        const off = Math.abs(this.offsetToCenter());
        if (this.stopped || off <= this.rules.preTurnPx) {
          this.snapToCenter();
          this.dir = want;
          this.stopped = false;
          this.centered = true;
        }
      }
    } else if (want && this.stopped && this.canMove(want)) {
      this.stopped = false;
    }
    const before = { x: this.x, y: this.y };
    this.advance(speed);
    // min() ignores the jump when wrapping through the tunnel
    this.distance += Math.min(Math.abs(this.x - before.x), speed) + Math.abs(this.y - before.y);
  }

  onCenter() {
    if (this.want && this.want !== this.dir && this.canMove(this.want)) {
      this.dir = this.want;
      return;
    }
    if (!this.canMove(this.dir)) this.stopped = true;
  }
}
