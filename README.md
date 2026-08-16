# 3D Road Rush

Angular 20 + Ionic 8 endless driving game optimized for mobile.

## Current build
- 30 progressive levels
- 10-coin run entry
- Persistent coin wallet
- Rewarded AdMob coin reward with a **2-hour cooldown**
- Countdown shown in Coin Center and all reward buttons
- Improved canvas 3D-style road, traffic and player car
- Stable canvas sizing with ResizeObserver to prevent disappearing backgrounds
- Smooth lane buttons, swipe, A/D and arrow-key controls
- Sound effects + looping music
- Settings: sound, music, vibration
- Editable player name + avatar
- Daily 50-coin bonus
- Prepared for future server-side coin → ₹ conversion

## Run
Node 24.x is recommended (project engine is set to >=24).

```bash
npm install
npm run build
npm start
```

## AdMob
Use Google test rewarded IDs while developing. Configure the native Capacitor AdMob plugin and production ad unit IDs before release. The cooldown is client-side UI protection only; real money/coin balances and reward eligibility should be enforced server-side.
