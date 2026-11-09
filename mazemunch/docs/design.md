# Mazemunch: Design Document

This document explains how Mazemunch is built: how the code is organized,
what each file does, and how the pieces work together. For *what* the game
does, see [spec.md](spec.md).

## 1. Architecture at a glance

```
┌──────────────────────────── Browser ─────────────────────────────┐
│                                                                  │
│  index.html + style.css                                          │
│        │                                                         │
│        ▼                                                         │
│  src/main.js  ── loads + validates ──►  data/*.json              │
│        │                                                         │
│        ├──► src/core/   (game rules, no browser code)            │
│        │       Game.tick(intent)   Game.snapshot()               │
│        │            ▲                     │                      │
│        │            │ intent              │ plain data           │
│        └──► src/shell/ (browser side)     ▼                      │
│               input.js ──► loop.js ──► render.js ──► <canvas>    │
│               storage.js (localStorage)   ui.js (HTML pop-ups)   │
└──────────────────────────────────────────────────────────────────┘
                         ▲
                         │ HTTP (static files only)
┌────────────────────────┴─────────────────────────────────────────┐
│  Node.js: tools/dev-server.js  (port 8080)                       │
└──────────────────────────────────────────────────────────────────┘
```

### Key design decisions

1. **Core and shell are separate.** `src/core/` holds the game rules and never
   touches the screen, keyboard, clock or storage. `src/shell/` holds all the
   browser-specific code. This keeps the rules easy to reason about and lets
   them run in Node without a browser.
2. **One way in, one way out.** The core is changed only through
   `Game.tick(intent)` and read only through `Game.snapshot()`. The renderer
   draws from the snapshot and never changes game state.
3. **Fixed time step.** The game always advances in exact 1/60-second ticks,
   so it plays the same on a 60 Hz laptop and a 144 Hz monitor.
4. **Seeded randomness.** Every random choice goes through one seeded random
   number generator, so the same seed and inputs always produce the same game.
5. **Data-driven.** The maze and all tuning values live in JSON files, checked
   against schemas when the game starts.
6. **Graphics drawn in code.** Every character and wall is drawn with canvas
   shapes, so there are no image files (see section 5).

## 2. Folder structure

```
mazemunch/
├── index.html, style.css, favicon.svg   the web page
├── package.json, README.md              project info and run command
├── docs/                                spec.md and design.md (this file)
├── src/
│   ├── main.js                          startup and wiring
│   ├── core/                            game rules (no browser code)
│   └── shell/                           browser side
├── data/
│   ├── maze.json, level.json            game content
│   └── schema/                          rules for valid data files
└── tools/                               Node.js server
```

## 3. File reference

### 3.1 Root: the page

| File | Purpose |
|---|---|
| `index.html` | The one web page. Contains the `<canvas>` the game is drawn on, a `<div id="ui">` for pop-up menus, and a loading bar. Loads `style.css` and `src/main.js`. |
| `style.css` | Dark background, centers the canvas, and styles the loading bar and pop-ups. |
| `favicon.svg` | Browser tab icon. |
| `package.json` | Project info and the `npm start` command. |

### 3.2 `src/main.js`: startup

1. Downloads `maze.json`, `level.json` and both schemas, filling the loading
   bar as each file arrives.
2. Validates the data. If there are errors, draws them on the canvas and stops.
3. Loads saved settings and high scores.
4. Creates the `Game`, renderer, input handler, game loop and pop-up UI, and
   connects them.
5. Listens for game events (e.g. "game ended") to ask for high-score initials.
6. Starts the loop.

### 3.3 `src/core/`: game rules

