# Snake

A Google Snake-style browser game with game modes and a high-score leaderboard. Eat apples, grow long, and don't bite yourself — or the wall.

Built with plain HTML, CSS, and JavaScript on a 2D canvas. No frameworks, no build step, no dependencies.

![Gameplay](docs/screenshot.png)

## Play

Open `index.html` in any browser, or serve the folder:

```bash
# Python
python3 -m http.server 8080

# or Node
npx serve .
```

Then visit `http://localhost:8080`.

## Game modes

| Mode | Description |
| --- | --- |
| **Classic** | The original. Solid walls, one apple at a time. |
| **Wrap** | No walls — slide off one edge and pop out the other. |
| **Maze** | Stone blocks block your path. Plan ahead. |
| **Blitz** | Starts fast and only gets faster. How long can you last? |
| **Feast** | Four apples on the board at once. Grow fast, think faster. |

Pick a mode on the title screen, then hit Play.

## Features

- Five game modes (see above)
- Top-5 high-score leaderboard with name entry — your best runs are saved between visits (localStorage when available, session-only in sandboxed frames)
- Classic 17 x 15 checkerboard board, blue snake, red apples — the Google Snake look
- Snake speeds up as it grows
- Score + best score tracking
- Pause / resume
- Death flash animation and particle bursts when eating
- Tongue flicks out when an apple is nearby
- Procedural sound effects (Web Audio, no audio files) with a mute toggle
- Keyboard and touch controls (swipe to steer on mobile)
- Responsive layout down to phone-sized screens

## Controls

| Action | Keys |
| --- | --- |
| Move | Arrow keys or WASD |
| Pause / resume | Space |
| Start / restart | Space, Enter, or any direction key |
| Mute | M |
| Save score | Enter |
| Mobile | Swipe anywhere on the board |

## How it works

- `game.js` runs a fixed-timestep game loop (60 updates/sec) with a cell-based snake: each step the head moves one cell, collisions are checked against walls, maze stones, and the body, and eating an apple grows the snake and speeds up the step interval. Mode configs (`MODES`) drive the differences: edge wrapping, the maze layout, apple count, and speed curve.
- The leaderboard keeps the top 5 runs (name, score, mode, date) and asks for a name after any qualifying run. It persists through localStorage when the browser allows it, with an in-memory fallback.
- Rendering is pure Canvas 2D: the checkerboard, maze stones, apples (with stem, leaf, and shine), the snake (rounded segments with eyes that face the direction of travel), and particles.
- Sound is generated with the Web Audio API — short oscillator blips for eating, starting, and game over. No asset files needed.

## Project structure

```
snake-game/
├── index.html   # page, HUD, mode selector, overlays, leaderboard
├── style.css    # design tokens and layout
├── game.js      # game logic, modes, leaderboard, rendering, audio, input
└── output/      # QA screenshots from automated testing
```

## Browser support

Any modern browser (Chrome, Firefox, Safari, Edge) on desktop or mobile. No installation, no dependencies.

---

Made by Maurice. Inspired by Google Snake.
