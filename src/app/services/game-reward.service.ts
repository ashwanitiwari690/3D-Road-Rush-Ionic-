import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, map, of, shareReplay, throwError } from 'rxjs';
import { REWARD_CONFIG } from '../config/reward.config';

/** One entry of GET /api/games — the live Admin-configured conversion rule for a game. */
export interface GameConfig {
  code: string;
  name: string;
  minimumCoins: number;
  coinsPerConversion: number;
  rupeesPerConversion: number;
}

/** Shape of games.service.ts#redeemGameReward's success payload. */
export interface RedeemGameRewardData {
  gameCode: string;
  gameName: string;
  coinsSubmitted: number;
  coinsRedeemed: number;
  coinsPerConversion: number;
  rupeesPerConversion: number;
  /** Money string, e.g. "15.00" — backend is authoritative for this value. */
  amountCredited: string;
  transactionId: string;
  idempotencyKey: string;
  status: string;
  createdAt: string;
  newWalletBalance: string;
}

export interface RedeemApiError {
  errorCode: string;
  message: string;
}

interface ApiSuccessEnvelope<T> { success: true; data: T; }
interface ApiErrorEnvelope { success: false; error: { code: string; message: string } }

/**
 * Thin client for the existing centralized Earnivo Game Reward API
 * (nodejs/src/modules/games in the Main Platform backend). This service
 * does not implement or own the API contract, the conversion rate, or any
 * wallet logic — it only calls the already-built endpoints. No new backend,
 * API, or wallet system is introduced here.
 */
@Injectable({ providedIn: 'root' })
export class GameRewardService {
  private http = inject(HttpClient);

  /** Cached for the lifetime of the app session so Profile doesn't re-fetch on every open. */
  private gamesRequest$?: Observable<GameConfig[]>;

  /** Live config for this game (minimumCoins/coinsPerConversion/rupeesPerConversion), or undefined if unknown/inactive. */
  getGameConfig(): Observable<GameConfig | undefined> {
    if (!this.gamesRequest$) {
      this.gamesRequest$ = this.http.get<ApiSuccessEnvelope<GameConfig[]>>(`${REWARD_CONFIG.apiBaseUrl}/games`).pipe(
        map(res => res.data),
        catchError(() => { this.gamesRequest$ = undefined; return of<GameConfig[]>([]); }),
        shareReplay(1)
      );
    }
    return this.gamesRequest$.pipe(map(games => games.find(g => g.code === REWARD_CONFIG.gameCode)));
  }

  redeemCoins(mobileNumber: string, coins: number, idempotencyKey: string): Observable<RedeemGameRewardData> {
    const body = { gameCode: REWARD_CONFIG.gameCode, mobileNumber, coins, idempotencyKey };
    return this.http.post<ApiSuccessEnvelope<RedeemGameRewardData>>(`${REWARD_CONFIG.apiBaseUrl}/game-rewards/redeem`, body).pipe(
      map(res => res.data),
      catchError((error: HttpErrorResponse) => throwError(() => this.normalizeError(error)))
    );
  }

  private normalizeError(error: HttpErrorResponse): RedeemApiError {
    const body = error.error as Partial<ApiErrorEnvelope> | null;
    if (body?.error?.code) {
      return { errorCode: body.error.code, message: body.error.message || body.error.code };
    }
    if (error.status === 0) {
      return { errorCode: 'NETWORK_ERROR', message: 'Network error. Please check your connection and try again.' };
    }
    return { errorCode: 'UNKNOWN_ERROR', message: 'Something went wrong. Please try again.' };
  }
}
