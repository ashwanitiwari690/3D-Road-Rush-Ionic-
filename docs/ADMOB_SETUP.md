# Google AdMob Rewarded Ads Setup

The game has a native AdMob bridge adapter in `AppComponent.watchRewardedAd()`.

## 1. Install
```bash
npm install @capacitor-community/admob@7
npx cap sync android
```

## 2. Android Application ID
Add the AdMob application ID metadata under `<application>` in `android/app/src/main/AndroidManifest.xml`, and add the corresponding `admob_app_id` string in `android/app/src/main/res/values/strings.xml`.

## 3. Replace test Rewarded ID
The source currently uses Google's Android test rewarded ID:
`ca-app-pub-3940256099942544/5224354917`

Replace it with your real rewarded ad unit ID only after your AdMob app/ad unit is configured.

## 4. Reward rules
The client does not award coins merely because an ad modal was opened. Coins are granted only after the native rewarded-ad API returns a reward. For a future cash-conversion economy, move the authoritative balance and withdrawal ledger to your backend; do not trust localStorage for money.

## 5. Testing
Use Google's test ads during development to avoid invalid traffic/account problems. The browser build shows a labeled test fallback because native AdMob is unavailable in a normal web browser.
