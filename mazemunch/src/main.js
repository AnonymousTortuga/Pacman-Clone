// Boot: load and validate data, wire the core to the browser shell, start the loop.

import { Game } from './core/game.js';
import { Maze } from './core/maze.js';
import { validateSchema } from './core/schema.js';
import { createRenderer, PAUSE_BUTTON } from './shell/render.js';
import { createInput } from './shell/input.js';
import { createLoop } from './shell/loop.js';
import { createUI } from './shell/ui.js';
import * as storage from './shell/storage.js';

/* global __MAZE_URL__, __LEVEL_URL__, __MAZE_SCHEMA_URL__, __LEVEL_SCHEMA_URL__ */
// The release build replaces these with fingerprinted paths; in development they fall back.
const URLS = {
  maze: typeof __MAZE_URL__ !== 'undefined' ? __MAZE_URL__ : 'data/maze.json',
  level: typeof __LEVEL_URL__ !== 'undefined' ? __LEVEL_URL__ : 'data/level.json',
  mazeSchema: typeof __MAZE_SCHEMA_URL__ !== 'undefined' ? __MAZE_SCHEMA_URL__ : 'data/schema/maze.schema.json',
  levelSchema: typeof __LEVEL_SCHEMA_URL__ !== 'undefined' ? __LEVEL_SCHEMA_URL__ : 'data/schema/level.schema.json',
};

const bootEl = document.getElementById('boot');
const barEl = document.getElementById('boot-bar');

async function loadAll() {
  const entries = Object.entries(URLS);
  let done = 0;
  const results = await Promise.all(
    entries.map(async ([key, url]) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
      const json = await res.json();
      done++;
      if (barEl) barEl.style.width = `${Math.round((done / entries.length) * 100)}%`;
      return [key, json];
    }),
  );
  return Object.fromEntries(results);
}

function seedFromUrl() {
  const s = new URLSearchParams(location.search).get('seed');
  if (s !== null && /^\d+$/.test(s)) return Number(s) >>> 0;
  return (Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0;
}

async function boot() {
  const canvas = document.getElementById('game');
  const renderer = createRenderer(canvas);
  window.addEventListener('resize', () => renderer.resize());

  let data;
  try {
    data = await loadAll();
  } catch (err) {
    bootEl?.remove();
    renderer.drawError(['Could not load game data.', String(err.message || err)]);
    return;
  }
  const errors = [
    ...validateSchema(data.maze, data.mazeSchema).map((e) => `maze ${e}`),
    ...Maze.validate(data.maze).map((e) => `maze ${e}`),
    ...validateSchema(data.level, data.levelSchema).map((e) => `level ${e}`),
  ];
  if (errors.length) {
    bootEl?.remove();
    renderer.drawError(errors);
    console.error('Mazemunch data errors:', errors);
    return;
  }

  let settings = storage.loadSettings();
  let highScores = storage.loadScores();
  const game = new Game({
    mazeData: data.maze,
    level: data.level,
    seed: seedFromUrl(),
    highScore: highScores[0]?.score || 0,
  });

  const input = createInput({
    canvas,
    isPauseArea(clientX, clientY) {
      const p = renderer.toLogical(clientX, clientY);
      return p.x >= PAUSE_BUTTON.x && p.y <= PAUSE_BUTTON.h;
    },
  });

  const loop = createLoop({
    game,
    input,
    onFrame() {
      for (const e of game.drainEvents()) handleEvent(e);
      renderer.draw(game.snapshot(), { highScores, settings });
    },
  });
  loop.setSpeed(settings.speed);

  const ui = createUI(document.getElementById('ui'), {
    settings,
    onSettingsChange(next) {
      settings = next;
      storage.saveSettings(settings);
      loop.setSpeed(settings.speed);
    },
    onOpenChange(open) {
      input.setEnabled(!open);
      if (open) game.setPaused(true);
    },
  });

  function handleEvent(e) {
    // A new round starts with no leftover swipe steering Munch.
    if (e.type === 'state' && e.state === 'ready') input.clearSwipe();
    if (e.type === 'ended' && storage.qualifies(e.score)) {
      game.locked = true;
      ui.promptInitials(e.score).then((name) => {
        highScores = storage.addScore(name, e.score);
        game.locked = false;
      });
    }
  }

  // Read-only handle for end-to-end tests and debugging in the console.
  window.__mazemunch = { game, version: '1.0.0' };

  bootEl?.remove();
  loop.start();
}

boot();
