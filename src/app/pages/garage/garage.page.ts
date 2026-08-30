import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameStateService } from '../../services/game-state.service';

@Component({
  selector: 'app-garage-page',
  standalone: true,
  imports: [CommonModule],
  template: `
  <section class="panel garage-panel">
    <button class="back" (click)="gs.go('home')">← Back</button><h2>GARAGE</h2>
    <div class="big-wallet"><div class="coin-orb">🪙</div><div><b>{{gs.coins()}}</b><small>Available balance</small></div></div>
    <div class="garage-grid">
      <div class="garage-card" *ngFor="let item of gs.avatarCatalog" [class]="gs.garageStatus(item)">
        <div class="garage-avatar">{{item.id}}</div>
        <b class="garage-name">{{item.name}}</b>
        <span class="garage-price" *ngIf="item.price > 0">🪙 {{item.price}}</span>
        <span class="garage-price" *ngIf="item.price === 0">FREE STARTER</span>
        <button class="garage-btn"
          [disabled]="gs.garageStatus(item) === 'locked' && gs.coins() < item.price"
          (click)="gs.selectAvatar(item)">
          <ng-container [ngSwitch]="gs.garageStatus(item)">
            <span *ngSwitchCase="'selected'">✓ SELECTED</span>
            <span *ngSwitchCase="'owned'">USE THIS RIDE</span>
            <span *ngSwitchDefault>🔒 BUY · {{item.price}}</span>
          </ng-container>
        </button>
        <div class="garage-or" *ngIf="gs.garageStatus(item) === 'locked'">OR</div>
        <button class="garage-ad-btn" *ngIf="gs.garageStatus(item) === 'locked'" [disabled]="gs.adBusy()" (click)="gs.watchGarageAd(item)">
          <span class="ad-btn-label"><b>📺</b>WATCH AD</span><span class="ad-btn-count">{{gs.garageAdCount(item)}}/{{gs.adsNeeded(item)}}</span>
        </button>
      </div>
    </div>
  </section>
  `,
  styleUrl: '../../shared/game-ui.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GaragePage {
  readonly gs = inject(GameStateService);
}
