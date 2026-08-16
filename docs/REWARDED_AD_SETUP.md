# Rewarded video setup

The Home page now includes a WATCH VIDEO button. The demo video is `src/assets/ads/rewarded-video.mp4`. Replace it with your future video using the same filename.

A successful full video completion credits exactly 100 coins and starts a 2-hour cooldown. The cooldown timestamp is persisted in localStorage, so closing/reopening the app keeps the cooldown.

For a real Android ad network integration, use Google AdMob rewarded ads. Google AdSense is primarily web advertising; rewarded Android video is normally handled through AdMob. In production, grant the 100 coins from the ad SDK's confirmed reward callback, not from simply opening or closing the ad.
