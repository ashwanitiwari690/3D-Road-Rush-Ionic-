# Escape the Monster v2.0

## Changes

- Increased progression from 10 to 30 levels.
- Added 20 lightweight SVG backgrounds for levels 11–30.
- Monster speed now increases gradually by level and has a playable cap of 110.
- Added wall/boundary damage: touching the playable world edge costs one life.
- Boundary and monster damage use an 850 ms protection window to prevent repeated life loss from a single collision.
- Batched coin updates so collecting multiple coins causes one signal update and one localStorage write per frame.
- Game-world player and monster positions are updated directly in the DOM during the animation loop to reduce Angular change-detection work.
- Added `contain: layout paint` and movement hints for the game world.
- Removed the unused IonicModule import from the root component to reduce the application JavaScript bundle.
- Existing persistent wallet, level reset, rewarded video, settings, shop, result page, joystick and Android/Capacitor functionality are preserved.


## v2.2 gameplay stability and speed improvements

- Monster speed progression was increased substantially across all 30 levels: Level 1 starts at 86, then rises by 5.2 per level, with a small in-run acceleration and a hard cap of 250.
- Added a game-session token so stale `requestAnimationFrame` callbacks from a previous run cannot update a newly started game.
- PLAY AGAIN now invalidates the previous loop before starting a fresh timer/animation session, preventing the intermittent stuck/frozen restart state.
- Coin persistence is debounced by 180 ms during active gameplay to reduce synchronous LocalStorage work while preserving final persistence at run completion/page lifecycle events.
- Updated app version to 2.2.0.
