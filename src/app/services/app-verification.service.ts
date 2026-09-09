import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, catchError, of } from 'rxjs';
import { Capacitor } from '@capacitor/core';
import { AdvertisingId } from '@capacitor-community/advertising-id';
import { APP_VERIFICATION_CONFIG } from '../config/app-verification.config';

const NO_AD_ID = '00000000-0000-0000-0000-000000000000';

interface ApiSuccessEnvelope<T> { success: true; data: T; }

export interface AppVerificationData {
  status: string;
  rewardAmount: string;
}

/**
 * Confirms this device to Earnivo so a pending "App Promotion" task started
 * inside the Earnivo app gets credited automatically once this app is opened.
 * See APP_PROMOTION_VERIFICATION_INTEGRATION.md for the full contract: this
 * call is meant to be made on every launch and is harmless/idempotent when
 * there is nothing to verify - a 422 is the normal "nothing pending" outcome,
 * not a failure, so nothing is ever surfaced to the player either way.
 */
@Injectable({ providedIn: 'root' })
export class AppVerificationService {
  private http = inject(HttpClient);

  async confirmInstall(): Promise<void> {
    const platform = Capacitor.getPlatform();
    if (platform === 'web') return; // Advertising ID is native-only

    if (!APP_VERIFICATION_CONFIG.apiKey) {
      console.warn('[AppVerification] Skipped: no Earnivo apiKey configured for this campaign.');
      return;
    }

    try {
      if (platform === 'ios') {
        await AdvertisingId.requestTracking();
      }
      const { id } = await AdvertisingId.getAdvertisingId();
      if (!id || id === NO_AD_ID) return; // tracking denied/unsupported on this device

      await this.confirm(id);
    } catch (error) {
      console.warn('[AppVerification] Could not read the device advertising ID', error);
    }
  }

  private async confirm(advertisingId: string): Promise<void> {
    const body = { apiKey: APP_VERIFICATION_CONFIG.apiKey, advertisingId };
    const result = await firstValueFrom(
      this.http
        .post<ApiSuccessEnvelope<AppVerificationData>>(`${APP_VERIFICATION_CONFIG.apiBaseUrl}/app-verification/confirm`, body)
        .pipe(
          catchError((error: HttpErrorResponse) => {
            if (error.status !== 422) {
              console.warn('[AppVerification] confirm call failed', error.status, error.error);
            }
            return of(null);
          })
        )
    );

    if (result) {
      console.log('[AppVerification] Reward confirmed with Earnivo', result.data);
    }
  }
}
