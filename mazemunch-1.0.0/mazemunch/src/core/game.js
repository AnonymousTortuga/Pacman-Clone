// Top-level game state machine. The only place game state changes is tick();
// snapshot() hands the renderer plain data. Nothing here touches the browser.
//
// States: title -> ready -> playing -> (dying -> ready | cleared -> won) ... gameover

import { Maze } from './maze.js';
import { Player } from './player.js';
import { Chaser, ACTIVE, HOUSE } from './chaser.js';
import { createRules } from './rules.js';
import { createRng } from './rng.js';

export const TITLE = 'title';
export const READY = 'ready';
export const PLAYING = 'playing';
export const DYING = 'dying';
export const CLEARED = 'cleared';
export const WON = 'won';
export const GAME_OVER = 'gameover';

const TOUCH_DISTANCE = 6; // pixels between centres that counts as touching
const END_SCREEN_DELAY = 60; // ticks before an end screen accepts "start"

export class Game {
  constructor({ mazeData, level, seed = 1, highScore = 0 }) {
    this.maze = new Maze(mazeData);
    this.rules = createRules(level);
    this.seed = seed;
    this.rng = createRng(seed);
    this.player = new Player(this.maze, this.rules);
    const slots = [...this.maze.spawns.houseSlots];
    this.chasers = level.chasers.map(
      (cfg) => new Chaser(this.maze, this.rules, cfg, cfg.startsOutside ? null : slots.shift()),
    );
    this.homeMap = this.maze.distanceMap(...this.maze.spawns.doorEntry);
    this.highScore = highScore;
    this.score = 0;
    this.lives = 0;
    this.paused = false;
    this.locked = false; // the shell sets this while it collects high-score initials
    this.ticks = 0;
    this.events = [];
    this.itemsEaten = 0;
    this.bonusesShown = 0;
    this.extraLifeGiven = false;
    this.resetRound(); // the title screen draws the maze and chasers too
    this.setState(TITLE);
  }

  // ---------------------------------------------------------------- control

  setState(state) {
    this.state = state;
    this.stateTicks = 0;
    this.emit({ type: 'state', state });
  }

  emit(event) {
    this.events.push(event);
  }

  /** Remove and return events produced since the last call (the shell reads these). */
  drainEvents() {
    const out = this.events;
    this.events = [];
    return out;
  }

  setPaused(paused) {
    if (this.state !== PLAYING && this.state !== READY) return;
    if (this.paused !== paused) {
      this.paused = paused;
      this.emit({ type: 'pause', paused });
    }
  }

  newGame() {
    this.rng = createRng(this.seed);
    this.maze.reset();
    this.score = 0;
    this.lives = this.rules.level.startingLives;
    this.extraLifeGiven = false;
    this.itemsEaten = 0;
    this.bonusesShown = 0;
    this.paused = false;
    this.resetRound();
    this.setState(READY);
  }

  /** Put every actor back at its start; pellets stay as they are. */
  resetRound() {
    this.player.reset();
    for (const c of this.chasers) c.reset();
    this.frightenedLeft = 0;
    this.combo = 0;
    this.releaseTimer = 0;
    this.bonus = null;
    this.popups = [];
  }

  // ---------------------------------------------------------------- tick

  /** Advance exactly one 1/60 s step. intent = { dir, start, pause } */
  tick(intent = {}) {
    this.ticks++;
    if (intent.pause) this.setPaused(!this.paused);
    if (this.paused) return;
    this.stateTicks++;
    const r = this.rules;

    switch (this.state) {
      case TITLE:
        if (intent.start) this.newGame();
        break;
      case READY:
        if (this.stateTicks >= r.readyTicks) this.setState(PLAYING);
        break;
      case PLAYING:
        this.stepPlaying(intent);
        break;
      case DYING:
        if (this.stateTicks >= r.deathTicks) {
          this.lives--;
          if (this.lives <= 0) this.endGame(GAME_OVER);
          else {
            this.resetRound();
            this.setState(READY);
          }
        }
        break;
      case CLEARED:
        if (this.stateTicks >= r.clearTicks) this.endGame(WON);
        break;
      case WON:
      case GAME_OVER:
        if (intent.start && !this.locked && this.stateTicks > END_SCREEN_DELAY) this.setState(TITLE);
        break;
    }
    this.popups = this.popups.filter((p) => --p.ttl > 0);
  }

  endGame(result) {
    this.setState(result);
    this.emit({ type: 'ended', result, score: this.score });
  }

