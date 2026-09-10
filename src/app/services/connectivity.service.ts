import { Injectable, signal } from '@angular/core';

/**
 * Tracks whether the device currently has a network connection. Ad revenue funds this app's
 * economy, so gameplay and rewards are blocked outright while offline rather than letting the
 * player earn anything that was never going to be backed by a real ad request.
 */
@Injectable({ providedIn: 'root' })
export class ConnectivityService {
  readonly online = signal(typeof navigator === 'undefined' ? true : navigator.onLine);

  constructor() {
    if (typeof window === 'undefined') return;
    window.addEventListener('online', () => this.online.set(true));
    window.addEventListener('offline', () => this.online.set(false));
  }

  /** Re-reads the browser's connectivity flag directly, for a manual "Try again" action. */
  recheck(): void {
    if (typeof navigator !== 'undefined') this.online.set(navigator.onLine);
  }
}
