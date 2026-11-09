# Mazemunch

A maze-chase arcade game that runs in the browser. Plain JavaScript
(ES modules) and one `<canvas>`, no dependencies.

## Run it

Requires **Node 22+** and a current browser. Nothing to install.

```sh
cd mazemunch
npm start          # http://localhost:8080
```

Controls: arrow keys or WASD to move, P or Esc to pause, Enter or Space to start.
On a phone: tap to start, swipe to steer. Add `?seed=123` to the URL to replay
the same chaser behaviour.

## Layout

```
index.html, style.css, favicon.svg   the page (frontend)
src/main.js    boot: load + validate data, wire core to shell
src/core/      game simulation: maze, player, chasers, rules, seeded RNG
src/shell/     browser side: game loop, input, canvas renderer, localStorage, overlays
data/          maze.json, level.json and their JSON schemas (loaded at startup)
docs/          spec.md (what the game does) and design.md (how it is built)
tools/         dev-server.js (Node HTTP server that serves the game) and mime.js
```

## Changing the game

- **Tuning** (speeds, frightened time, points, lives) is in `data/level.json`.
- **The maze** is `data/maze.json`: one string per row (`#` wall, `.` pellet,
  `o` power pellet, `-` house door, `T` tunnel, space = empty corridor).
