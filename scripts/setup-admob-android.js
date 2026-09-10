// `cap add android` (re)generates android/ from a template and it isn't
// committed to git, so manual native edits are lost the next time someone
// runs it fresh. The Google Mobile Ads SDK (via @capacitor-community/admob)
// crashes the app on startup unless AndroidManifest.xml carries the AdMob
// App ID meta-data, which in turn needs an `admob_app_id` string in
// strings.xml. This script re-applies both after android/ is (re)created.
const fs = require('fs');
const path = require('path');

const androidRoot = path.join(__dirname, '..', 'android');

// Google's public sample AdMob App ID — safe while every ad unit ID in the app is still a
// test ID (see src/app/config/admob.config.ts). Replace with this app's own App ID from the
// AdMob console (Apps -> Add app) before a production release.
const ADMOB_APP_ID = 'ca-app-pub-3940256099942544~3347511713';

function fixStrings() {
  const stringsPath = path.join(androidRoot, 'app', 'src', 'main', 'res', 'values', 'strings.xml');
  if (!fs.existsSync(stringsPath)) {
    console.warn(`strings.xml not found at ${stringsPath} - skipping admob_app_id fix.`);
    return;
  }

  const contents = fs.readFileSync(stringsPath, 'utf8');
  if (contents.includes('admob_app_id')) {
    console.log('admob_app_id already present in strings.xml');
    return;
  }

  const updated = contents.replace(
    '</resources>',
    `    <!-- Google's public sample AdMob App ID — safe to ship while every ad unit ID in the\n` +
      `         app is still a test ID (see src/app/config/admob.config.ts). Before a production\n` +
      `         release, replace this with this app's own App ID from the AdMob console (Apps ->\n` +
      `         Add app). -->\n` +
      `    <string name="admob_app_id">${ADMOB_APP_ID}</string>\n</resources>`
  );

  if (updated === contents) {
    console.warn('Could not locate </resources> closing tag - admob_app_id not added.');
    return;
  }

  fs.writeFileSync(stringsPath, updated);
  console.log(`Added admob_app_id to ${path.relative(process.cwd(), stringsPath)}`);
}

function fixManifest() {
  const manifestPath = path.join(androidRoot, 'app', 'src', 'main', 'AndroidManifest.xml');
  if (!fs.existsSync(manifestPath)) {
    console.warn(`AndroidManifest.xml not found at ${manifestPath} - skipping AdMob APPLICATION_ID fix.`);
    return;
  }

  const manifest = fs.readFileSync(manifestPath, 'utf8');
  if (manifest.includes('com.google.android.gms.ads.APPLICATION_ID')) {
    console.log('AdMob APPLICATION_ID meta-data already present in AndroidManifest.xml');
    return;
  }

  const updated = manifest.replace(
    '</application>',
    `        <!-- AdMob App ID, read from strings.xml (admob_app_id). Required — the Google\n` +
      `             Mobile Ads SDK crashes the app on startup if this meta-data is missing. -->\n` +
      `        <meta-data android:name="com.google.android.gms.ads.APPLICATION_ID" android:value="@string/admob_app_id" />\n    </application>`
  );

  if (updated === manifest) {
    console.warn('Could not locate </application> closing tag - AdMob APPLICATION_ID not added.');
    return;
  }

  fs.writeFileSync(manifestPath, updated);
  console.log(`Added AdMob APPLICATION_ID meta-data to ${path.relative(process.cwd(), manifestPath)}`);
}

fixStrings();
fixManifest();
