# Last Stand

**Last Stand** is a browser-based arcade defense game. You play as a ship in the center of the arena, fighting off waves of enemies that spawn from the edges of the screen and chase you down.

Built with React, TypeScript, and HTML Canvas (via Vite).

## Goal

Survive as long as you can. Defend yourself by moving around the arena and shooting enemies before they reach you. Your run ends when you lose all of your health.

## How to Play

### Starting a game

1. Open the game in your browser.
2. On desktop, **click anywhere on the canvas** to start.
3. On mobile mode, tap the **START** button below the game.

When you are defeated, click the canvas (or tap **START** in mobile mode) to play again.

### Desktop controls

| Action | Control |
|--------|---------|
| Move | `WASD` or arrow keys |
| Aim | Mouse cursor |
| Shoot | Left click or `Space` |

Your ship always faces toward your aim direction. A crosshair shows where you are aiming.

### Mobile controls

Open **Settings** (the gear icon in the header) and turn on **Mobile play**. Touch controls appear below the canvas:

| Control | Buttons |
|---------|---------|
| Move | D-pad (↑ ↓ ← →) |
| Aim | D-pad (↑ ↓ ← →) |
| Shoot | **FIRE** button |
| Start / restart | **START** button |

Hold the movement and aim buttons to move and rotate. Hold **FIRE** to shoot continuously.

## Game Mechanics

### Health

You start with **5 hearts**. You lose 1 heart when an enemy touches you. After taking damage, you get a short period of invincibility before you can be hit again.

### Shooting

Bullets fire toward your aim direction. There is a brief cooldown between shots, so timing and positioning matter.

### Enemies

Enemies spawn from a random edge of the screen (top, bottom, left, or right) and move directly toward you.

- They appear in increasing numbers as waves progress.
- Enemies in later waves move faster and have more health (tougher enemies show their HP as a number on the orb).
- If an enemy reaches you, it deals damage on contact.

### Score

- **+10 points** for each enemy destroyed.
- Your current score is shown below the game and in the in-game HUD.

### Waves

- The game starts at **Wave 1**.
- Every **8 kills**, the wave number increases.
- Higher waves mean:
  - Enemies spawn more frequently
  - More enemies spawn per wave
  - Enemies move faster
  - Enemies have more health

The wave number is displayed in the HUD and in the stats bar below the game.

## Settings

Click the **⚙** button in the header to open settings.

- **Mobile play** — toggles on-screen touch controls for move, aim, and fire. Desktop keyboard and mouse input are disabled while mobile mode is on.

## Running Locally

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open the URL shown in the terminal (usually `http://localhost:5173`).

### Production build

```bash
npm run build
npm run preview
```

## Deploy to Railway

This project is configured for [Railway](https://railway.com) with **Caddy** serving the Vite production build.

### Quick deploy

1. Push this repo to GitHub (or connect your existing repo).
2. In Railway, click **New Project → Deploy from GitHub repo**.
3. Select this repository — Railway will detect the config automatically.
4. Railway runs `npm run build`, then starts Caddy to serve the `dist/` folder on `$PORT`.
5. Open the generated public URL to play the game.

### What’s included for Railway

| File | Purpose |
|------|---------|
| `railway.toml` | Build command, start command, and health check |
| `nixpacks.toml` | Installs Node 20 + Caddy, runs the production build |
| `Caddyfile` | Serves `dist/` with gzip and SPA fallback routing |
| `.node-version` | Pins Node 20 for consistent builds |

### Local production test (without Caddy)

```bash
npm run build
npm run preview
```

### Environment variables

No environment variables are required for a basic deploy. Railway sets `PORT` automatically.

If you add client-side env vars later, prefix them with `VITE_` (for example `VITE_API_URL`) and redeploy after changing them.

## Project Structure

```
src/
  App.tsx          # App entry — renders the game
  DefenseGame.tsx  # Game logic, canvas rendering, and controls
  main.tsx         # React mount point
  styles.css       # UI styling (header, settings, mobile controls)
index.html         # HTML shell
```

The game loop, physics, collision detection, enemy spawning, and drawing all live in `DefenseGame.tsx`. React handles UI state (score, health, wave, settings, mobile mode) around the canvas.
