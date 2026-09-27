import { build } from "esbuild";
import { copyFile, mkdir, readFile, rm } from "node:fs/promises";

const common = {
  outdir: "dist",
  bundle: true,
  format: "iife",
  target: "firefox128",
  legalComments: "external",
  logLevel: "warning",
};

// In a Firefox content script `window` is an Xray of the page window, and Xrays hide
// function-valued properties of plain objects, so ELK's `$wnd.Math.max` is undefined.
// The sandbox's own `globalThis` has the real built-ins.
const elkUsesSandboxGlobal = {
  name: "elk-uses-sandbox-global",
  setup(build) {
    build.onLoad({ filter: /[\\/]elkjs[\\/]lib[\\/]elk\.bundled\.js$/ }, async ({ path }) => {
      const source = await readFile(path, "utf8");
      const patched = source.replace("$wnd = window", "$wnd = globalThis");
      if (patched === source) throw new Error(`elkjs no longer contains "$wnd = window": ${path}`);
      return { contents: patched, loader: "js" };
    });
  },
};

await rm("dist", { recursive: true, force: true });
await mkdir("dist");
await build({ ...common, entryPoints: { content: "src/content.ts", background: "src/background.ts" } });
// Mermaid is several megabytes, so only its bundle is minified; our own scripts stay readable.
// Lodash finds the global object via `global`, then `self`, then `Function("return this")()`.
// In a Firefox content script `self` is an Xray of the page window, so that check fails and the
// extension CSP blocks the `Function` fallback. Pointing `global` at the sandbox's `globalThis`
// stops it before the fallback.
await build({
  ...common,
  entryPoints: { mermaid: "src/mermaid-bundle.ts" },
  minify: true,
  define: { global: "globalThis" },
  plugins: [elkUsesSandboxGlobal],
});
await copyFile("src/manifest.json", "dist/manifest.json");
