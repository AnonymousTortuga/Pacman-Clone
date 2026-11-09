// Tile grid, collision queries, pellet bookkeeping and maze validation.

import { DIRS, DIR_ORDER } from './dirs.js';

export const WALL = '#';
export const PELLET = '.';
export const POWER = 'o';
export const EMPTY = ' ';
export const DOOR = '-';
export const TUNNEL = 'T';

const VALID_CHARS = new Set([WALL, PELLET, POWER, EMPTY, DOOR, TUNNEL]);

export class Maze {
  constructor(data) {
    this.data = data;
    this.id = data.id;
    this.width = data.width;
    this.height = data.height;
    this.spawns = data.spawns;
    this.reset();
  }

  /** Restore every pellet (new game). */
  reset() {
    this.tiles = this.data.rows.map((row) => row.split(''));
    this.totalItems = 0;
    for (const row of this.tiles) {
      for (const ch of row) if (ch === PELLET || ch === POWER) this.totalItems++;
    }
    this.itemsLeft = this.totalItems;
    this.version = 0; // bumps whenever a pellet is eaten, for renderers that cache
  }

  /** Character at a tile. Columns wrap (for tunnels); rows outside the grid are walls. */
  charAt(c, r) {
    if (r < 0 || r >= this.height) return WALL;
    const cc = ((c % this.width) + this.width) % this.width;
    return this.tiles[r][cc];
  }

  /** True when an actor may stand on this tile during normal movement. */
  isOpen(c, r) {
    const ch = this.charAt(c, r);
    return ch !== WALL && ch !== DOOR;
  }

  isTunnel(c, r) {
    return this.charAt(c, r) === TUNNEL;
  }

  /** Directions (in tie-break order) leading to an open neighbouring tile. */
  exits(c, r) {
    return DIR_ORDER.filter((d) => this.isOpen(c + DIRS[d].x, r + DIRS[d].y));
  }

  /** Eat whatever is on the tile; returns 'pellet', 'power' or null. */
  eatAt(c, r) {
    if (r < 0 || r >= this.height) return null;
    const cc = ((c % this.width) + this.width) % this.width;
    const ch = this.tiles[r][cc];
    if (ch !== PELLET && ch !== POWER) return null;
    this.tiles[r][cc] = EMPTY;
    this.itemsLeft--;
    this.version++;
    return ch === PELLET ? 'pellet' : 'power';
  }

  /**
   * Breadth-first distance (in tiles) from a target tile to every open tile.
   * Returns an array of rows; unreachable tiles hold -1. Computed once per maze
   * and used by eaten chasers to walk home.
   */
  distanceMap(tc, tr) {
    const dist = Array.from({ length: this.height }, () => new Array(this.width).fill(-1));
    const queue = [[tc, tr]];
    dist[tr][tc] = 0;
    for (let i = 0; i < queue.length; i++) {
      const [c, r] = queue[i];
      for (const d of DIR_ORDER) {
        const nr = r + DIRS[d].y;
        const nc = (((c + DIRS[d].x) % this.width) + this.width) % this.width;
        if (nr < 0 || nr >= this.height) continue;
        if (dist[nr][nc] !== -1 || !this.isOpen(nc, nr)) continue;
        dist[nr][nc] = dist[r][c] + 1;
        queue.push([nc, nr]);
      }
    }
    return dist;
  }

  /**
   * Structural checks beyond the JSON schema: shape, closed borders, tunnels
   * paired, door present, spawns placed sensibly, every corridor reachable
   * from the player start and free of dead ends.
   */
  static validate(data) {
    const errors = [];
    const { width, height, rows, spawns } = data;
    if (!Array.isArray(rows) || rows.length !== height) {
      errors.push(`expected ${height} rows, found ${rows ? rows.length : 0}`);
      return errors;
    }
    rows.forEach((row, r) => {
      if (row.length !== width) errors.push(`row ${r}: expected ${width} columns, found ${row.length}`);
      for (const ch of row) if (!VALID_CHARS.has(ch)) errors.push(`row ${r}: unknown tile "${ch}"`);
    });
    if (errors.length) return errors;

    const m = new Maze(data);
    const open = (c, r) => m.isOpen(c, r);

    for (let c = 0; c < width; c++) {
      if (open(c, 0) || open(c, height - 1)) errors.push(`column ${c}: top/bottom border must be wall`);
    }
    for (let r = 0; r < height; r++) {
      const left = rows[r][0];
      const right = rows[r][width - 1];
      if (left === TUNNEL || right === TUNNEL) {
        if (left !== TUNNEL || right !== TUNNEL) errors.push(`row ${r}: tunnel must open on both sides`);
      } else if (left !== WALL || right !== WALL) {
        errors.push(`row ${r}: side border must be wall or a paired tunnel`);
      }
    }
    if (!rows.some((row) => row.includes(DOOR))) errors.push('maze has no house door');

    for (const key of ['player', 'chaserOutside', 'doorEntry', 'bonus']) {
      const [c, r] = spawns[key];
      if (!open(c, r)) errors.push(`spawn "${key}" at ${c},${r} is not an open tile`);
    }
    const [dc, dr] = spawns.doorEntry;
    if (rows[dr + 1]?.[dc] !== DOOR) errors.push('doorEntry must sit directly above a door tile');

    // Reachability from the player start (the house interior is closed off by the door).
    const [pc, pr] = spawns.player;
    const reach = m.distanceMap(pc, pr);
    const [hc, hr] = spawns.houseCenter;
    const house = m.distanceMap(hc, hr);
    for (const [c, r] of spawns.houseSlots) {
      if (house[r][c] === -1) errors.push(`house slot ${c},${r} is not inside the house`);
    }
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        if (!open(c, r)) continue;
        if (reach[r][c] === -1) {
          if (house[r][c] === -1) errors.push(`tile ${c},${r} cannot be reached`);
          continue;
        }
        if (m.exits(c, r).length < 2) errors.push(`tile ${c},${r} is a dead end`);
      }
    }
    if (m.totalItems === 0) errors.push('maze has no pellets');
    return errors;
  }
}
