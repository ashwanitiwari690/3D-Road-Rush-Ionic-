import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameStateService } from '../../services/game-state.service';

@Component({
  selector: 'app-missions-page',
  standalone: true,
  imports: [CommonModule],
  template: `
  <section class="panel">
    <button class="back" (click)="gs.go('home')">← Back</button><h2>LEVEL {{gs.level()}} MISSION</h2>
    <div class="mission"><div class="mission-top"><b>Reach {{gs.levelTarget()}} meters</b><strong>{{Math.min(gs.levelTarget(), Math.round(gs.distance()))}} / {{gs.levelTarget()}}m</strong></div><div class="bar"><i [style.width.%]="Math.min(100, gs.distance() / gs.levelTarget() * 100)"></i></div></div>
    <div class="difficulty"><b>DIFFICULTY</b><strong>{{gs.difficultyLabel()}}</strong><p>Every level increases road speed, traffic frequency and obstacle variety. Level 30 is MASTER difficulty.</p></div>
  </section>
  `,
  styleUrl: '../../shared/game-ui.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MissionsPage {
  readonly gs = inject(GameStateService);
  readonly Math = Math;
}