  addScore(points) {
    this.score += points;
    if (this.score > this.highScore) this.highScore = this.score;
    const at = this.rules.level.extraLifeAt;
    if (!this.extraLifeGiven && at > 0 && this.score >= at) {
      this.extraLifeGiven = true;
      this.lives++;
      this.emit({ type: 'extraLife' });
    }
  }

  stepPlaying(intent) {
    const { maze, player, rules } = this;
    const level = rules.level;

    // 1. Munch moves and eats.
    player.setIntent(intent.dir || null);
    let speed = rules.speed.munch;
    if (maze.isTunnel(player.col, player.row)) speed = Math.min(speed, rules.speed.tunnel);
    player.update(speed);

    const ate = maze.eatAt(player.col, player.row);
    if (ate) {
      this.itemsEaten++;
      if (ate === 'pellet') {
        this.addScore(level.points.pellet);
        player.pauseFrames = level.pauseFrames.pellet;
      } else {
        this.addScore(level.points.power);
        player.pauseFrames = level.pauseFrames.power;
        this.startFright();
      }
      this.emit({ type: 'eat', item: ate });
      const appear = level.bonus.appearAfterPellets;
      if (this.bonusesShown < appear.length && this.itemsEaten === appear[this.bonusesShown]) {
        this.bonusesShown++;
        this.bonus = { ticks: rules.bonusTicks };
      }
    }

    // 2. Bonus item.
    if (this.bonus) {
      const [bc, br] = maze.spawns.bonus;
      if (player.col === bc && player.row === br) {
        this.addScore(level.bonus.points);
        this.popup(level.bonus.points, player.x, player.y);
        this.emit({ type: 'bonus' });
        this.bonus = null;
      } else if (--this.bonus.ticks <= 0) {
        this.bonus = null;
      }
    }

    if (maze.itemsLeft === 0) {
      this.setState(CLEARED);
      this.emit({ type: 'cleared' });
      return;
    }

    // 3. Release the next chaser from the house on a fixed interval.
    if (++this.releaseTimer >= rules.releaseTicks) {
      const next = this.chasers.find((c) => c.state === HOUSE);
      if (next) next.release();
      this.releaseTimer = 0;
    }

    // 4. Chasers move.
    const ctx = { target: { col: player.col, row: player.row }, rng: this.rng, homeMap: this.homeMap };
    for (const c of this.chasers) c.update(ctx);

    // 5. Collisions.
    for (const c of this.chasers) {
      if (c.state !== ACTIVE) continue;
      if (Math.hypot(c.x - player.x, c.y - player.y) >= TOUCH_DISTANCE) continue;
      if (c.frightened) {
        const pts = rules.chaserPoints(this.combo++);
        this.addScore(pts);
        this.popup(pts, c.x, c.y);
        c.eat();
        this.emit({ type: 'chaserEaten', name: c.name, points: pts });
      } else {
        this.setState(DYING);
        this.emit({ type: 'death' });
        return;
      }
    }

    // 6. Frightened timer.
    if (this.frightenedLeft > 0 && --this.frightenedLeft === 0) {
      for (const c of this.chasers) c.frightened = false;
    }
  }

  startFright() {
    if (this.rules.frightenedTicks <= 0) return;
    this.frightenedLeft = this.rules.frightenedTicks;
    this.combo = 0;
    for (const c of this.chasers) c.frighten();
  }

  popup(points, x, y) {
    this.popups.push({ text: String(points), x, y, ttl: 60 });
  }

  // ---------------------------------------------------------------- read-only view

  snapshot() {
    const { player, rules } = this;
    const flashing = this.frightenedLeft > 0 && this.frightenedLeft <= rules.flashTicks;
    return {
      state: this.state,
      stateTicks: this.stateTicks,
      paused: this.paused,
      ticks: this.ticks,
      score: this.score,
      highScore: this.highScore,
      lives: this.lives,
      maze: this.maze,
      player: {
        x: player.x,
        y: player.y,
        dir: player.dir,
        stopped: player.stopped,
        distance: player.distance,
      },
      chasers: this.chasers.map((c) => ({
        name: c.name,
        color: c.color,
        x: c.x,
        y: c.y,
        dir: c.dir,
        state: c.state,
        frightened: c.frightened,
        flash: flashing && c.frightened && Math.floor(this.frightenedLeft / 12) % 2 === 0,
      })),
      bonus: this.bonus ? { col: this.maze.spawns.bonus[0], row: this.maze.spawns.bonus[1], name: rules.level.bonus.name } : null,
      popups: this.popups.map((p) => ({ ...p })),
      deathProgress: this.state === DYING ? this.stateTicks / rules.deathTicks : 0,
      clearProgress: this.state === CLEARED ? this.stateTicks / rules.clearTicks : 0,
    };
  }
}
