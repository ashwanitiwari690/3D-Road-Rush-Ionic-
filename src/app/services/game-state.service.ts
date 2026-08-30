import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { GameRewardService, GameConfig, RedeemGameRewardData } from './game-reward.service';

export interface AvatarOption { id: string; name: string; price: number; }

export type Screen = 'home' | 'game' | 'result' | 'shop' | 'missions' | 'settings' | 'profile' | 'garage';

export const STORAGE = {
  coins: 'road-rush-coins', high: 'road-rush-high', level: 'road-rush-level',
  daily: 'road-rush-daily', sound: 'road-rush-sound', music: 'road-rush-music',
  vibration: 'road-rush-vibration', name: 'road-rush-profile-name', avatar: 'road-rush-profile-avatar',
  adCooldown: 'road-rush-ad-cooldown', ownedAvatars: 'road-rush-owned-avatars',
  garageAdProgress: 'road-rush-garage-ad-progress', redeemKey: 'road-rush-redeem-idempotency'
} as const;

export type RedeemState = 'idle' | 'loading' | 'success' | 'error';
interface RedeemKeySnapshot { key: string; coins: number; mobileNumber: string; }

const readNum = (key: string, fallback: number) => {
  try { const n = Number(localStorage.getItem(key)); return Number.isFinite(n) ? Math.max(0, n) : fallback; } catch { return fallback; }
};
const save = (key: string, value: unknown) => { try { localStorage.setItem(key, String(value)); } catch { } };
const readOwnedAvatars = (key: string, fallback: string[]): Set<string> => {
  try { const raw = localStorage.getItem(key); if (raw) return new Set(raw.split(',').filter(Boolean)); } catch { }
  return new Set(fallback);
};
const readGarageAdProgress = (key: string): Record<string, number> => {
  try { const raw = localStorage.getItem(key); if (raw) return JSON.parse(raw); } catch { }
  return {};
};

/**
 * Central, app-lifetime state and game-independent business logic (coins, level, profile,
 * settings, garage, ads, coin redemption). Kept as a root singleton so every routed page sees
 * the same live values that used to live as instance fields on the single legacy AppComponent.
 * The canvas/render/physics loop stays local to GamePage since it only matters while that page is mounted.
 */
@Injectable({ providedIn: 'root' })
export class GameStateService {
  private router = inject(Router);
  private rewardService = inject(GameRewardService);

  readonly rewardAmount = 100;
  private readonly adCooldownMs = 2 * 60 * 60 * 1000;

  readonly coins = signal(readNum(STORAGE.coins, 250));
  readonly high = signal(readNum(STORAGE.high, 0));
  readonly level = signal(Math.min(30, Math.max(1, Math.floor(readNum(STORAGE.level, 1)))));

  readonly distance = signal(0);
  readonly runCoins = signal(0);
  readonly speed = signal(80);
  readonly paused = signal(false);

  readonly lastDistance = signal(0);
  readonly lastRunCoins = signal(0);
  readonly lastScore = signal(0);
  readonly newBest = signal(false);
  readonly completedRun = signal(false);

  readonly toast = signal('');
  readonly adBusy = signal(false);
  readonly adFallback = signal(false);
  readonly adMessage = signal('Loading Google AdMob rewarded video…');
  readonly adPurpose = signal<'reward' | 'daily' | 'garage'>('reward');
  readonly adGarageItemId = signal<string | null>(null);

  readonly soundEnabled = signal(localStorage.getItem(STORAGE.sound) !== '0');
  readonly musicEnabled = signal(localStorage.getItem(STORAGE.music) !== '0');
  readonly vibrationEnabled = signal(localStorage.getItem(STORAGE.vibration) !== '0');

  readonly profileName = signal(localStorage.getItem(STORAGE.name) || 'Road Racer');
  readonly avatar = signal(localStorage.getItem(STORAGE.avatar) || '🏎️');

