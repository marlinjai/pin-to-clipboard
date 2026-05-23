import sharp from "sharp";
import { readFile, access } from "node:fs/promises";

// Manifest toolbar icons (16/48/128): SVG-derived, transparent background -
// stays sharp at 16x16 and reads well against Chrome's toolbar in both
// light and dark mode.
const svg = await readFile("src/assets/icon.svg");
for (const size of [16, 48, 128]) {
  await sharp(svg, { density: 512 })
    .resize(size, size)
    .png()
    .toFile(`src/assets/icon-${size}.png`);
  console.log(`wrote src/assets/icon-${size}.png`);
}

// Web Store dashboard store icon (128x128): rendered from the AI source if
// present (a higher-fidelity glossy version with subtle depth and a soft
// shadow on white). Falls back to the SVG-derived 128 PNG when not present.
const aiSource = "src/assets/icon-source.jpg";
try {
  await access(aiSource);
  await sharp(aiSource)
    .resize(128, 128, { fit: "cover", position: "center" })
    .png({ compressionLevel: 9 })
    .toFile("src/assets/store-icon.png");
  console.log(`wrote src/assets/store-icon.png (from ${aiSource})`);
} catch {
  await sharp(svg, { density: 512 })
    .resize(128, 128)
    .png()
    .toFile("src/assets/store-icon.png");
  console.log("wrote src/assets/store-icon.png (from SVG fallback)");
}
