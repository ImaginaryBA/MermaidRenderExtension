import { build } from "esbuild";
import { copyFile, mkdir, rm } from "node:fs/promises";

const common = {
  outdir: "dist",
  bundle: true,
  format: "iife",
  target: "firefox128",
  legalComments: "external",
  logLevel: "warning",
};

await rm("dist", { recursive: true, force: true });
await mkdir("dist");
await build({ ...common, entryPoints: { content: "src/content.ts", background: "src/background.ts" } });
// Mermaid is several megabytes, so only its bundle is minified; our own scripts stay readable.
await build({ ...common, entryPoints: { mermaid: "src/mermaid-bundle.ts" }, minify: true });
await copyFile("src/manifest.json", "dist/manifest.json");
