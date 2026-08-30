import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameStateService } from '../../services/game-state.service';

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [CommonModule],
  template: `
  <section class="panel profile-panel">
    <button class="back" (click)="gs.go('home')">← Back</button><h2>YOUR PROFILE</h2>
    <div class="profile-avatar">{{gs.avatar()}}</div><div class="profile-name">{{gs.profileName()}}</div><div class="profile-sub">ROAD RUSH DRIVER</div>
    <label class="profile-label">PLAYER NAME</label><input class="profile-input" [value]="gs.profileName()" maxlength="18" (input)="gs.updateProfileName($any($event.target).value)" placeholder="Enter your name">
    <button class="secondary garage-link" (click)="gs.go('garage')">🚘 CHANGE AVATAR IN GARAGE</button>
    <div class="profile-summary"><span>🏆 Best Score</span><b>{{gs.high()}}</b><span>⚡ Level</span><b>{{gs.level()}}</b><span>🪙 Coins</span><b>{{gs.coins()}}</b></div>

    <div class="redeem-card" *ngIf="gs.gameConfig() as cfg">
      <div class="redeem-head"><span>💸</span><div><b>COIN REDEMPTION</b><small>Convert coins to real ₹ in your Earnivo wallet</small></div></div>

      <ng-container *ngIf="gs.redeemState() === 'success' && gs.redeemResult() as result; else redeemForm">
        <div class="redeem-success">
          <b>Redemption Successful 🎉</b>
          <div class="redeem-success-grid">
            <span>Coins Redeemed</span><b>{{result.coinsRedeemed | number}} Coins</b>
            <span>Amount Credited</span><b>₹{{result.amountCredited}}</b>
            <span>Transaction ID</span><b class="redeem-txn">{{result.transactionId}}</b>
          </div>
          <small>Your reward has been credited to your Earnivo wallet.</small>
          <button class="secondary" (click)="gs.dismissRedeemResult()">DONE</button>
        </div>
      </ng-container>

      <ng-template #redeemForm>
        <div class="redeem-stats">
          <span>Available Coins</span><b>{{gs.coins() | number}} Coins</b>
          <span>Minimum Required</span><b>{{cfg.minimumCoins | number}} Coins</b>
          <span>Current Conversion</span><b>{{cfg.coinsPerConversion | number}} Coins = ₹{{cfg.rupeesPerConversion}}</b>
        </div>

        <ng-container *ngIf="gs.coins() >= cfg.minimumCoins; else redeemLocked">
          <label class="profile-label">REGISTERED MOBILE NUMBER</label>
          <input class="profile-input" type="tel" inputmode="numeric" autocomplete="tel" maxlength="10"
            placeholder="10 digit mobile number" [value]="gs.redeemMobileNumber()" [disabled]="gs.redeemState() === 'loading'"
            (input)="gs.onRedeemMobileInput($any($event.target).value)">
          <button class="play-btn" [disabled]="!gs.redeemMobileValid() || gs.redeemState() === 'loading' || gs.isBlockedByDuplicate()"
            (click)="gs.redeemCoins(cfg)">{{gs.redeemState() === 'loading' ? 'REDEEMING…' : 'REDEEM COINS'}}</button>
          <small class="redeem-error" *ngIf="gs.redeemState() === 'error'">{{gs.redeemErrorMessage()}}</small>
        </ng-container>
        <ng-template #redeemLocked>
          <div class="redeem-locked">🔒 Reach {{cfg.minimumCoins | number}} coins to unlock coin redemption.</div>
        </ng-template>
      </ng-template>
    </div>

    <button class="play-btn" (click)="gs.go('home')">SAVE PROFILE</button>
  </section>
  `,
  styleUrl: '../../shared/game-ui.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfilePage implements OnInit {
  readonly gs = inject(GameStateService);
  ngOnInit(): void { this.gs.loadGameConfig(); }
}
