import sharp from "sharp";
import { readFile } from "node:fs/promises";

const svg = await readFile("src/assets/icon.svg");
const sizes = [16, 48, 128];

for (const size of sizes) {
  await sharp(svg, { density: 512 })
    .resize(size, size)
    .png()
    .toFile(`src/assets/icon-${size}.png`);
  console.log(`wrote src/assets/icon-${size}.png`);
}
