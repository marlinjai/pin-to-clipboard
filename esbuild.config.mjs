import { build, context } from "esbuild";
import { cp, mkdir } from "node:fs/promises";

const watch = process.argv.includes("--watch");
const common = {
  bundle: true,
  format: "esm",
  target: "chrome120",
  outdir: "dist",
  logLevel: "info",
  sourcemap: true,
};

const entries = [
  { entryPoints: ["src/background/index.ts"], outdir: "dist/background" },
  { entryPoints: ["src/content/index.ts"], outdir: "dist/content" },
  { entryPoints: ["src/options/options.ts"], outdir: "dist/options" },
];

async function copyStatic() {
  await mkdir("dist", { recursive: true });
  await cp("src/manifest.json", "dist/manifest.json");
  await cp("src/options/options.html", "dist/options/options.html");
  await cp("src/assets", "dist/assets", { recursive: true });
}

await copyStatic();
if (watch) {
  for (const e of entries) (await context({ ...common, ...e })).watch();
} else {
  for (const e of entries) await build({ ...common, ...e });
}
