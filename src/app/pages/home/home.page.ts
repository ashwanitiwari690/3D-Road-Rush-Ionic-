import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameStateService } from '../../services/game-state.service';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [CommonModule],
  template: `
  <section class="home">
    <div class="hero-card">
      <div class="hero-copy">
        <span class="eyebrow">3D ENDLESS DRIVER</span>
        <h1>ROAD<br><strong>RUSH</strong></h1>
        <p>Race through a living city, weave between traffic and collect coins before the road gets faster.</p>
        <div class="hero-stats"><span>🏆 {{gs.high()}} BEST</span><span>⚡ LV {{gs.level()}}</span><span>🪙 {{gs.coins()}}</span></div>
        <button class="play-btn" (click)="gs.startRun()">▶ START RUN <small>FREE RACE</small></button>
      </div>
    </div>

    <div class="feature-row">
      <div><b>LEVEL {{gs.level()}}</b><span>{{gs.difficultyLabel()}}</span></div>
      <div><b>{{gs.levelTarget()}}m</b><span>Next target</span></div>
      <div><b>+{{gs.rewardAmount}}</b><span>Ad reward</span></div>
    </div>

    <div class="quick-grid">
      <button (click)="gs.go('shop')"><b>🪙</b><span>COIN CENTER</span><small>Earn & manage coins</small></button>
      <button (click)="gs.go('missions')"><b>🎯</b><span>MISSIONS</span><small>Level {{gs.level()}} goals</small></button>
      <button (click)="gs.watchRewardedAd()" [disabled]="gs.adCooldownActive()"><b>📺</b><span>REWARDED AD</span><small>{{gs.adButtonLabel()}}</small></button>
      <button (click)="gs.claimDaily()"><b>🎁</b><span>DAILY BONUS</span><small>+50 coins</small></button>
      <button (click)="gs.go('profile')"><b>{{gs.avatar()}}</b><span>PROFILE</span><small>{{gs.profileName()}}</small></button>
      <button class="garage-tile" (click)="gs.go('garage')"><b>🚘</b><span>GARAGE</span><small>Purchase new rides</small></button>
    </div>

    <div class="progress-card"><div><span>LEVEL {{gs.level()}} PROGRESS</span><b>{{gs.levelProgress()}}%</b></div><div class="bar"><i [style.width.%]="gs.levelProgress()"></i></div><small>Reach the target to unlock the next difficulty. Speed and traffic increase every level.</small></div>
  </section>
  `,
  styleUrl: '../../shared/game-ui.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomePage {
  readonly gs = inject(GameStateService);
}
