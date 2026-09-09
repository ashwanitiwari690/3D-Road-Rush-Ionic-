import { environment } from '../../environments/environment';

/**
 * Config for the Earnivo "App Promotion" install-verification callback
 * (see APP_PROMOTION_VERIFICATION_INTEGRATION.md). apiKey is the per-campaign
 * key shown in the Earnivo agent panel - it is unrelated to REWARD_CONFIG.gameCode.
 */
export const APP_VERIFICATION_CONFIG = {
  apiBaseUrl: environment.apiBaseUrl,
  apiKey: environment.earnivoAppVerificationApiKey
} as const;
