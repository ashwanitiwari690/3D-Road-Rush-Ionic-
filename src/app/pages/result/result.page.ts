import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameStateService } from '../../services/game-state.service';

@Component({
  selector: 'app-result-page',
  standalone: true,
  imports: [CommonModule],
  template: `
  <section class="result">
    <div class="result-icon">🏁</div><span class="eyebrow">RUN COMPLETE</span><h2>{{gs.newBest() ? 'NEW BEST!' : gs.completedRun() ? 'LEVEL CLEARED!' : 'GOOD RUN!'}}</h2>
    <div class="result-grid"><div><small>DISTANCE</small><b>{{Math.round(gs.lastDistance())}}m</b></div><div><small>COINS EARNED</small><b>+{{gs.lastRunCoins()}} 🪙</b></div><div><small>SCORE</small><b>{{gs.lastScore()}}</b></div><div><small>LEVEL</small><b>{{gs.level()}}</b></div></div>
    <div class="result-actions"><button class="play-btn" (click)="gs.startRun()">▶ PLAY AGAIN <small>FREE RACE</small></button><button class="secondary" (click)="gs.watchRewardedAd()" [disabled]="gs.adCooldownActive()">📺 {{gs.adButtonLabel()}}</button><button class="ghost" (click)="gs.go('home')">HOME</button></div>
  </section>
  `,
  styleUrl: '../../shared/game-ui.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ResultPage {
  readonly gs = inject(GameStateService);
  readonly Math = Math;
}
