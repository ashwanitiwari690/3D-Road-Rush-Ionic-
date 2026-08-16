# Escape the Monster v2.3 — Pause/Resume and Build-Budget Fix

## Pause / Resume

The HUD button now toggles the same active game between pause (`Ⅱ`) and resume (`▶`). Pausing keeps the current level, timer, player position, monster position, coins, lives and map intact. The animation frame and one-second timer are stopped while paused, and resume creates a fresh guarded session so stale callbacks cannot freeze or corrupt the new loop.

A lightweight pause overlay is rendered inside the game world while the HUD button remains available.

## Performance safety

- Session IDs guard every animation-frame/timer callback.
- Pause clears the active RAF and interval.
- Resume creates exactly one RAF and one interval.
- Joystick state is reset during pause.
- Music is stopped during pause and restarted on resume when enabled.

## Angular component-style warning

The previous `src/app/app.component.scss` was about 43 KB and exceeded Angular's 20 KB `anyComponentStyle` warning budget. The shared styles have been moved to `src/styles.css`, while `app.component.scss` is now only 26 bytes. This removes the component-style budget warning without changing the visual styles.

## Build validation

A production build was attempted with:

```bash
npm run build
```

The source tree did not contain a usable Angular CLI executable (`ng` was missing from `node_modules/.bin`), so the build could not be completed in this execution environment. The project files were structurally checked after the changes and the ZIP excludes `node_modules`.

On a development machine run:

```bash
npm ci
npm run build
npx cap sync android
```
