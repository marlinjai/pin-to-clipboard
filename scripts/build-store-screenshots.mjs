// Crops + resizes raw screenshots in screenshots/sources/ to 1280x800 PNGs
// at the repo root of screenshots/ (named 01.png, 02.png, ...). The Web Store
// requires exactly 1280x800 or 640x400 (aspect 1.6). sharp's fit:"cover"
// scales-to-fill and crops the overflow from the centre.
import sharp from "sharp";
import { readdir, mkdir } from "node:fs/promises";
import path from "node:path";

const SRC = "screenshots/sources";
const OUT = "screenshots";
const TARGET_W = 1280;
const TARGET_H = 800;

await mkdir(OUT, { recursive: true });
const files = (await readdir(SRC))
  .filter((f) => /\.(png|jpe?g)$/i.test(f))
  .sort();

if (files.length === 0) {
  console.log(`no source screenshots in ${SRC}/`);
  process.exit(0);
}

for (let i = 0; i < files.length; i++) {
  const src = path.join(SRC, files[i]);
  const dst = path.join(OUT, `${String(i + 1).padStart(2, "0")}.png`);
  await sharp(src)
    .resize({ width: TARGET_W, height: TARGET_H, fit: "cover", position: "center" })
    .png({ compressionLevel: 9 })
    .toFile(dst);
  console.log(`wrote ${dst} (from ${files[i]})`);
}