  readonly avatarCatalog: AvatarOption[] = [
    { id: '🏎️', name: 'Rookie Racer', price: 0 },
    { id: '🚗', name: 'City Sedan', price: 150 },
    { id: '🚕', name: 'Yellow Cab', price: 200 },
    { id: '🚙', name: 'Trail SUV', price: 250 },
    { id: '🏍️', name: 'Street Bike', price: 300 },
    { id: '🚓', name: 'Highway Patrol', price: 350 },
    { id: '🚘', name: 'Night Cruiser', price: 450 },
    { id: '🏁', name: 'Champion Edition', price: 600 },
    { id: '🚐', name: 'Party Van', price: 700 },
    { id: '🚚', name: 'Cargo Hauler', price: 800 },
    { id: '🚛', name: 'Big Rig', price: 900 },
    { id: '🛺', name: 'Tuk-Tuk Special', price: 1000 }
  ];
  readonly ownedAvatars = signal<Set<string>>(readOwnedAvatars(STORAGE.ownedAvatars, [this.avatar()]));
  readonly garageAdProgress = signal<Record<string, number>>(readGarageAdProgress(STORAGE.garageAdProgress));
  readonly adCooldownUntil = signal(readNum(STORAGE.adCooldown, 0));
  readonly now = signal(Date.now());

  readonly gameConfig = signal<GameConfig | null>(null);
  readonly gameConfigStatus = signal<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  readonly redeemState = signal<RedeemState>('idle');
  readonly redeemMobileNumber = signal('');
  readonly redeemErrorMessage = signal('');
  readonly redeemResult = signal<RedeemGameRewardData | null>(null);
  /** Blocks resubmission of a redemption the backend already confirmed as processed. */
  private duplicateSnapshot: { coins: number; mobileNumber: string } | null = null;

  private music?: HTMLAudioElement;
  private audioCache = new Map<string, HTMLAudioElement>();

  constructor() {
    window.setInterval(() => this.now.set(Date.now()), 1000);
    this.music = new Audio('assets/sounds/road-rush-music.wav');
    this.music.loop = true; this.music.volume = 0.90; this.music.preload = 'auto';
    if (this.musicEnabled()) this.startMusic();
  }

  go(path: Screen): void {
    this.playSound('click');
    const current = (this.router.url.split('?')[0].slice(1) || 'home') as Screen;
    if (current === 'shop' && path !== 'shop') this.hideBannerAd();
    this.router.navigateByUrl('/' + path);
    if (path === 'shop') this.showBannerAd();
    if (path === 'profile') this.loadGameConfig();
  }

  startRun(): void {
    this.playSound('click'); this.startMusic();
    this.paused.set(false); this.distance.set(0); this.runCoins.set(0); this.speed.set(this.baseSpeed());
    this.router.navigateByUrl('/game');
  }

  finishRun(completed: boolean): void {
    const bonus = completed ? 10 + this.level() * 2 : 0;
    if (bonus) { this.coins.update(v => v + bonus); this.runCoins.update(v => v + bonus); }
    const score = Math.round(this.distance() * (1 + this.level() * 0.08)) + this.runCoins() * 10;
    const bestBefore = this.high();
    this.newBest.set(score > bestBefore); this.high.set(Math.max(bestBefore, score)); save(STORAGE.high, this.high());
    this.completedRun.set(completed);
    if (completed) { this.playSound('level'); if (this.level() < 30) { this.level.update(v => v + 1); save(STORAGE.level, this.level()); } }
    this.lastDistance.set(this.distance()); this.lastRunCoins.set(this.runCoins()); this.lastScore.set(score);
    save(STORAGE.coins, this.coins());
    this.router.navigateByUrl('/result');
  }

  collectCoin(value: number): void {
    this.playSound('coin'); this.runCoins.update(v => v + value); this.coins.update(v => v + value); save(STORAGE.coins, this.coins());
  }

  levelTarget(): number { return 650 + (this.level() - 1) * 120; }
  baseSpeed(): number { return Math.min(190, 80 + (this.level() - 1) * 3.8); }
  levelProgress(): number { return Math.min(100, Math.round(this.distance() / this.levelTarget() * 100)); }
  difficultyLabel(): string { const l = this.level(); return l < 6 ? 'EASY' : l < 12 ? 'NORMAL' : l < 20 ? 'HARD' : l < 27 ? 'EXTREME' : 'MASTER'; }

