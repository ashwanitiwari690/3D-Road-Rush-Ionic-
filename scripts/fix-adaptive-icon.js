// @capacitor/assets always writes the Android adaptive-icon XML with a 16.7%
// inset on BOTH the background and foreground layers. Insetting the background
// leaves a transparent ring between it and the actual launcher mask (circle,
// squircle, etc.), so the icon shows up as a small graphic floating inside an
// empty/wallpaper-colored circle. The background layer should fill its full
// bounds edge-to-edge instead; only the foreground needs the safe-zone inset.
// This script re-writes the generated XML after each `assets:generate` run so
// the fix survives regeneration (the android/ project itself isn't committed).
const fs = require('fs');
const path = require('path');

const FIXED_XML = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background" />
    <foreground>
        <inset android:drawable="@mipmap/ic_launcher_foreground" android:inset="16.7%" />
    </foreground>
</adaptive-icon>
`;

const mipmapAnyDir = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res', 'mipmap-anydpi-v26');
const targets = ['ic_launcher.xml', 'ic_launcher_round.xml'];

let fixedAny = false;
for (const name of targets) {
  const file = path.join(mipmapAnyDir, name);
  if (fs.existsSync(file)) {
    fs.writeFileSync(file, FIXED_XML);
    fixedAny = true;
    console.log(`Fixed adaptive icon background inset in ${path.relative(process.cwd(), file)}`);
  }
}

if (!fixedAny) {
  console.warn(`No adaptive icon XML found under ${mipmapAnyDir} - did the android project get generated?`);
}
