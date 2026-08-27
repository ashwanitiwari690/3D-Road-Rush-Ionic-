/**
 * Single source of truth for this game's identity on the centralized
 * Earnivo Game Reward API. Do not hardcode the game code, the API base
 * URL, or any coin/rupee conversion numbers anywhere else — import them
 * from here. Conversion rate and minimum-coin thresholds are NOT defined
 * here on purpose: they come only from GET /api/games at runtime so an
 * Admin can change them without a new app build.
 */
export const REWARD_CONFIG = {
  gameCode: 'ROAD_RUSH',
  /**
   * Base URL of the centralized Earnivo backend's public API (mounts
   * /api/games and /api/game-rewards). Points at the local dev server —
   * swap to the deployed Main Platform URL for staging/production builds.
   */
  apiBaseUrl: 'http://localhost:4227/api'
} as const;