  toggleSound(): void { this.soundEnabled.update(v => !v); save(STORAGE.sound, this.soundEnabled() ? '1' : '0'); if (this.soundEnabled()) this.playSound('click'); }
  toggleMusic(): void { this.musicEnabled.update(v => !v); save(STORAGE.music, this.musicEnabled() ? '1' : '0'); if (this.musicEnabled()) this.startMusic(); else this.music?.pause(); }
  toggleVibration(): void { this.vibrationEnabled.update(v => !v); save(STORAGE.vibration, this.vibrationEnabled() ? '1' : '0'); if (this.vibrationEnabled() && navigator.vibrate) navigator.vibrate(30); }
  private startMusic(): void { if (!this.musicEnabled() || !this.music) return; this.music.play().catch(() => { }); }
  playSound(name: 'click' | 'coin' | 'crash' | 'level'): void { if (!this.soundEnabled()) return; let audio = this.audioCache.get(name); if (!audio) { audio = new Audio(`assets/sounds/${name}.wav`); audio.preload = 'auto'; audio.volume = name === 'coin' ? 1 : name === 'crash' ? .98 : name === 'level' ? .95 : .9; this.audioCache.set(name, audio); } audio.currentTime = 0; audio.play().catch(() => { }); }

  updateProfileName(name: string): void { const safe = String(name || '').trim().slice(0, 18) || 'Road Racer'; this.profileName.set(safe); save(STORAGE.name, safe); }
  setAvatar(item: string): void { this.avatar.set(item); save(STORAGE.avatar, item); this.playSound('click'); }

  loadGameConfig(): void {
    if (this.gameConfigStatus() !== 'idle') return;
    this.gameConfigStatus.set('loading');
    this.rewardService.getGameConfig().subscribe({
      next: cfg => { this.gameConfig.set(cfg ?? null); this.gameConfigStatus.set('loaded'); },
      error: () => this.gameConfigStatus.set('error')
    });
  }

  redeemMobileValid(): boolean { return /^\d{10}$/.test(this.redeemMobileNumber()); }

  isBlockedByDuplicate(): boolean {
    const s = this.duplicateSnapshot;
    return !!s && s.coins === this.coins() && s.mobileNumber === this.redeemMobileNumber();
  }

  onRedeemMobileInput(value: string): void {
    this.redeemMobileNumber.set(String(value || '').replace(/\D/g, '').slice(0, 10));
    if (this.redeemState() !== 'loading') { this.redeemState.set('idle'); this.redeemErrorMessage.set(''); }
  }

  redeemCoins(cfg: GameConfig): void {
    if (this.coins() < cfg.minimumCoins || !this.redeemMobileValid() || this.redeemState() === 'loading' || this.isBlockedByDuplicate()) return;
    const coinsToRedeem = this.coins();
    const mobileNumber = this.redeemMobileNumber();
    const idempotencyKey = this.getOrCreateIdempotencyKey(coinsToRedeem, mobileNumber);
    this.redeemState.set('loading'); this.redeemErrorMessage.set('');
    this.rewardService.redeemCoins(mobileNumber, coinsToRedeem, idempotencyKey).subscribe({
      next: response => this.handleRedeemSuccess(response),
      error: (err: { errorCode?: string; message?: string }) => this.handleRedeemFailure(err.errorCode, err.message)
    });
  }

  private handleRedeemSuccess(response: RedeemGameRewardData): void {
    // Backend is the source of truth for both the deducted coins and the ₹ amount — never computed locally.
    const safeAmount = Math.max(0, Math.min(this.coins(), Math.floor(response.coinsRedeemed) || 0));
    this.coins.update(v => v - safeAmount); save(STORAGE.coins, this.coins());
    this.redeemResult.set(response); this.redeemState.set('success'); this.clearIdempotencyKey(); this.duplicateSnapshot = null;
  }

