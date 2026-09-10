import { ChangeDetectionStrategy, Component, OnInit, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { GameStateService } from './services/game-state.service';
import { AppVerificationService } from './services/app-verification.service';
import { AdmobService } from './services/admob.service';
import { ConnectivityService } from './services/connectivity.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  template: `
  <ng-container *ngIf="connectivity.online(); else offlineBlock">
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
      <div class="ad-sheet" *ngIf="gs.adBusy()"><div class="ad-card"><div class="ad-loader">📺</div><h3>{{gs.adTitle()}}</h3><p>{{gs.adMessage()}}</p><small>{{gs.adHint()}}</small><button *ngIf="gs.adFallback()" (click)="gs.completeFallbackAd()">COMPLETE TEST AD</button></div></div>
    </div>
  </ng-container>
  <ng-template #offlineBlock>
    <main class="offline-screen">
      <div class="offline-card">
        <div class="offline-icon">📡</div>
        <h1>NO INTERNET CONNECTION</h1>
        <p>Road Rush needs an internet connection to load ads and save your rewards. Please reconnect to keep playing.</p>
        <button class="play-btn" (click)="connectivity.recheck()">TRY AGAIN</button>
      </div>
    </main>
  </ng-template>
  `,
  styleUrl: './shared/game-ui.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent implements OnInit {
  readonly gs = inject(GameStateService);
  readonly connectivity = inject(ConnectivityService);
  private router = inject(Router);
  private appVerification = inject(AppVerificationService);
  private admob = inject(AdmobService);
  readonly isGameRoute = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(e => e.urlAfterRedirects.startsWith('/game'))
    ),
    { initialValue: this.router.url.startsWith('/game') }
  );

  constructor() {
    // Persistent banner on every screen except live gameplay, where it would eat into
    // the driving canvas — matches the guide's "shown once, stays up" pattern.
    effect(() => {
      if (!this.connectivity.online()) return;
      if (this.isGameRoute()) void this.admob.hideBanner();
      else void this.admob.showBanner();
    });
  }

  ngOnInit(): void {
    void this.admob.initialize();
    // Fire-and-forget: confirms this device with Earnivo for its App Promotion
    // campaign, if a task is pending. Safe/idempotent to run on every launch.
    void this.appVerification.confirmInstall();
  }
}
