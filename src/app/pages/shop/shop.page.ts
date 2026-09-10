import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameStateService } from '../../services/game-state.service';

@Component({
  selector: 'app-shop-page',
  standalone: true,
  imports: [CommonModule],
  template: `
  <section class="panel">
    <button class="back" (click)="gs.go('home')">← Back</button><h2>COIN CENTER</h2>
    <div class="big-wallet"><div class="coin-orb">🪙</div><div><b>{{gs.coins()}}</b><small>Current balance</small></div></div>
    <div class="earn-card" [class.cooldown]="gs.adCooldownActive()">
      <div><span class="card-kicker">REWARDED VIDEO</span><b>WATCH A REWARDED AD</b><p *ngIf="!gs.adCooldownActive()">Watch the full Google AdMob rewarded video and receive {{gs.rewardAmount}} coins.</p><p *ngIf="gs.adCooldownActive()">You already claimed this reward. Come back when the timer reaches zero.</p></div>
      <button (click)="gs.watchRewardedAd()" [disabled]="gs.adCooldownActive() || gs.adBusy()"><span>{{gs.adCooldownActive() ? '⏳' : '📺'}}</span>{{gs.adButtonLabel()}}</button>
    </div>
    <div class="cooldown-card" *ngIf="gs.adCooldownActive()"><div><b>NEXT REWARDED AD</b><span>One reward every 2 hours</span></div><strong>{{gs.adCooldownText()}}</strong></div>
    <div class="future-card"><b>RUPEE CONVERSION</b><p>Prepared for a future server-side coin → ₹ system. Keep the wallet server-authoritative before enabling withdrawals, KYC and payouts.</p></div>
  </section>
  `,
  styleUrl: '../../shared/game-ui.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShopPage {
  readonly gs = inject(GameStateService);
}