  private handleRedeemFailure(errorCode?: string, message?: string): void {
    this.redeemState.set('error');
    if (errorCode === 'DUPLICATE_CONVERSION') {
      this.duplicateSnapshot = { coins: this.coins(), mobileNumber: this.redeemMobileNumber() };
      this.redeemErrorMessage.set('This redemption has already been processed. Please check your wallet before trying again.');
      return;
    }
    // Coins were never deducted locally, so a network/backend failure is a safe, retryable state.
    this.redeemErrorMessage.set(this.mapRedeemError(errorCode, message));
  }

  private mapRedeemError(errorCode?: string, message?: string): string {
    if (errorCode === 'USER_SUSPENDED') return 'Your account is currently unavailable for redemption.';
    if (errorCode === 'NETWORK_ERROR') return 'Unable to connect to the server. Please check your internet connection and try again.';
    const msg = (message || '').toLowerCase();
    if (msg.includes('unknown or inactive game')) return 'Coin redemption is currently unavailable for this game.';
    if (msg.includes('no earnivo account')) return 'No Earnivo account was found for this mobile number.';
    if (msg.includes('minimum of')) return 'You have not reached the minimum redemption limit yet.';
    return 'Something went wrong while processing your redemption. Your coins have not been deducted.';
  }

  dismissRedeemResult(): void {
    this.redeemState.set('idle'); this.redeemResult.set(null); this.redeemErrorMessage.set(''); this.redeemMobileNumber.set(''); this.duplicateSnapshot = null;
  }

