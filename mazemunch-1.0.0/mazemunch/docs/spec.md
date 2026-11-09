# Mazemunch: Specification

## 1. Overview

Mazemunch is a single-player maze-chase arcade game that runs in a web browser.
The player steers **Munch** around a maze, eating every pellet while four
chasers (ghosts) hunt them. Eating a power pellet briefly turns the tables so
Munch can eat the chasers.

The game is written in plain JavaScript (ES modules) and draws to a single
HTML `<canvas>`. It has no runtime dependencies, no image files and no
database. A small Node.js server delivers the files to the browser.

## 2. Goals

- Playable in any current desktop or mobile browser by opening one web address.
- Smooth, consistent gameplay at 60 updates per second on any display.
- Gameplay tuning (speeds, points, lives, timers) and the maze layout can be
  changed by editing JSON files, without touching code.
- Works with a keyboard, a touchscreen or a gamepad.

### Out of scope (this version)

- Sound and music
- More than one maze or level
- Online leaderboards or user accounts
- Remappable keys

## 3. Running the game

| Requirement | Detail |
|---|---|
| Server | Node.js 22 or newer. Run `npm start` from the project folder. |
| Address | `http://localhost:8080` |
| Browser | Any current Chrome, Firefox, Safari or Edge. JavaScript must be enabled. |
| Install step | None. The project has no packages to install. |

Adding `?seed=<number>` to the address (e.g. `?seed=123`) makes the chasers'
random choices repeat exactly, which is useful for testing and demos.

## 4. Controls

| Action | Keyboard | Touch / mouse | Gamepad |
|---|---|---|---|
| Move | Arrow keys or W A S D | Swipe in a direction | D-pad / left stick |
| Start | Enter or Space | Tap the screen | A button |
| Pause / resume | P or Esc | Tap the pause icon (top right) | Start button |

- A pressed direction is remembered for about 8 ticks (~0.13 s), so a turn
  can be pressed slightly before reaching a corner.
- Switching to another browser tab pauses the game automatically.

## 5. Game flow

```
TITLE ──start──► READY ──2 s──► PLAYING
                   ▲               │
                   │      touched by a chaser
                   │               ▼
                   └──lives left── DYING ──no lives──► GAME OVER ──► TITLE
                                                        
PLAYING ──all pellets eaten──► CLEARED ──2 s──► WON ──► TITLE
```

| State | What happens |
|---|---|
| Title | Shows the maze, the chasers and the high-score table. Waits for Start. |
| Ready | Short "Ready" pause (2 s) before play begins or resumes. |
| Playing | Normal gameplay. |
| Dying | Munch's death animation (1.5 s). One life is lost. |
| Cleared | Maze walls flash (2 s) after the last pellet is eaten. |
| Won / Game over | End screen. If the score makes the top 10, the player is asked for initials. |

## 6. Gameplay rules

All numbers below come from `data/level.json` and can be changed there.

### 6.1 The maze

- The maze is a 28 × 31 grid of 8-pixel tiles.
- Tile types: wall, pellet, power pellet, empty corridor, ghost-house door,
  and tunnel.
- Tunnels on the left and right edges wrap around to the other side.
- Every character's speed is reduced inside a tunnel.

### 6.2 Munch (the player)

- Moves continuously in the current direction until blocked by a wall.
- Can reverse direction at any time.
- Can "pre-turn" around a corner when within 4 pixels of the tile centre.
- Pauses for 1 tick after eating a pellet and 3 ticks after a power pellet.
- Starts with **3 lives**. Gains **one extra life at 10,000 points** (once).

### 6.3 Chasers (ghosts)

There are four chasers. Each one has a name, a color and an **aggression**
value between 0 and 1.

| Name | Color | Aggression | Starts |
|---|---|---|---|
| Rook | Red | 0.85 | Outside the house |
| Vex | Pink | 0.70 | In the house |
| Gale | Cyan | 0.55 | In the house |
| Moss | Orange | 0.40 | In the house |

