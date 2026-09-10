/**
 * AdMob ad unit configuration — the single place that names which ad unit ID
 * each format uses.
 *
 * These are Google's official sample ad unit IDs — they always serve a clearly
 * labeled "Test Ad" and are safe to ship during development (real ad unit IDs
 * used with unapproved apps/test devices can get an AdMob account flagged for
 * invalid traffic). See https://developers.google.com/admob/android/test-ads
 *
 * Going live later is a one-line-per-format swap here: create real ad units in
 * the AdMob console for this app's real AdMob App ID (see
 * android/app/src/main/res/values/strings.xml → admob_app_id, kept in sync by
 * scripts/setup-admob-android.js) and paste their IDs in below. Nothing else in
 * the app needs to change.
 */
export const AD_UNIT_IDS = {
  banner: 'ca-app-pub-3940256099942544/6300978111',
  interstitial: 'ca-app-pub-3940256099942544/1033173712',
  rewarded: 'ca-app-pub-3940256099942544/5224354917'
} as const;

/** Show interstitials at most once every N completed rounds (policy-safe frequency capping). */
export const INTERSTITIAL_EVERY_N_ROUNDS = 2;

/** Give up waiting for an interstitial to load/show after this long, so it never blocks navigation. */
export const INTERSTITIAL_TIMEOUT_MS = 4000;
