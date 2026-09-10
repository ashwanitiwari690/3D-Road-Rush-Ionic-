import { Injectable } from '@angular/core';
import { Capacitor, PluginListenerHandle } from '@capacitor/core';
import {
  AdMob,
  BannerAdOptions,
  BannerAdPluginEvents,
  BannerAdPosition,
  BannerAdSize,
  RewardAdPluginEvents
} from '@capacitor-community/admob';
import { AD_UNIT_IDS, INTERSTITIAL_EVERY_N_ROUNDS, INTERSTITIAL_TIMEOUT_MS } from '../config/admob.config';

/**
 * Thin wrapper around @capacitor-community/admob — the only file in the app that talks
 * to the plugin directly. Every page/service goes through this so ad-unit IDs, test-mode
 * config and reward-safety rules live in exactly one place.
 *
 * Ads only run on native platforms — the plugin's web implementation is a stub, so callers
 * must never grant a reward from anything but `showRewarded()` resolving `true`, and every
 * public method here is a no-op on the web (gated by `isSupported`).
 */
@Injectable({ providedIn: 'root' })
export class AdmobService {
  readonly isSupported = Capacitor.isNativePlatform();

  private initPromise?: Promise<void>;
  private bannerVisible = false;

  private interstitialReady = false;
  private interstitialLoading = false;
  private roundsSinceInterstitial = 0;

  private rewardedReady = false;
  private rewardedLoading = false;
  /** True for the whole lifetime of one showRewarded() call — blocks a second concurrent request for the same ad. */
  private rewardedShowing = false;

  initialize(): Promise<void> {
    if (!this.isSupported) return Promise.resolve();
    if (!this.initPromise) {
      this.initPromise = AdMob.initialize({ initializeForTesting: true })
        .then(() => {
          void this.preloadInterstitial();
          void this.preloadRewarded();
        })
        .catch(() => {});
    }
    return this.initPromise;
  }

  /** Shows the persistent banner. Safe to call repeatedly — a second call while already visible is a no-op. */
  async showBanner(): Promise<void> {
    if (!this.isSupported) return;
    await this.initialize();
    if (this.bannerVisible) return;
    const options: BannerAdOptions = {
      adId: AD_UNIT_IDS.banner,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: 0
    };
    try {
      this.bannerVisible = true;
      await AdMob.addListener(BannerAdPluginEvents.SizeChanged, info => this.setBannerSpace(info.height));
      await AdMob.addListener(BannerAdPluginEvents.FailedToLoad, () => this.setBannerSpace(0));
      await AdMob.showBanner(options);
    } catch {
      this.bannerVisible = false;
      this.setBannerSpace(0);
    }
  }

  async hideBanner(): Promise<void> {
    if (!this.isSupported || !this.bannerVisible) return;
    this.bannerVisible = false;
    this.setBannerSpace(0);
    try { await AdMob.hideBanner(); } catch { /* nothing to clean up */ }
  }

  /** Exposes the banner's live height as a CSS var so page content can pad around it. */
  private setBannerSpace(heightPx: number): void {
    document.documentElement.style.setProperty('--ad-banner-space', `${Math.max(0, heightPx)}px`);
  }

  /** Preloads (or reloads) the interstitial in the background. */
  async preloadInterstitial(): Promise<void> {
    if (!this.isSupported || this.interstitialReady || this.interstitialLoading) return;
    this.interstitialLoading = true;
    try {
      await AdMob.prepareInterstitial({ adId: AD_UNIT_IDS.interstitial });
      this.interstitialReady = true;
    } catch {
      this.interstitialReady = false;
    } finally {
      this.interstitialLoading = false;
    }
  }

  /**
   * Call at a natural breakpoint (leaving a finished round). Shows an interstitial only every
   * INTERSTITIAL_EVERY_N_ROUNDS calls, so full-screen ads stay policy-safe and don't fatigue players.
   */
  async maybeShowInterstitialAtBreakpoint(): Promise<void> {
    if (!this.isSupported) return;
    this.roundsSinceInterstitial++;
    if (this.roundsSinceInterstitial < INTERSTITIAL_EVERY_N_ROUNDS) return;
    this.roundsSinceInterstitial = 0;
    await this.showInterstitial();
  }

  /**
   * Shows the interstitial if one is ready (or can be loaded within a short timeout) and resolves
   * once it's dismissed. Gives up after INTERSTITIAL_TIMEOUT_MS so a slow/unavailable ad never blocks
   * whatever navigation it's gating. Returns true only if an ad was actually shown.
   */
  async showInterstitial(): Promise<boolean> {
    if (!this.isSupported) return false;
    await this.initialize();
    if (!this.interstitialReady) {
      await Promise.race([
        this.preloadInterstitial(),
        new Promise<void>(resolve => setTimeout(resolve, INTERSTITIAL_TIMEOUT_MS))
      ]);
    }
    if (!this.interstitialReady) return false;
    this.interstitialReady = false;
    try {
      await AdMob.showInterstitial();
      void this.preloadInterstitial();
      return true;
    } catch {
      void this.preloadInterstitial();
      return false;
    }
  }

  /** Preloads (or reloads) the rewarded video in the background. */
  async preloadRewarded(): Promise<void> {
    if (!this.isSupported || this.rewardedReady || this.rewardedLoading) return;
    this.rewardedLoading = true;
    try {
      await AdMob.prepareRewardVideoAd({ adId: AD_UNIT_IDS.rewarded });
      this.rewardedReady = true;
    } catch {
      this.rewardedReady = false;
    } finally {
      this.rewardedLoading = false;
    }
  }

  /**
   * Shows the rewarded video and resolves `true` ONLY when AdMob's own reward callback fires.
   * Never resolves `true` optimistically — closing the ad early, a show failure, or calling this
   * again while one is already showing all resolve `false`. This is the one method every
   * coin/unlock grant in the app must gate on.
   */
  async showRewarded(): Promise<boolean> {
    if (!this.isSupported || this.rewardedShowing) return false;
    await this.initialize();
    if (!this.rewardedReady) await this.preloadRewarded();
    if (!this.rewardedReady) return false;
    this.rewardedReady = false;
    this.rewardedShowing = true;

    return new Promise<boolean>(resolve => {
      let settled = false;
      const handles: Promise<PluginListenerHandle>[] = [];
      const cleanup = () => handles.forEach(h => h.then(handle => handle.remove()).catch(() => {}));
      const finish = (granted: boolean) => {
        if (settled) return;
        settled = true;
        cleanup();
        this.rewardedShowing = false;
        void this.preloadRewarded();
        resolve(granted);
      };

      // showRewardVideoAd()'s promise is only meant to resolve once the user has earned the
      // reward — if they back out early, the AdMob dismissed/failed-to-show events fire instead
      // and never resolve it on their own, so race those against it as the "no reward" paths.
      handles.push(AdMob.addListener(RewardAdPluginEvents.Dismissed, () => finish(false)));
      handles.push(AdMob.addListener(RewardAdPluginEvents.FailedToShow, () => finish(false)));

      AdMob.showRewardVideoAd()
        .then(() => finish(true))
        .catch(() => finish(false));
    });
  }
}