| File | Purpose |
|---|---|
| `game.js` | The `Game` class: the main state machine (title → ready → playing → dying / cleared → won / game over). `tick()` advances one step; `snapshot()` returns plain data for drawing; `drainEvents()` hands events to the shell. |
| `maze.js` | The `Maze` class: builds the tile grid from `maze.json`, answers wall and exit queries, tracks eaten pellets, builds the distance map used to send eaten chasers home, and validates maze files. |
| `actor.js` | The `Actor` base class shared by Munch and the chasers: pixel position, direction, tunnel wrap-around, and `advance()`, which moves the actor and stops at each tile centre to call `onCenter()`. |
| `player.js` | The `Player` class (Munch), extends `Actor`. Input buffering, reversing, corner pre-turns, and eating pauses. |
| `chaser.js` | The `Chaser` class, extends `Actor`. States: in house, leaving, active, eaten (eyes), entering. Handles bobbing in the house, walking out the door, frightened mode and being eaten. |
| `chase.js` | Chaser decision rules. `chooseExit()` picks a direction at an intersection based on aggression; `stepHome()` steers eaten eyes back to the house. |
| `rules.js` | Converts `level.json` into game units (seconds → ticks, speed fractions → pixels per tick) and calculates chaser points. |
| `rng.js` | Seeded random number generator (mulberry32). |
| `dirs.js` | Shared constants: the four directions, tile size (8 px), and tile ↔ pixel conversions. |
| `schema.js` | A small JSON Schema checker used to validate the data files. |

### 3.4 `src/shell/`: browser side

| File | Purpose |
|---|---|
| `render.js` | Draws the snapshot on the canvas: walls, pellets, Munch, chasers, cherry, score bar, overlays and error screens. Scales the canvas to fit the window. |
| `input.js` | Turns keyboard, swipe/mouse and gamepad input into one simple command per tick: `{ dir, start, pause }`. |
| `loop.js` | The game loop. Uses `requestAnimationFrame` and runs as many fixed 1/60 s ticks as needed, then draws once per frame. Pauses when the tab is hidden. Applies the game-speed setting. |
| `storage.js` | Saves and loads the top-10 high scores and settings in `localStorage`. Every access is wrapped so blocked storage can't crash the game. |
| `ui.js` | HTML pop-ups over the canvas: the settings menu (gear button) and the high-score initials box. Built with `createElement`, not `innerHTML`. |

### 3.5 `data/`: game content

| File | Purpose |
|---|---|
| `maze.json` | Maze size, one text string per row, and spawn points. |
| `level.json` | Speeds, timers, points, lives, cherry bonus, and each chaser's name, color and aggression. |
| `schema/maze.schema.json`, `schema/level.schema.json` | JSON Schemas describing valid data files. |

### 3.6 `tools/`: the server

| File | Purpose |
|---|---|
| `dev-server.js` | A Node.js HTTP server on port 8080. Sends the project files to the browser, blocks requests outside the project folder, and reloads open tabs when a file in `src/`, `data/`, `index.html` or `style.css` changes. There is no database or API. |
| `mime.js` | Maps file extensions to content types. Browsers refuse to run JavaScript modules sent with the wrong type. |

## 4. How a frame works

Each time the browser is ready to draw (usually 60 times a second):

```
loop.js frame()
  │
  ├─ while enough time has built up for another 1/60 s step:
  │     intent = input.consume()          { dir, start, pause }
  │     game.tick(intent)
  │        ├─ Munch moves and eats
  │        ├─ cherry bonus appears / is collected / expires
  │        ├─ if no pellets left → CLEARED
  │        ├─ release next chaser from the house (every 4 s)
  │        ├─ chasers move
  │        ├─ collisions: eat a frightened chaser, or lose a life
  │        └─ count down frightened time
  │
  └─ main.js onFrame()
        ├─ handle events (e.g. ask for initials when the game ends)
        └─ renderer.draw(game.snapshot())
```

### Movement

`Actor.advance()` moves a character pixel by pixel but always stops exactly on
each tile centre it passes and calls `onCenter()`. That is where decisions are
made:

- **Munch** (`player.js`): turn if a buffered direction is open, otherwise
  stop at a wall.
- **Chasers** (`chaser.js`): call `chooseExit()` to pick the next direction,
  or `stepHome()` when they are eaten eyes.