  private getOrCreateIdempotencyKey(coins: number, mobileNumber: string): string {
    try {
      const raw = localStorage.getItem(STORAGE.redeemKey);
      if (raw) {
        const stored = JSON.parse(raw) as Partial<RedeemKeySnapshot>;
        if (stored && stored.coins === coins && stored.mobileNumber === mobileNumber && typeof stored.key === 'string') return stored.key;
      }
    } catch { }
    const key = `roadrush-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    try { save(STORAGE.redeemKey, JSON.stringify({ key, coins, mobileNumber } as RedeemKeySnapshot)); } catch { }
    return key;
  }
  private clearIdempotencyKey(): void { try { localStorage.removeItem(STORAGE.redeemKey); } catch { } }

  isOwned(item: AvatarOption): boolean { return this.ownedAvatars().has(item.id); }
  garageStatus(item: AvatarOption): 'selected' | 'owned' | 'locked' {
    if (this.avatar() === item.id) return 'selected';
    if (this.isOwned(item)) return 'owned';
    return 'locked';
  }
  selectAvatar(item: AvatarOption): void {
    if (this.isOwned(item)) { this.setAvatar(item.id); return; }
    this.purchaseAvatar(item);
  }
  private purchaseAvatar(item: AvatarOption): void {
    if (this.isOwned(item)) return;
    if (this.coins() < item.price) { this.playSound('click'); this.notify('Not enough coins for this ride.'); return; }
    this.coins.update(v => v - item.price); save(STORAGE.coins, this.coins());
    this.unlockAvatar(item);
  }
  private unlockAvatar(item: AvatarOption): void {
    this.ownedAvatars.update(set => { const next = new Set(set); next.add(item.id); save(STORAGE.ownedAvatars, Array.from(next).join(',')); return next; });
    this.setAvatar(item.id);
    this.notify(`${item.id} unlocked!`);
  }
  adsNeeded(item: AvatarOption): number { return item.price < 300 ? 1 : 2; }
  garageAdCount(item: AvatarOption): number { return this.garageAdProgress()[item.id] || 0; }
  watchGarageAd(item: AvatarOption): void {
    if (this.isOwned(item) || this.adBusy()) return;
    this.playAd('garage', item.id);
  }
  private grantGarageAdProgress(): void {
    const id = this.adGarageItemId();
    const item = this.avatarCatalog.find(a => a.id === id);
    if (!id || !item) return;
    const needed = this.adsNeeded(item);
    const nextCount = this.garageAdCount(item) + 1;
    if (nextCount >= needed) {
      const progress = { ...this.garageAdProgress() }; delete progress[id];
      this.garageAdProgress.set(progress); save(STORAGE.garageAdProgress, JSON.stringify(progress));
      this.unlockAvatar(item);
    } else {
      const progress = { ...this.garageAdProgress(), [id]: nextCount };
      this.garageAdProgress.set(progress); save(STORAGE.garageAdProgress, JSON.stringify(progress));
      this.notify(`Ad watched (${nextCount}/${needed}) for ${item.name}.`);
    }
  }
  notify(text: string): void { this.toast.set(text); window.setTimeout(() => this.toast.set(''), 1800); }
  claimDaily(): void {
    const today = new Date().toISOString().slice(0, 10);
    if (localStorage.getItem(STORAGE.daily) === today) { this.notify('Daily bonus already claimed.'); return; }
    if (this.adBusy()) return;
    this.playAd('daily');
  }

  adCooldownActive(): boolean { return this.adCooldownUntil() > this.now(); }
  adButtonLabel(): string { return this.adCooldownActive() ? this.adCooldownText() : `+${this.rewardAmount} COINS`; }
  adCooldownText(): string { const ms = Math.max(0, this.adCooldownUntil() - this.now()); const h = Math.floor(ms / 3600000); const m = Math.floor((ms % 3600000) / 60000); const s = Math.floor((ms % 60000) / 1000); return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; }
  async watchRewardedAd(): Promise<void> {
    if (this.adCooldownActive()) { this.notify(`Reward available again in ${this.adCooldownText()}.`); return; }
    if (this.adBusy()) return;
    await this.playAd('reward');
  }
  private async playAd(purpose: 'reward' | 'daily' | 'garage', garageItemId?: string): Promise<void> {
    this.adPurpose.set(purpose);
    this.adGarageItemId.set(garageItemId ?? null);
    this.adBusy.set(true); this.adFallback.set(false);
    this.adMessage.set(purpose === 'daily' ? 'Loading Google AdMob daily bonus video…' : purpose === 'garage' ? 'Loading Google AdMob unlock video…' : 'Loading Google AdMob rewarded video…');
    this.playSound('click');
    const cap = (window as any).Capacitor?.Plugins?.AdMob;
    try {
      if (cap?.prepareRewardVideoAd && cap?.showRewardVideoAd) {
        await cap.prepareRewardVideoAd({ adId: 'ca-app-pub-3940256099942544/5224354917', isTesting: true, immersiveMode: true });
        const reward = await cap.showRewardVideoAd();
        const amount = Number(reward?.amount || this.rewardAmount);
        this.finishAd(purpose, amount);
        return;
      }
    }
    catch { this.adMessage.set('AdMob is not available. Use the test fallback while developing, then configure the native AdMob plugin for Android.'); }
    this.adFallback.set(true); this.adMessage.set('TEST MODE: native AdMob was not detected.');
  }
  completeFallbackAd(): void { this.finishAd(this.adPurpose(), this.rewardAmount); }
  private finishAd(purpose: 'reward' | 'daily' | 'garage', amount: number): void {
    this.adBusy.set(false); this.adFallback.set(false);
    if (purpose === 'daily') this.grantDailyCoins();
    else if (purpose === 'garage') this.grantGarageAdProgress();
    else this.grantAdCoins(amount);
  }
  private grantDailyCoins(): void { const today = new Date().toISOString().slice(0, 10); this.coins.update(v => v + 50); save(STORAGE.coins, this.coins()); save(STORAGE.daily, today); this.notify('+50 daily coins!'); }
  private grantAdCoins(amount: number): void { const safe = Math.max(1, Math.min(500, Math.floor(amount))); this.coins.update(v => v + safe); save(STORAGE.coins, this.coins()); const until = Date.now() + this.adCooldownMs; this.adCooldownUntil.set(until); save(STORAGE.adCooldown, until); this.notify(`+${safe} coins added. Next ad in 02:00:00.`); }

  showBannerAd(): void {
    const cap = (window as any).Capacitor?.Plugins?.AdMob;
    cap?.showBanner?.({ adId: 'ca-app-pub-3940256099942544/6300978111', adSize: 'BANNER', position: 'BOTTOM_CENTER', isTesting: true })?.catch?.(() => { });
  }
  hideBannerAd(): void {
    const cap = (window as any).Capacitor?.Plugins?.AdMob;
    cap?.hideBanner?.()?.catch?.(() => { });
  }
}
