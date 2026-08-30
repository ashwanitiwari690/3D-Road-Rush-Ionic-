import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, OnDestroy, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameStateService } from '../../services/game-state.service';

interface Obstacle { lane: number; z: number; kind: 'car' | 'barrier' | 'cone'; speed: number; color: string; }
interface RoadCoin { lane: number; z: number; value: number; }

@Component({
  selector: 'app-game-page',
  standalone: true,
  imports: [CommonModule],
  template: `
  <section class="game-screen">
    <canvas #gameCanvas class="game-canvas"
      (pointerdown)="onGamePointerDown($event)"
      (pointermove)="onGamePointerMove($event)"
      (pointerup)="onGamePointerUp($event)"
      (pointercancel)="onGamePointerUp($event)"></canvas>
    <div class="game-vignette" aria-hidden="true"></div>
    <div class="hud">
      <button class="hud-btn" (click)="togglePause()" aria-label="Pause game">{{gs.paused() ? '▶' : 'Ⅱ'}}</button>
      <div class="hud-pill">
        <div><b>LV {{gs.level()}}</b><span>{{gs.difficultyLabel()}}</span></div>
        <i><em [style.width.%]="gs.levelProgress()"></em></i>
      </div>
      <div class="hud-right">
        <div class="hud-coins"><span>🪙</span><b>{{gs.runCoins()}}</b></div>
        <div class="hud-speed">
          <div><b>{{Math.round(gs.speed())}}</b><span>KM/H</span></div>
          <i><em [style.width.%]="Math.min(100, gs.speed() / 2.5)"></em></i>
        </div>
      </div>
    </div>
    <div class="drive-tip"><span>↔</span><div><b>TOUCH & DRAG</b><small>Steer anywhere on the road</small></div></div>
    <div class="center-msg" *ngIf="gs.paused()"><div class="pause-card"><b>PAUSED</b><span>Take a breath — the road is waiting.</span><button class="play-btn small" (click)="togglePause()">▶ RESUME</button></div></div>
  </section>
  `,
  styleUrl: '../../shared/game-ui.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GamePage implements AfterViewInit, OnDestroy {
  @ViewChild('gameCanvas') canvas?: ElementRef<HTMLCanvasElement>;
  readonly gs = inject(GameStateService);
  readonly Math = Math;

  private ctx?: CanvasRenderingContext2D; private raf = 0; private last = 0; private lane = 1; private targetLane = 1;
  private playerY = 0; private targetPlayerY = 0;
  private obstacles: Obstacle[] = []; private roadCoins: RoadCoin[] = []; private elapsed = 0; private worldScroll = 0; private finished = false;
  private resizeObserver?: ResizeObserver;
  private pointerStartX = 0; private pointerStartY = 0; private pointerActive = false; private runStartedAt = 0; private lastDrawError = 0;

  ngAfterViewInit(): void {
    window.addEventListener('keydown', this.keyHandler);
    this.finished = false; this.elapsed = 0; this.worldScroll = 0; this.lane = 1; this.targetLane = 1; this.playerY = 0; this.targetPlayerY = 0; this.pointerActive = false;
    this.obstacles = []; this.roadCoins = []; this.runStartedAt = performance.now(); this.last = this.runStartedAt;
    requestAnimationFrame(() => {
      const canvas = this.canvas?.nativeElement; if (!canvas) return;
      this.resizeCanvas(); this.observeCanvas(); this.spawnInitial(); this.draw(); this.raf = requestAnimationFrame(this.loop);
    });
  }
  ngOnDestroy(): void {
    cancelAnimationFrame(this.raf); this.resizeObserver?.disconnect(); window.removeEventListener('keydown', this.keyHandler);
  }

  private keyHandler = (event: KeyboardEvent): void => {
    if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') { event.preventDefault(); this.move(-1); }
    if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') { event.preventDefault(); this.move(1); }
    if (event.key === ' ' || event.key.toLowerCase() === 'p') { event.preventDefault(); this.togglePause(); }
  };

  togglePause(): void { if (this.finished) return; this.gs.paused.update(v => !v); if (!this.gs.paused()) { this.last = performance.now(); this.raf = requestAnimationFrame(this.loop); } else cancelAnimationFrame(this.raf); }
  move(dir: number): void { if (this.gs.paused() || this.finished) return; this.targetLane = Math.max(0, Math.min(2, this.targetLane + dir)); this.gs.playSound('click'); }

  onGamePointerDown(event: PointerEvent): void {
    if (this.gs.paused() || this.finished) return;
    this.pointerActive = true;
    this.pointerStartX = event.clientX; this.pointerStartY = event.clientY;
    try { (event.currentTarget as HTMLCanvasElement).setPointerCapture(event.pointerId); } catch { }
    this.setCarFromPointer(event);
  }
  onGamePointerMove(event: PointerEvent): void {
    if (!this.pointerActive || this.gs.paused() || this.finished) return;
    this.setCarFromPointer(event);
  }
  onGamePointerUp(event: PointerEvent): void {
    this.pointerActive = false;
    try { (event.currentTarget as HTMLCanvasElement).releasePointerCapture(event.pointerId); } catch { }
  }
  private setCarFromPointer(event: PointerEvent): void {
    const canvas = this.canvas?.nativeElement;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    // The car follows the finger/mouse directly. This feels more like a driving game
    // than discrete left/right buttons while still keeping the road safely bounded.
    const nx = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const ny = Math.max(0.72, Math.min(0.96, (event.clientY - rect.top) / rect.height));
    this.targetLane = Math.max(0, Math.min(2, nx * 3 - 0.5));
    this.targetPlayerY = (ny - 0.84) * 0.62;
  }

  private loop = (nowTime: number): void => {
    if (this.finished || this.gs.paused()) return;
    const dt = Math.min(0.032, Math.max(0, (nowTime - this.last) / 1000)); this.last = nowTime; this.elapsed += dt;
    const current = this.gs.speed(); this.gs.distance.update(v => v + current * dt * 0.28); this.gs.speed.set(Math.min(250, this.gs.baseSpeed() + this.gs.distance() * 0.06));
    // Road markings/texture scroll in step with the actual live speed, so higher levels visibly feel faster.
    this.worldScroll += dt * (current / 92);
    this.lane += (this.targetLane - this.lane) * Math.min(1, dt * 12);
    this.playerY += (this.targetPlayerY - this.playerY) * Math.min(1, dt * 10);
    this.updateObjects(dt); this.draw();
    if (this.gs.distance() >= this.gs.levelTarget()) this.finishRun(true); else this.raf = requestAnimationFrame(this.loop);
  };

  private updateObjects(dt: number): void {
    const difficulty = this.gs.level();
    const worldSpeed = 0.22 + difficulty * 0.005;
    for (const o of this.obstacles) o.z += worldSpeed * dt * (o.speed / 100);
    for (const c of this.roadCoins) c.z += worldSpeed * dt;

    // Keep the first moments of every run fair: never spawn a new obstacle too close to the player.
    const safeSpawn = this.elapsed < 1.35;
    if (this.obstacles.length < 7 && !safeSpawn && (this.obstacles.length === 0 || Math.random() < dt * (0.55 + difficulty * 0.032))) this.spawnObstacle(0.02);
    if (this.roadCoins.length < 12 && Math.random() < dt * 1.7) this.spawnCoin(0.02);

    this.obstacles = this.obstacles.filter(o => o.z < 1.08);
    // Coins get a wide, forgiving pickup window (unlike obstacles) so steering toward
    // one reliably collects it instead of slipping through a narrow depth/lane gap.
    this.roadCoins = this.roadCoins.filter(c => {
      if (c.z > 0.74 && c.z < 1.08 && Math.abs(c.lane - this.lane) < 0.55) {
        this.gs.collectCoin(c.value); return false;
      }
      return c.z < 1.08;
    });

    // Collision only becomes active after a short grace period and at the actual player depth.
    if (this.elapsed < 1.0) return;
    for (const o of this.obstacles) {
      if (o.z > 0.955 && o.z < 1.035 && Math.abs(o.lane - this.lane) < 0.22) {
        this.hitObstacle(); return;
      }
    }
  }

  private spawnInitial(): void {
    // Fair opening: obstacles begin farther away and use different lanes.
    const lanes = [0, 2, 1, 0, 2];
    for (let i = 0; i < 5; i++) this.spawnObstacle(0.14 + i * 0.16, lanes[i]);
    const coinLanes = [1, 0, 2, 1, 2, 0, 1, 2];
    for (let i = 0; i < 8; i++) this.spawnCoin(0.10 + i * 0.11, coinLanes[i]);
  }
  private spawnObstacle(z = 0.02, forcedLane?: number): void {
    const lane = forcedLane ?? Math.floor(Math.random() * 3); const kinds: Obstacle['kind'][] = ['car', 'barrier', 'cone']; const kind = kinds[Math.floor(Math.random() * kinds.length)];
    const colors = ['#ff4057', '#35a7ff', '#ffd34d', '#8d6bff']; this.obstacles.push({ lane, z, kind, speed: 90 + Math.random() * 35 + this.gs.level() * 1.4, color: colors[Math.floor(Math.random() * colors.length)] });
  }
  private spawnCoin(z = 0.02, forcedLane?: number): void { this.roadCoins.push({ lane: forcedLane ?? Math.floor(Math.random() * 3), z, value: Math.random() < 0.12 ? 5 : 1 }); }
  private hitObstacle(): void { this.gs.playSound('crash'); if (this.gs.vibrationEnabled() && navigator.vibrate) navigator.vibrate(80); this.finishRun(false); }
  private finishRun(completed: boolean): void {
    if (this.finished) return; this.finished = true; cancelAnimationFrame(this.raf); this.resizeObserver?.disconnect();
    this.gs.finishRun(completed);
  }

  private draw(): void {
    const c = this.canvas?.nativeElement;
    if (!c) return;
    const rect = c.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    const pixelW = Math.max(1, Math.floor(w * dpr));
    const pixelH = Math.max(1, Math.floor(h * dpr));

    if (c.width !== pixelW || c.height !== pixelH) {
      c.width = pixelW;
      c.height = pixelH;
      this.ctx = undefined;
    }
    const ctx = this.ctx || c.getContext('2d', { alpha: true });
    if (!ctx) return;
    this.ctx = ctx;

    try {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      this.drawSky(ctx, w, h);
      this.drawCity(ctx, w, h);
      this.drawRoad(ctx, w, h);
      this.drawCoins(ctx, w, h);
      this.drawObstacles(ctx, w, h);
      this.drawPlayer(ctx, w, h);
    } catch (error) {
      // Never leave the player with a blank canvas because one optional drawing API failed.
      if (performance.now() - this.lastDrawError > 1000) {
        this.lastDrawError = performance.now();
        console.warn('Road Rush renderer recovered from a draw error.', error);
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#071522';
      ctx.fillRect(0, 0, pixelW, pixelH);
      ctx.fillStyle = '#15344b';
      ctx.fillRect(0, Math.floor(pixelH * 0.50), pixelW, Math.floor(pixelH * 0.50));
    }
  }

  private drawSky(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const horizon = h * 0.50;
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, '#020a18');
    sky.addColorStop(.42, '#0b2945');
    sky.addColorStop(.82, '#1b5877');
    sky.addColorStop(1, '#4b8997');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, horizon + 2);

    const sunX = w * .78, sunY = h * .19, sunR = Math.min(w, h) * .085;
    const glow = ctx.createRadialGradient(sunX, sunY, sunR * .25, sunX, sunY, sunR * 2.8);
    glow.addColorStop(0, 'rgba(255,220,150,.28)'); glow.addColorStop(1, 'rgba(255,220,150,0)');
    ctx.fillStyle = glow; ctx.fillRect(sunX - sunR * 3, sunY - sunR * 3, sunR * 6, sunR * 6);
    ctx.fillStyle = 'rgba(255,224,163,.22)'; ctx.beginPath(); ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = 'rgba(207,229,237,.16)';
    for (let i = 0; i < 6; i++) {
      const x = (i * 311 + this.elapsed * (5 + i)) % (w + 260) - 130, y = 48 + (i % 3) * 45;
      ctx.beginPath(); ctx.ellipse(x, y, 45, 11, 0, 0, Math.PI * 2); ctx.ellipse(x + 35, y + 4, 33, 9, 0, 0, Math.PI * 2); ctx.ellipse(x - 30, y + 4, 27, 8, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#071a2b'; ctx.beginPath(); ctx.moveTo(0, horizon);
    for (let x = 0; x <= w; x += 90)ctx.lineTo(x, horizon - (28 + ((x * 7) % 65)));
    ctx.lineTo(w, horizon); ctx.closePath(); ctx.fill();
    const haze = ctx.createLinearGradient(0, horizon - 30, 0, horizon + 45);
    haze.addColorStop(0, 'rgba(137,207,215,.04)'); haze.addColorStop(.5, 'rgba(150,222,220,.28)'); haze.addColorStop(1, 'rgba(30,73,82,.04)');
    ctx.fillStyle = haze; ctx.fillRect(0, horizon - 30, w, 75);
  }

  private drawCity(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const horizon = h * .515;
    ctx.fillStyle = '#0a2134'; ctx.beginPath(); ctx.moveTo(0, horizon);
    for (let x = 0; x <= w; x += 48)ctx.lineTo(x, horizon - (34 + ((x * 19) % 100)));
    ctx.lineTo(w, horizon); ctx.closePath(); ctx.fill();
    for (let x = -20; x < w + 40; x += 58) {
      const seed = Math.abs((x * 17) | 0), bh = 55 + (seed % 120);
      ctx.fillStyle = (x / 58) % 2 ? '#0d2a40' : '#102f47'; ctx.fillRect(x, horizon - bh, 46, bh);
      ctx.fillStyle = 'rgba(255,216,120,.55)';
      for (let r = 0; r < Math.floor((bh - 16) / 17); r++) {
        if ((r + Math.floor(x / 58)) % 4 === 0) continue;
        const yy = horizon - bh + 10 + r * 17; ctx.fillRect(x + 8, yy, 5, 7); ctx.fillRect(x + 29, yy, 5, 7);
      }
    }
    ctx.fillStyle = 'rgba(111,189,194,.32)'; ctx.fillRect(0, horizon - 1, w, 3);
  }

  private drawRoad(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const hz = h * .505, bottom = h * 1.08;
    const ground = ctx.createLinearGradient(0, hz, 0, h);
    ground.addColorStop(0, '#5b9ca3'); ground.addColorStop(.45, '#2f626b'); ground.addColorStop(1, '#101b21');
    ctx.fillStyle = ground; ctx.fillRect(0, hz, w, h - hz);

    ctx.fillStyle = '#151b20'; ctx.beginPath(); ctx.moveTo(w * .40, hz); ctx.lineTo(w * .60, hz); ctx.lineTo(w * 1.06, bottom); ctx.lineTo(-.06 * w, bottom); ctx.closePath(); ctx.fill();
    const road = ctx.createLinearGradient(0, hz, 0, bottom);
    road.addColorStop(0, '#343d44'); road.addColorStop(.28, '#272f36'); road.addColorStop(1, '#171d22');
    ctx.fillStyle = road; ctx.beginPath(); ctx.moveTo(w * .405, hz); ctx.lineTo(w * .595, hz); ctx.lineTo(w * 1.04, bottom); ctx.lineTo(-.04 * w, bottom); ctx.closePath(); ctx.fill();

    ctx.strokeStyle = '#f0c85b'; ctx.lineWidth = Math.max(3, w / 480); ctx.beginPath();
    ctx.moveTo(w * .395, hz); ctx.lineTo(-.03 * w, bottom); ctx.moveTo(w * .605, hz); ctx.lineTo(1.03 * w, bottom); ctx.stroke();

    // Racing curb along both edges: makes the drivable boundary unmistakable at a glance.
    for (let i = 0; i < 18; i++) {
      const t = i / 18, p = t * t, y = hz + p * (bottom - hz), half = w * (.095 + .505 * p), segW = Math.max(2, w * .014 * (.35 + p));
      const nextP = Math.min(1, (i + 1) / 18) ** 2, nextY = hz + nextP * (bottom - hz), segH = Math.max(1, nextY - y + 1);
      ctx.fillStyle = i % 2 === 0 ? '#e6402f' : '#f2f0e6';
      ctx.fillRect(w * .5 - half - segW, y, segW, segH);
      ctx.fillRect(w * .5 + half, y, segW, segH);
    }

    ctx.strokeStyle = 'rgba(255,239,174,.55)'; ctx.lineWidth = Math.max(2, w / 720);
    for (let i = 0; i < 15; i++) {
      const t = i / 15, y = hz + t * (bottom - hz), half = w * (.045 + .475 * t);
      ctx.beginPath(); ctx.moveTo(w * .5 - half, y); ctx.lineTo(w * .5 - half + 12 + t * 10, y);
      ctx.moveTo(w * .5 + half, y); ctx.lineTo(w * .5 + half - 12 - t * 10, y); ctx.stroke();
    }

    for (const laneX of [.333, .667]) {
      for (let i = 0; i < 10; i++) {
        const t1 = ((i / 10) + this.worldScroll * .32) % 1, t2 = Math.min(1, t1 + .055 + t1 * .025);
        const p1 = t1 * t1, p2 = t2 * t2;
        const x1 = w * .5 + (laneX - .5) * w * (.18 + .82 * p1), x2 = w * .5 + (laneX - .5) * w * (.18 + .82 * p2);
        const y1 = hz + p1 * (bottom - hz), y2 = hz + p2 * (bottom - hz);
        ctx.strokeStyle = 'rgba(255,247,213,.92)'; ctx.lineWidth = 2.5 + p1 * 5;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      }
    }

    for (let i = 0; i < 34; i++) {
      const t = (i / 34 + this.worldScroll * .08) % 1, p = t * t, y = hz + p * (bottom - hz), x = (i * 173 + Math.floor(this.worldScroll * 20) * 7) % Math.max(1, w);
      const roadWidthAtY = w * (.08 + .92 * p), rx = w * .5 + ((x % w) - w / 2) * Math.min(1, roadWidthAtY / (w * .5));
      ctx.fillStyle = i % 3 === 0 ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.12)'; ctx.fillRect(rx, y, 1 + p * 2, 1 + p * 2);
    }

    for (let i = 0; i < 9; i++) {
      const t = (i / 9 + this.worldScroll * .18) % 1, p = t * t, y = hz + p * (bottom - hz), half = w * (.075 + .46 * p), postH = 10 + p * 55;
      for (const side of [-1, 1]) {
        const x = w * .5 + side * half; ctx.strokeStyle = 'rgba(18,28,34,.85)'; ctx.lineWidth = 2 + p * 2;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - postH); ctx.stroke();
        ctx.fillStyle = 'rgba(255,225,130,.9)'; ctx.beginPath(); ctx.arc(x, y - postH, 2 + p * 3, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  private project(lane: number, z: number, w: number, h: number): { x: number; y: number; s: number } {
    const t = Math.max(0, Math.min(1, z)), p = t * t, roadHalf = w * (.095 + .505 * p);
    return { x: w * .5 + (lane - 1) * roadHalf * .74, y: h * .505 + p * h * .53, s: .14 + p * 1.55 };
  }

  private drawCoins(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    for (const coin of this.roadCoins) {
      const p = this.project(coin.lane, coin.z, w, h), r = 5.5 + p.s * 3.5;
      ctx.save(); ctx.translate(p.x, p.y - r * 1.5);
      const squash = .35 + Math.abs(Math.sin(this.elapsed * 5 + coin.z * 10)) * .65; ctx.scale(squash, 1);
      ctx.shadowColor = '#ffd34d'; ctx.shadowBlur = 14 * Math.min(1.5, p.s);
      const g = ctx.createRadialGradient(-r * .25, -r * .25, 1, 0, 0, r * 1.3);
      g.addColorStop(0, '#fff5a8'); g.addColorStop(.35, '#ffd13d'); g.addColorStop(1, '#c98516');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
      ctx.strokeStyle = '#fff3a2'; ctx.lineWidth = Math.max(1, p.s); ctx.stroke();
      ctx.fillStyle = '#a96a0d'; ctx.font = `${Math.max(6, r * 1.05)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('¢', 0, 1);
      ctx.restore();
    }
  }

  private drawObstacles(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    for (const o of this.obstacles) {
      const p = this.project(o.lane, o.z, w, h), s = p.s; ctx.save(); ctx.translate(p.x, p.y);
      ctx.fillStyle = 'rgba(0,0,0,.32)'; ctx.beginPath(); ctx.ellipse(0, 7 * s, 34 * s, 8 * s, 0, 0, Math.PI * 2); ctx.fill();
      if (o.kind === 'cone') {
        const g = ctx.createLinearGradient(-18 * s, -38 * s, 18 * s, 12 * s); g.addColorStop(0, '#ffd49a'); g.addColorStop(.25, '#ff8b28'); g.addColorStop(1, '#d94216');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -38 * s); ctx.lineTo(-19 * s, 12 * s); ctx.lineTo(19 * s, 12 * s); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#fff0cf'; ctx.fillRect(-12 * s, -3 * s, 24 * s, 6 * s); ctx.fillStyle = '#8f351d'; ctx.fillRect(-22 * s, 11 * s, 44 * s, 6 * s);
      } else if (o.kind === 'barrier') {
        ctx.fillStyle = '#121820'; ctx.fillRect(-31 * s, 4 * s, 62 * s, 10 * s);
        const g = ctx.createLinearGradient(-30 * s, -28 * s, 30 * s, 0); g.addColorStop(0, '#b92c2c'); g.addColorStop(.5, '#f04c3d'); g.addColorStop(1, '#a82428');
        ctx.fillStyle = g; ctx.fillRect(-31 * s, -28 * s, 62 * s, 32 * s); ctx.fillStyle = '#ffe06a'; ctx.save(); ctx.rotate(-.13); ctx.fillRect(-32 * s, -17 * s, 64 * s, 7 * s); ctx.restore();
        ctx.fillStyle = '#0b1016'; ctx.fillRect(-22 * s, 3 * s, 7 * s, 14 * s); ctx.fillRect(15 * s, 3 * s, 7 * s, 14 * s);
      } else this.drawTrafficCar(ctx, s, o.color);
      ctx.restore();
    }
  }


  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    const rr = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
    ctx.beginPath();
    ctx.moveTo(x + rr, y); ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr); ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr); ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
  }

  private drawTrafficCar(ctx: CanvasRenderingContext2D, s: number, color: string): void {
    ctx.shadowColor = 'rgba(0,0,0,.48)'; ctx.shadowBlur = 13 * s; ctx.fillStyle = '#07090c';
    ctx.fillRect(-31 * s, -5 * s, 7 * s, 20 * s); ctx.fillRect(24 * s, -5 * s, 7 * s, 20 * s);
    const body = ctx.createLinearGradient(-28 * s, 0, 28 * s, 0); body.addColorStop(0, '#5a0d1d'); body.addColorStop(.12, color); body.addColorStop(.5, color); body.addColorStop(.88, color); body.addColorStop(1, '#5a0d1d');
    ctx.fillStyle = body; this.roundRect(ctx, -27 * s, -43 * s, 54 * s, 58 * s, 10 * s); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#101b28'; this.roundRect(ctx, -20 * s, -34 * s, 40 * s, 23 * s, 8 * s); ctx.fill();
    const glass = ctx.createLinearGradient(0, -33 * s, 0, -12 * s); glass.addColorStop(0, '#bceef4'); glass.addColorStop(1, '#345468');
    ctx.fillStyle = glass; this.roundRect(ctx, -17 * s, -31 * s, 34 * s, 18 * s, 6 * s); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.moveTo(0, -29 * s); ctx.lineTo(0, -14 * s); ctx.stroke();
    ctx.fillStyle = '#ff344d'; this.roundRect(ctx, -22 * s, 5 * s, 10 * s, 6 * s, 2 * s); ctx.fill(); this.roundRect(ctx, 12 * s, 5 * s, 10 * s, 6 * s, 2 * s); ctx.fill();
    ctx.fillStyle = '#f7e4a4'; ctx.fillRect(-21 * s, 6 * s, 4 * s, 3 * s); ctx.fillRect(17 * s, 6 * s, 4 * s, 3 * s);
  }


  private drawPlayer(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // Keep the player car visually proportional to the road on desktop and mobile.
    // V6 used min(w,h)/430, which made the car enormous on large screens.
    const s = Math.min(1.00, Math.max(0.62, Math.min(w, h) / 800));
    const y = h * (0.86 + this.playerY);
    // The road narrows toward the horizon, so the car's steerable width must shrink
    // to match whatever depth it's currently drawn at — otherwise dragging the car
    // "back" (up) lets it render past the painted road edge, off the bridge.
    const hz = h * 0.505, bottom = h * 1.08;
    const depth = Math.max(0, Math.min(1, (y - hz) / (bottom - hz)));
    const roadHalf = w * (0.095 + 0.505 * depth * depth);
    const x = w * 0.5 + (this.lane - 1) * roadHalf * 0.70;
    const selected = this.gs.avatar();
    const isBike = selected === '🏍️';
    const palette: Record<string, { body: string; dark: string; glass: string; accent: string }> = {
      '🏎️': { body: '#e92d4b', dark: '#9b142f', glass: '#86d8ea', accent: '#ffd45a' },
      '🚗': { body: '#268fff', dark: '#1355a4', glass: '#a9ecf5', accent: '#f7f7f0' },
      '🚙': { body: '#6d7787', dark: '#384352', glass: '#bdeaf0', accent: '#ffd45a' },
      '🚕': { body: '#ffc83d', dark: '#c98a13', glass: '#9fe1ed', accent: '#fff2b0' },
      '🚓': { body: '#edf2f7', dark: '#1c55a0', glass: '#a8e6f2', accent: '#ff4157' },
      '🏍️': { body: '#ef3f5c', dark: '#6e1429', glass: '#bdebf2', accent: '#ffd45a' },
      '🚘': { body: '#31c5c9', dark: '#087c91', glass: '#b8f5f7', accent: '#fff1b0' },
      '🏁': { body: '#20252c', dark: '#090b0e', glass: '#c8dce0', accent: '#ffffff' }
    };
    const paint = palette[selected] || palette['🏎️'];

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);

    // Ground shadow.
    ctx.save();
    ctx.scale(1.35, 0.42);
    const shadow = ctx.createRadialGradient(0, 14, 5, 0, 14, 62);
    shadow.addColorStop(0, 'rgba(0,0,0,.62)');
    shadow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = shadow;
    ctx.beginPath(); ctx.ellipse(0, 15, 58, 20, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    if (isBike) {
      // Compact motorcycle variant.
      ctx.fillStyle = '#080b10';
      ctx.beginPath(); ctx.arc(-25, 15, 13, 0, Math.PI * 2); ctx.arc(25, 15, 13, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2a3038';
      ctx.beginPath(); ctx.arc(-25, 15, 6, 0, Math.PI * 2); ctx.arc(25, 15, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = paint.body;
      this.roundRect(ctx, -12, -40, 24, 60, 9); ctx.fill();
      ctx.fillStyle = paint.dark;
      this.roundRect(ctx, -17, -12, 34, 24, 9); ctx.fill();
      ctx.fillStyle = paint.glass;
      this.roundRect(ctx, -10, -35, 20, 20, 7); ctx.fill();
      ctx.fillStyle = paint.accent;
      ctx.fillRect(-8, -43, 16, 5);
      ctx.restore();
      return;
    }

    // Wheels first, so the body sits naturally over them.
    const tire = (tx: number) => {
      ctx.fillStyle = '#05070a';
      this.roundRect(ctx, tx - 10, -28, 20, 66, 9); ctx.fill();
      ctx.fillStyle = '#27313d';
      this.roundRect(ctx, tx - 5, -20, 10, 48, 5); ctx.fill();
    };
    tire(-47); tire(47);

    // Vehicle body shape changes slightly by selected avatar.
    const bodyWidth = selected === '🚙' ? 98 : selected === '🚘' ? 88 : 90;
    const bodyHeight = selected === '🚙' ? 100 : 92;
    const body = ctx.createLinearGradient(-55, 0, 55, 0);
    body.addColorStop(0, paint.dark);
    body.addColorStop(.2, paint.body);
    body.addColorStop(.5, paint.body);
    body.addColorStop(.82, paint.body);
    body.addColorStop(1, paint.dark);
    ctx.fillStyle = body;
    this.roundRect(ctx, -bodyWidth / 2, -62, bodyWidth, bodyHeight, selected === '🚙' ? 18 : 22); ctx.fill();

    // Side highlight.
    ctx.fillStyle = 'rgba(255,255,255,.16)';
    this.roundRect(ctx, -bodyWidth / 2 + 7, -55, 8, 72, 4); ctx.fill();

    // Cabin / roof.
    ctx.fillStyle = paint.dark;
    ctx.beginPath();
    const roofTop = selected === '🚙' ? -98 : -92;
    ctx.moveTo(-32, -60); ctx.lineTo(-23, roofTop + 12);
    ctx.quadraticCurveTo(0, roofTop, 23, roofTop + 12);
    ctx.lineTo(32, -60); ctx.closePath(); ctx.fill();

    // Windshield.
    ctx.fillStyle = paint.glass;
    ctx.beginPath();
    ctx.moveTo(-24, roofTop + 9); ctx.lineTo(24, roofTop + 9);
    ctx.lineTo(29, -53); ctx.quadraticCurveTo(0, -45, -29, -53); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 2; ctx.stroke();

    // Police lights / taxi roof sign.
    if (selected === '🚓') {
      ctx.fillStyle = '#ff4058'; this.roundRect(ctx, -14, roofTop - 6, 12, 6, 2); ctx.fill();
      ctx.fillStyle = '#36a9ff'; this.roundRect(ctx, 2, roofTop - 6, 12, 6, 2); ctx.fill();
    } else if (selected === '🚕') {
      ctx.fillStyle = '#fff0a0'; this.roundRect(ctx, -13, roofTop - 5, 26, 7, 3); ctx.fill();
      ctx.fillStyle = '#a86d08'; ctx.fillRect(-5, roofTop - 3, 10, 3);
    }

    // Windshield divider.
    ctx.strokeStyle = 'rgba(10,24,34,.72)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, roofTop + 11); ctx.lineTo(0, -51); ctx.stroke();

    // Rear lamps.
    ctx.fillStyle = '#ff3049';
    this.roundRect(ctx, -36, 0, 24, 9, 4); ctx.fill();
    this.roundRect(ctx, 12, 0, 24, 9, 4); ctx.fill();

    // Sport spoiler is kept smaller on ordinary cars.
    if (selected === '🏎️' || selected === '🏁') {
      ctx.fillStyle = '#151b22';
      this.roundRect(ctx, -48, -24, 96, 8, 4); ctx.fill();
      ctx.fillRect(-38, -19, 6, 15); ctx.fillRect(32, -19, 6, 15);
    }

    // Front/rear bumper and plate details.
    ctx.fillStyle = '#202b34'; this.roundRect(ctx, -20, 12, 40, 10, 3); ctx.fill();
    ctx.fillStyle = paint.accent; ctx.fillRect(-12, 15, 24, 3);

    // A subtle neon underglow makes the selected vehicle readable at speed.
    ctx.shadowColor = paint.body; ctx.shadowBlur = 14;
    ctx.fillStyle = paint.body;
    ctx.fillRect(-28, 28, 56, 3);
    ctx.shadowBlur = 0;

    ctx.restore();
  }

  private resizeCanvas(): void { const c = this.canvas?.nativeElement; if (!c) return; const rect = c.getBoundingClientRect(); if (rect.width < 2 || rect.height < 2) return; this.draw(); }
  private observeCanvas(): void { if (!this.canvas?.nativeElement || typeof ResizeObserver === 'undefined') return; this.resizeObserver?.disconnect(); this.resizeObserver = new ResizeObserver(() => this.resizeCanvas()); this.resizeObserver.observe(this.canvas.nativeElement); }
}