Stopping at tile centres keeps every character lined up with the grid, so wall
checks stay simple.

### Collisions

Munch and a chaser touch when their centres are less than 6 pixels apart.
Only chasers in the **active** state can collide.

## 5. Graphics: drawing without image files

The game has no sprite images. Everything is drawn with the canvas 2D API
(`fillRect`, `arc`, `roundRect`, `ellipse`, `lineTo`, …) inside `render.js`,
from scratch, every frame.

### Chasers (`drawChaser()`)

1. **Color:** the chaser's color from `level.json`, blue when frightened, or
   flashing white near the end of frightened time.
2. **Antennae:** two short lines from the head, each ending in a small circle.
3. **Body:** a 13 × 11 rounded rectangle, rounder at the top.
4. **Feet:** three small rectangles that shift 1 pixel every 8 ticks, so the
   chaser looks like it's walking.
5. **Face:**
   - Normal: `drawEyes()` draws two white ovals with pupils that point in the
     direction of travel.
   - Frightened: two small square eyes and a flat mouth.
   - Eaten: only the eyes are drawn, floating back to the house.
6. **Shape marker** (optional setting): a square, triangle, circle or diamond
   on the body.

### Munch (`drawMunch()`)

A circle with a wedge cut out for the mouth. The wedge size depends on how far
Munch has moved, which makes the mouth chomp. The shape is rotated to face the
direction of travel, and a small green leaf sits on top.

### Walls (`buildWalls()`)

Walls are drawn once onto a hidden canvas and copied to the screen each frame,
which is faster than redrawing them. Outlines are drawn only where a wall
meets a corridor. A second, white copy is used for the flashing effect when
the maze is cleared.

### Why draw in code?

- **Faster loading:** no image files to download.
- **Sharp at any size:** shapes are redrawn at the screen's real resolution,
  so they never look blurry when scaled.
- **Easy to change:** a new chaser color is one line in `level.json`.
- **Simple animation:** walking feet, chomping, looking around and flashing
  are just values that change over time.

### Screen scaling

The game uses a fixed logical screen of 224 × 288 pixels (28 × 36 tiles):
a 24 px score bar, the 248 px maze, and a 16 px lives row. `resize()` scales
this to fit the window, using whole-number scaling when possible, and accounts
for high-resolution displays.

## 6. Data flow between core and shell

| Direction | What passes | Example |
|---|---|---|
| Shell → core | `intent` object each tick | `{ dir: 'left', start: false, pause: false }` |
| Core → shell | `snapshot()` each frame | positions, states, score, lives, maze |
| Core → shell | events via `drainEvents()` | `{ type: 'ended', result: 'gameover', score: 4210 }` |
| Shell → core | `game.setPaused()`, `game.locked` | pause when a menu opens; hold the end screen while initials are typed |

The renderer only reads plain data, so it can never accidentally change the
game.

## 7. Error handling

| Situation | Behavior |
|---|---|
| A data file can't be downloaded | "Could not load game data" and the reason are drawn on the canvas. |
| A data file is invalid | Every schema and maze error is listed on the canvas and in the browser console. |
| `localStorage` is blocked | Reads fall back to defaults and writes are skipped; the game keeps running. |
| The tab is hidden | The game pauses automatically. |
| A long gap between frames (e.g. after switching tabs) | Capped at 250 ms, so the game doesn't fast-forward. |
| A request outside the project folder | The server answers 403 Forbidden. |

## 8. Extending the game

| Change | Where |
|---|---|
| Speeds, points, lives, timers | `data/level.json` |
| Add or recolor a chaser | `chasers` list in `data/level.json` (the maze needs a house slot for each chaser that starts inside) |
| New maze layout | `data/maze.json` (validated on start-up) |
| New chaser behavior | `chooseExit()` in `src/core/chase.js` |
| New look for a character | `drawChaser()` / `drawMunch()` in `src/shell/render.js` |
| New control | `src/shell/input.js` |
