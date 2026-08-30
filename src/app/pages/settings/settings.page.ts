import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameStateService } from '../../services/game-state.service';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [CommonModule],
  template: `
  <section class="panel settings-panel">
    <button class="back" (click)="gs.go('home')">← Back</button><h2>SETTINGS</h2>
    <div class="settings-hero"><div class="settings-icon">⚙</div><div><b>YOUR RIDE, YOUR SOUND</b><span>Control the experience without leaving the game.</span></div></div>
    <div class="setting-row"><div><b>🔊 Sound Effects</b><small>Coins, collisions, buttons and level sounds</small></div><button class="toggle" [class.on]="gs.soundEnabled()" (click)="gs.toggleSound()">{{gs.soundEnabled() ? 'ON' : 'OFF'}}</button></div>
    <div class="setting-row"><div><b>🎵 Background Music</b><small>Looping Road Rush music during menus and runs</small></div><button class="toggle" [class.on]="gs.musicEnabled()" (click)="gs.toggleMusic()">{{gs.musicEnabled() ? 'ON' : 'OFF'}}</button></div>
    <div class="setting-row"><div><b>📳 Haptic Feedback</b><small>Light vibration on supported devices</small></div><button class="toggle" [class.on]="gs.vibrationEnabled()" (click)="gs.toggleVibration()">{{gs.vibrationEnabled() ? 'ON' : 'OFF'}}</button></div>
    <div class="settings-note">Preferences are stored locally on this device. Music starts after a user gesture to satisfy mobile autoplay rules.</div>
  </section>
  `,
  styleUrl: '../../shared/game-ui.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SettingsPage {
  readonly gs = inject(GameStateService);
}
