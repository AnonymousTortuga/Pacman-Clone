// A chaser: in the house, leaving it, chasing, frightened, or eaten (eyes).

import { Actor } from './actor.js';
import { centerPx, opposite } from './dirs.js';
import { chooseExit, stepHome } from './chase.js';

export const HOUSE = 'house';
export const LEAVING = 'leaving';
export const ACTIVE = 'active';
export const EATEN = 'eaten';
export const ENTERING = 'entering';

export class Chaser extends Actor {
  constructor(maze, rules, config, slot) {
    super(maze);
    this.rules = rules;
    this.name = config.name;
    this.color = config.color;
    this.aggression = config.aggression;
    this.startsOutside = config.startsOutside;
    this.slot = slot; // [col, row] inside the house
    this.reset();
  }

  reset() {
    this.frightened = false;
    this.bob = 1;
    if (this.startsOutside) {
      const [c, r] = this.maze.spawns.chaserOutside;
      this.placeAtTile(c, r, 'left');
      this.state = ACTIVE;
    } else {
      const [c, r] = this.slot;
      this.placeAtTile(c, r, 'up');
      this.state = HOUSE;
    }
  }

  get inPlay() {
    return this.state === ACTIVE;
  }

  /** Power pellet eaten: active chasers turn blue and reverse once. */
  frighten() {
    if (this.state !== ACTIVE) return;
    this.frightened = true;
    this.dir = opposite(this.dir);
    this.centered = false;
  }

  release() {
    if (this.state === HOUSE) this.state = LEAVING;
  }

  eat() {
    this.state = EATEN;
    this.frightened = false;
    this.centered = false;
    this.stopped = false;
  }

  update(ctx) {
    this.ctx = ctx;
    const { speed } = this.rules;
    switch (this.state) {
      case HOUSE:
        return this.bobInHouse();
      case LEAVING:
        return this.walkOut(speed.house);
      case ENTERING:
        return this.walkIn(speed.eaten);
      case EATEN:
        return this.advance(speed.eaten);
      case ACTIVE: {
        let s = this.frightened ? speed.frightened : speed.chaser;
        if (this.maze.isTunnel(this.col, this.row)) s = Math.min(s, speed.tunnel);
        return this.advance(s);
      }
    }
  }

  bobInHouse() {
    const home = centerPx(this.slot[1]);
    this.y += this.bob * 0.25;
    if (Math.abs(this.y - home) >= 2) this.bob = -this.bob;
    this.dir = this.bob < 0 ? 'up' : 'down';
  }

  /** Slide sideways to the door column, then straight up and out. */
  walkOut(s) {
    const [dc, dr] = this.maze.spawns.doorEntry;
    const tx = centerPx(dc);
    const ty = centerPx(dr);
    if (this.x !== tx) {
      this.dir = this.x < tx ? 'right' : 'left';
      this.x = this.x < tx ? Math.min(tx, this.x + s) : Math.max(tx, this.x - s);
      return;
    }
    this.dir = 'up';
    this.y = Math.max(ty, this.y - s);
    if (this.y === ty) {
      this.state = ACTIVE;
      this.dir = 'left';
      this.stopped = false;
      this.centered = false; // decide at this tile on the next move
    }
  }

  /** Eyes at the door: drop down to the house centre, then come straight back out. */
  walkIn(s) {
    const [, hr] = this.maze.spawns.houseCenter;
    const ty = centerPx(hr);
    this.dir = 'down';
    this.y = Math.min(ty, this.y + s);
    if (this.y === ty) this.state = LEAVING;
  }

  onCenter() {
    const { maze, ctx } = this;
    if (this.state === EATEN) {
      const [dc, dr] = maze.spawns.doorEntry;
      if (this.col === dc && this.row === dr) {
        this.state = ENTERING;
        this.stopped = true; // ends this tick's advance(); ENTERING moves on its own
        return;
      }
      this.dir = stepHome({ maze, map: ctx.homeMap, col: this.col, row: this.row, dir: this.dir });
      return;
    }
    this.dir = chooseExit({
      maze,
      col: this.col,
      row: this.row,
      dir: this.dir,
      target: ctx.target,
      aggression: this.aggression,
      rng: ctx.rng,
      frightened: this.frightened,
    });
  }

  /** True when touching this chaser costs Munch a life. */
  get deadly() {
    return this.state === ACTIVE && !this.frightened;
  }
}
