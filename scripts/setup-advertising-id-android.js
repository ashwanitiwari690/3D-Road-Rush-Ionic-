// `cap add android` (re)generates android/ from a template and it isn't
// committed to git, so manual native edits are lost the next time someone
// runs it fresh. The Earnivo app-promotion verification feature (see
// AppVerificationService) needs a real Google Advertising ID, which requires:
//   1. The AD_ID permission in AndroidManifest.xml (targetSdk 33+ otherwise
//      returns an all-zero id), and
//   2. A `playServicesAdsId` version variable in variables.gradle, which
//      @capacitor-community/advertising-id's build.gradle references.
// This script re-applies both after android/ is (re)created.
const fs = require('fs');
const path = require('path');

const androidRoot = path.join(__dirname, '..', 'android');

function fixManifest() {
  const manifestPath = path.join(androidRoot, 'app', 'src', 'main', 'AndroidManifest.xml');
  if (!fs.existsSync(manifestPath)) {
    console.warn(`AndroidManifest.xml not found at ${manifestPath} - skipping AD_ID permission fix.`);
    return;
  }

  const manifest = fs.readFileSync(manifestPath, 'utf8');
  if (manifest.includes('com.google.android.gms.permission.AD_ID')) {
    console.log('AD_ID permission already present in AndroidManifest.xml');
    return;
  }

  const updated = manifest.replace(
    '</manifest>',
    `    <!-- Required so AdvertisingIdClient can return a real Google Advertising ID\n` +
      `         (targetSdk 33+ returns an all-zero ID without this) for Earnivo app-promotion verification. -->\n` +
      `    <uses-permission android:name="com.google.android.gms.permission.AD_ID" />\n</manifest>`
  );

  if (updated === manifest) {
    console.warn('Could not locate </manifest> closing tag - AD_ID permission not added.');
    return;
  }

  fs.writeFileSync(manifestPath, updated);
  console.log(`Added AD_ID permission to ${path.relative(process.cwd(), manifestPath)}`);
}

function fixVariablesGradle() {
  const gradlePath = path.join(androidRoot, 'variables.gradle');
  if (!fs.existsSync(gradlePath)) {
    console.warn(`variables.gradle not found at ${gradlePath} - skipping playServicesAdsId fix.`);
    return;
  }

  const contents = fs.readFileSync(gradlePath, 'utf8');
  if (contents.includes('playServicesAdsId')) {
    console.log('playServicesAdsId already present in variables.gradle');
    return;
  }

  const updated = contents.replace(
    /\n}\s*$/,
    `\n    // Required by @capacitor-community/advertising-id (Earnivo app-verification feature).\n    playServicesAdsId = '18.2.0'\n}\n`
  );

  if (updated === contents) {
    console.warn('Could not locate closing "}" in variables.gradle - playServicesAdsId not added.');
    return;
  }

  fs.writeFileSync(gradlePath, updated);
  console.log(`Added playServicesAdsId to ${path.relative(process.cwd(), gradlePath)}`);
}

fixManifest();
fixVariablesGradle();
