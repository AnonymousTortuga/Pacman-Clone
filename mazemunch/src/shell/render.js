// Canvas 2D renderer. Draws a read-only snapshot from core/game.js.
// Logical screen: 224 x 288 (28 x 36 tiles of 8 px): 24 px HUD on top,
// 248 px maze, 16 px lives row at the bottom.

import { TILE } from '../core/dirs.js';

export const SCREEN_W = 224;
export const SCREEN_H = 288;
export const MAZE_TOP = 24;
export const PAUSE_BUTTON = { x: 200, y: 0, w: 24, h: 24 };

const C = {
  bg: '#0b0820',
  wallFill: '#1a1238',
  wallLine: '#8a72ff',
  wallFlash: '#f4f0ff',
  door: '#ff9ccf',
  pellet: '#f5dfae',
  munch: '#7ef0c4',
  munchDark: '#0f3d2e',
  leaf: '#3fbf7f',
  frightened: '#3d4bff',
  frightenedFace: '#ffd8a8',
  flash: '#f2f2ff',
  text: '#f4f0ff',
  dim: '#a59ccf',
  accent: '#ffd43b',
  danger: '#ff6b6b',
  cherry: '#ff3b5c',
};

const FONT = 'ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace';
const MARKERS = { Rook: 'square', Vex: 'triangle', Gale: 'circle', Moss: 'diamond' };

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let scale = 1; // device pixels per logical pixel
  let wallLayers = null; // { normal, flash } offscreen canvases
  let wallKey = '';

  function resize() {
    const parent = canvas.parentElement;
    const availW = parent.clientWidth || window.innerWidth;
    const availH = parent.clientHeight || window.innerHeight;
    let css = Math.min(availW / SCREEN_W, availH / SCREEN_H);
    // Integer scaling where it costs little; otherwise fill the screen (phones).
    // Everything is drawn as vectors at device resolution, so fractions stay sharp.
    if (Math.floor(css) >= 1 && Math.floor(css) >= css * 0.85) css = Math.floor(css);
    css = Math.max(css, 0.5);
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = `${Math.round(SCREEN_W * css)}px`;
    canvas.style.height = `${Math.round(SCREEN_H * css)}px`;
    canvas.width = Math.round(SCREEN_W * css * dpr);
    canvas.height = Math.round(SCREEN_H * css * dpr);
    scale = canvas.width / SCREEN_W;
    wallKey = ''; // rebuild cached walls at the new resolution
  }

  /** Map a pointer position (client px) to logical screen coordinates. */
  function toLogical(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    return { x: ((clientX - r.left) / r.width) * SCREEN_W, y: ((clientY - r.top) / r.height) * SCREEN_H };
  }

  // ------------------------------------------------------------ walls (cached)

  function buildWalls(maze) {
    const make = (line) => {
      const off = document.createElement('canvas');
      off.width = Math.round(maze.width * TILE * scale);
      off.height = Math.round(maze.height * TILE * scale);
      const g = off.getContext('2d');
      g.setTransform(scale, 0, 0, scale, 0, 0);
      const wall = (c, r) => maze.data.rows[r]?.[c] === '#';
      const outside = (c, r) => r < 0 || r >= maze.height || c < 0 || c >= maze.width;
      g.fillStyle = C.wallFill;
      g.strokeStyle = line;
      g.lineWidth = 1.25;
      g.lineCap = 'round';
      g.beginPath();
      for (let r = 0; r < maze.height; r++) {
        for (let c = 0; c < maze.width; c++) {
          if (!wall(c, r)) continue;
          const x = c * TILE;
          const y = r * TILE;
          g.fillRect(x, y, TILE, TILE);
          const inset = 2;
          // An edge is drawn where this wall meets a corridor (not another wall or the screen edge).
          if (!wall(c, r - 1) && !outside(c, r - 1)) { g.moveTo(x, y + inset); g.lineTo(x + TILE, y + inset); }
          if (!wall(c, r + 1) && !outside(c, r + 1)) { g.moveTo(x, y + TILE - inset); g.lineTo(x + TILE, y + TILE - inset); }
          if (!wall(c - 1, r) && !outside(c - 1, r)) { g.moveTo(x + inset, y); g.lineTo(x + inset, y + TILE); }
          if (!wall(c + 1, r) && !outside(c + 1, r)) { g.moveTo(x + TILE - inset, y); g.lineTo(x + TILE - inset, y + TILE); }
        }
      }
      g.stroke();
      // house door
      g.fillStyle = C.door;
      maze.data.rows.forEach((row, r) => {
        [...row].forEach((ch, c) => {
          if (ch === '-') g.fillRect(c * TILE, r * TILE + 3, TILE, 2);
        });
      });
      return off;
    };
    wallLayers = { normal: make(C.wallLine), flash: make(C.wallFlash) };
  }

  // ------------------------------------------------------------ sprites

  function drawMunch(x, y, dir, open, color = C.munch, shrink = 0) {
    const angle = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[dir] ?? 0;
    const r = 6.5 * (1 - shrink);
    if (r <= 0.2) return;
    const mouth = 0.08 + open * 0.75;
    ctx.save();
    ctx.translate(x, y);
    // sprout on top (keeps Munch distinct from other maze munchers)
    if (shrink === 0) {
      ctx.fillStyle = C.leaf;
      ctx.beginPath();
      ctx.ellipse(1.5, -r - 1, 2.6, 1.3, -0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, mouth, Math.PI * 2 - mouth);
    ctx.closePath();
    ctx.fill();
    // eye
    if (shrink < 0.5) {
      ctx.fillStyle = C.munchDark;
      ctx.beginPath();
      ctx.arc(1, dir === 'left' ? 3 : -3, 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawEyes(x, y, dir) {
    const look = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir] || [0, 0];
    for (const ex of [-2.6, 2.6]) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(x + ex + look[0] * 0.6, y - 1.5 + look[1] * 0.6, 2.1, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1b1464';
      ctx.beginPath();
      ctx.arc(x + ex + look[0] * 1.3, y - 1.5 + look[1] * 1.4, 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawMarker(kind, x, y) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    if (kind === 'square') ctx.rect(x - 1.5, y - 1.5, 3, 3);
    else if (kind === 'triangle') { ctx.moveTo(x, y - 2); ctx.lineTo(x + 2, y + 1.5); ctx.lineTo(x - 2, y + 1.5); }
    else if (kind === 'circle') ctx.arc(x, y, 1.6, 0, Math.PI * 2);
    else { ctx.moveTo(x, y - 2); ctx.lineTo(x + 2, y); ctx.lineTo(x, y + 2); ctx.lineTo(x - 2, y); }
    ctx.closePath();
    ctx.fill();
  }

  function drawChaser(ch, ticks, settings) {
    const { x, y } = ch;
    if (ch.state === 'eaten' || ch.state === 'entering') {
      drawEyes(x, y, ch.dir);
      return;
    }
    const scared = ch.frightened;
    const body = scared ? (ch.flash && !settings.reducedFlash ? C.flash : C.frightened) : ch.color;
    ctx.fillStyle = body;
    // antennae
    ctx.strokeStyle = body;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 3, y - 5); ctx.lineTo(x - 4.5, y - 8);
    ctx.moveTo(x + 3, y - 5); ctx.lineTo(x + 4.5, y - 8);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x - 4.5, y - 8, 1.1, 0, Math.PI * 2);
    ctx.arc(x + 4.5, y - 8, 1.1, 0, Math.PI * 2);
    ctx.fill();
    // rounded square body
    ctx.beginPath();
    ctx.roundRect(x - 6.5, y - 6, 13, 11, [4, 4, 2, 2]);
    ctx.fill();
    // stubby feet that shuffle
    const step = Math.floor(ticks / 8) % 2;
    for (let i = 0; i < 3; i++) {
      const fx = x - 5.5 + i * 4.5 + (step ? 1 : 0);
      ctx.fillRect(fx, y + 5, 2.5, 1.8);
    }
    if (scared) {
      ctx.fillStyle = C.frightenedFace;
      ctx.fillRect(x - 3, y - 3, 1.6, 1.6);
      ctx.fillRect(x + 1.4, y - 3, 1.6, 1.6);
      ctx.fillRect(x - 3.5, y + 1.5, 7, 1);
    } else {
      drawEyes(x, y, ch.dir);
      if (settings.markers) drawMarker(MARKERS[ch.name] || 'circle', x, y + 3);
    }
  }

  function drawCherry(x, y) {
    ctx.strokeStyle = C.leaf;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 2, y + 1); ctx.quadraticCurveTo(x, y - 6, x + 3, y - 5);
    ctx.moveTo(x + 2.5, y + 2); ctx.quadraticCurveTo(x + 2, y - 3, x + 3, y - 5);
    ctx.stroke();
    ctx.fillStyle = C.cherry;
    ctx.beginPath();
    ctx.arc(x - 2, y + 2, 2.6, 0, Math.PI * 2);
    ctx.arc(x + 2.6, y + 3, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }

  function text(str, x, y, { size = 8, color = C.text, align = 'center', weight = 'bold' } = {}) {
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }

  // ------------------------------------------------------------ frame

  function draw(s, { highScores = [], settings = {} } = {}) {
    const { maze } = s;
    if (wallKey !== `${maze.id}@${scale}`) {
      buildWalls(maze);
      wallKey = `${maze.id}@${scale}`;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.imageSmoothingEnabled = false;

    // maze
    const flashOn = s.state === 'cleared' && !settings.reducedFlash && Math.floor(s.clearProgress * 8) % 2 === 1;
    ctx.drawImage(flashOn ? wallLayers.flash : wallLayers.normal, 0, MAZE_TOP, maze.width * TILE, maze.height * TILE);

    ctx.save();
    ctx.translate(0, MAZE_TOP);
    // tunnel ends fade so actors slip out of sight
    const blinkPower = settings.reducedFlash || Math.floor(s.ticks / 15) % 2 === 0;
    for (let r = 0; r < maze.height; r++) {
      for (let c = 0; c < maze.width; c++) {
        const ch = maze.tiles[r][c];
        if (ch === '.') {
          ctx.fillStyle = C.pellet;
          ctx.fillRect(c * TILE + 3, r * TILE + 3, 2, 2);
        } else if (ch === 'o' && (blinkPower || s.state !== 'playing')) {
          ctx.fillStyle = C.pellet;
          ctx.beginPath();
          ctx.arc(c * TILE + 4, r * TILE + 4, 3.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    if (s.bonus) drawCherry(s.bonus.col * TILE + 4, s.bonus.row * TILE + 3);

    const showActors = s.state !== 'title' && s.state !== 'won' && s.state !== 'gameover';
    if (showActors) {
      if (s.state !== 'dying' && s.state !== 'cleared') {
        for (const ch of s.chasers) drawChaser(ch, s.ticks, settings);
      }
      const open = s.player.stopped ? 0.35 : Math.abs(Math.sin(s.player.distance / 3));
      if (s.state === 'dying') {
        drawMunch(s.player.x, s.player.y, s.player.dir, Math.min(1, s.deathProgress * 2), C.munch, Math.max(0, s.deathProgress * 1.4 - 0.4));
      } else {
        drawMunch(s.player.x, s.player.y, s.player.dir, s.state === 'ready' ? 0.35 : open);
      }
      for (const p of s.popups) text(p.text, p.x, p.y - (60 - p.ttl) / 6, { size: 6, color: '#7ce3ff' });
    }
    // hide anything poking out of the tunnel mouths
    ctx.fillStyle = C.bg;
    ctx.fillRect(-TILE, 0, TILE, maze.height * TILE);
    ctx.fillRect(maze.width * TILE, 0, TILE, maze.height * TILE);
    ctx.restore();

    drawHud(s);
    drawOverlay(s, highScores, settings);
  }

  function drawHud(s) {
    text('SCORE', 8, 7, { align: 'left', size: 7, color: C.dim });
    text(String(s.score), 8, 17, { align: 'left' });
    text('HIGH', SCREEN_W / 2, 7, { size: 7, color: C.dim });
    text(String(s.highScore), SCREEN_W / 2, 17);
    if (s.state === 'playing' || s.state === 'ready') {
      // pause button
      ctx.fillStyle = s.paused ? C.accent : C.dim;
      ctx.fillRect(PAUSE_BUTTON.x + 7, 7, 3, 10);
      ctx.fillRect(PAUSE_BUTTON.x + 13, 7, 3, 10);
    }
    // spare lives along the bottom
    const spare = s.state === 'title' ? 0 : Math.max(0, s.lives - 1);
    for (let i = 0; i < Math.min(spare, 6); i++) drawMunch(14 + i * 16, SCREEN_H - 8, 'right', 0.5);
  }

  function drawOverlay(s, highScores, settings) {
    const midRow = MAZE_TOP + 16 * TILE + 4; // the corridor just under the house
    const blink = settings.reducedFlash || Math.floor(s.ticks / 30) % 2 === 0;
    if (s.state === 'title') {
      ctx.fillStyle = 'rgba(11, 8, 32, 0.88)';
      ctx.fillRect(0, MAZE_TOP, SCREEN_W, SCREEN_H - MAZE_TOP);
      text('MAZEMUNCH', SCREEN_W / 2, 52, { size: 18, color: C.munch });
      drawMunch(SCREEN_W / 2, 76, 'right', Math.abs(Math.sin(s.ticks / 6)));
      s.chasers.forEach((ch, i) => {
        const y = 102 + i * 17;
        drawChaser({ ...ch, x: 62, y, dir: 'right', state: 'active', frightened: false }, s.ticks, settings);
        text(ch.name.toUpperCase(), 80, y, { align: 'left', color: ch.color });
      });
      text('HIGH SCORES', SCREEN_W / 2, 180, { size: 7, color: C.dim });
      const top = highScores.slice(0, 5);
      if (top.length === 0) text('---', SCREEN_W / 2, 194, { color: C.dim });
      top.forEach((e, i) => {
        text(`${i + 1}. ${e.name.padEnd(3, ' ')}  ${String(e.score).padStart(6, ' ')}`, SCREEN_W / 2, 194 + i * 11, { size: 7 });
      });
      if (blink) text('PRESS ENTER OR TAP', SCREEN_W / 2, 258, { color: C.accent });
      text('ARROWS/WASD MOVE  P PAUSE', SCREEN_W / 2, 274, { size: 6, color: C.dim });
    } else if (s.state === 'ready') {
      text('READY!', SCREEN_W / 2, midRow, { color: C.accent });
    } else if (s.state === 'won' || s.state === 'gameover') {
      ctx.fillStyle = 'rgba(11, 8, 32, 0.75)';
      ctx.fillRect(0, MAZE_TOP, SCREEN_W, SCREEN_H - MAZE_TOP);
      const won = s.state === 'won';
      text(won ? 'YOU WIN!' : 'GAME OVER', SCREEN_W / 2, 120, { size: 14, color: won ? C.munch : C.danger });
      text(`SCORE ${s.score}`, SCREEN_W / 2, 146);
      if (s.stateTicks > 60 && blink) text('PRESS ENTER OR TAP', SCREEN_W / 2, 180, { color: C.accent });
    }
    if (s.paused) {
      ctx.fillStyle = 'rgba(11, 8, 32, 0.7)';
      ctx.fillRect(0, MAZE_TOP, SCREEN_W, SCREEN_H - MAZE_TOP);
      text('PAUSED', SCREEN_W / 2, midRow - 12, { size: 12, color: C.accent });
      text('P, ESC OR TAP II TO RESUME', SCREEN_W / 2, midRow + 6, { size: 6, color: C.dim });
    }
  }

  function drawError(lines) {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    text('CANNOT START', SCREEN_W / 2, 40, { size: 10, color: C.danger });
    lines.slice(0, 18).forEach((l, i) => text(l.slice(0, 44), 6, 64 + i * 10, { size: 5, align: 'left', weight: 'normal' }));
  }

  resize();
  return { draw, resize, toLogical, drawError };
}
