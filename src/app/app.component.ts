import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { GameStateService } from './services/game-state.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  template: `
  <div class="app" [class.game-active]="isGameRoute()">
    <header class="topbar" *ngIf="!isGameRoute()">
      <button class="brand" (click)="gs.go('home')"><span class="brand-mark">RR</span><span>ROAD <b>RUSH</b></span></button>
      <div class="top-actions">
        <button class="avatar-mini" (click)="gs.go('profile')" aria-label="Profile">{{gs.avatar()}}</button>
        <div class="wallet"><span>🪙</span><b>{{gs.coins()}}</b></div>
        <button class="settings-mini" (click)="gs.go('settings')" aria-label="Settings">⚙</button>
      </div>
    </header>

    <main class="content">
      <router-outlet></router-outlet>
    </main>

    <div class="toast" *ngIf="gs.toast()">{{gs.toast()}}</div>
    <div class="ad-sheet" *ngIf="gs.adBusy()"><div class="ad-card"><div class="ad-loader">📺</div><h3>{{gs.adPurpose() === 'daily' ? 'DAILY BONUS AD' : gs.adPurpose() === 'garage' ? 'UNLOCK RIDE AD' : 'REWARDED AD'}}</h3><p>{{gs.adMessage()}}</p><small>{{gs.adPurpose() === 'garage' ? 'This ride unlocks once you have watched enough ads.' : 'Coins are granted only after the ' + (gs.adPurpose() === 'daily' ? 'daily bonus' : 'rewarded') + ' ad reports completion.'}}</small><button *ngIf="gs.adFallback()" (click)="gs.completeFallbackAd()">COMPLETE TEST AD</button></div></div>
  </div>
  `,
  styleUrl: './shared/game-ui.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent {
  readonly gs = inject(GameStateService);
  private router = inject(Router);
  readonly isGameRoute = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(e => e.urlAfterRedirects.startsWith('/game'))
    ),
    { initialValue: this.router.url.startsWith('/game') }
  );
}