- **Release:** a chaser leaves the ghost house every 4 seconds, in order.
- **Chasing:** at every intersection a chaser rolls a random number. If it is
  below the chaser's aggression, it takes the exit that brings it closest to
  Munch (straight-line distance). Otherwise it picks a random exit. Chasers
  never reverse direction on their own.
- **Ties:** when two exits are equally close, the order up, left, down, right
  decides.

### 6.4 Power pellets and frightened mode

- Eating a power pellet frightens every chaser that is out of the house for
  **6 seconds**.
- Frightened chasers turn blue, reverse direction once, slow down, and move
  randomly.
- For the last **2 seconds** of the frightened time they flash white as a
  warning.
- Touching a frightened chaser eats it. Its eyes travel back to the ghost
  house by the shortest path, then it comes back out as a normal chaser.
- Touching a chaser that is **not** frightened costs Munch a life.

### 6.5 Speeds

Speeds are fractions of a base speed of 75.75 pixels per second.

| Who | Fraction |
|---|---|
| Munch | 0.80 |
| Chaser | 0.75 |
| Frightened chaser | 0.50 |
| Eaten chaser (eyes) | 1.50 |
| Anyone in a tunnel (maximum) | 0.40 |

### 6.6 Scoring

| Item | Points |
|---|---|
| Pellet | 10 |
| Power pellet | 50 |
| Chasers eaten during one power pellet | 200, 400, 800, 1600 (doubles each time) |
| Cherry bonus | 100 |

- The cherry appears below the ghost house after **70** and after **170**
  items are eaten, and disappears after **9.5 seconds** if not collected.
- Points earned float briefly on screen where they were scored.

### 6.7 Winning and losing

- **Win:** eat every pellet and power pellet in the maze.
- **Lose:** run out of lives.

## 7. High scores and settings

- The top **10** scores are saved in the browser (`localStorage`). Each entry
  has 3-character initials (letters and digits), the score and the date.
- If the browser blocks storage (e.g. some private windows), the game still
  runs; scores just aren't saved.
- The settings menu (gear button) offers:
  - **Reduce flashing:** frightened chasers don't flash white.
  - **Shape markers on chasers:** a square, triangle, circle or diamond on
    each chaser so they can be told apart without relying on color.
  - **Game speed:** 100%, 85% or 70%.

## 8. Data files

| File | Contents |
|---|---|
| `data/maze.json` | Maze size, rows of tile characters, and spawn points (player start, chaser start, house slots, door, bonus). |
| `data/level.json` | All tuning values listed in section 6. |
| `data/schema/*.schema.json` | Rules describing valid versions of the two files above. |

### Maze characters

| Character | Meaning |
|---|---|
| `#` | Wall |
| `.` | Pellet |
| `o` | Power pellet |
| `-` | Ghost-house door |
| `T` | Tunnel |
| (space) | Empty corridor |

### Data validation

When the game starts, it checks both data files. If anything is wrong, it
shows the list of errors on screen instead of starting. The maze is rejected if:

- A row has the wrong length, or contains an unknown character.
- The outer border has a gap that isn't a matching pair of tunnels.
- There is no ghost-house door.
- A spawn point is on a wall, or a house slot isn't inside the house.
- Any corridor tile can't be reached, or is a dead end.
- There are no pellets.

## 9. Non-functional requirements

| Area | Requirement |
|---|---|
| Timing | The game advances in fixed 1/60-second steps, independent of the monitor's refresh rate. |
| Display | Logical screen of 224 × 288 pixels, scaled to fit the window and drawn sharply on high-resolution screens. |
| Assets | All graphics are drawn in code. No image or audio files. |
| Accessibility | Settings for reduced flashing, shape markers and slower speed. The canvas has a text description for screen readers. |
| Robustness | Missing or invalid data shows a clear error on screen. Blocked storage never stops the game. |
