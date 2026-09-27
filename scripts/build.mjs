import { build } from "esbuild";
import { copyFile, mkdir, readFile, rm, stat } from "node:fs/promises";
import bundles from "../src/bundles.json" with { type: "json" };

const common = {
  outdir: "dist",
  bundle: true,
  format: "iife",
  target: "firefox128",
  legalComments: "external",
  logLevel: "warning",
};

/** AMO's linter won't parse a file over 5 MB, and a file it can't parse can't be signed. */
const MAX_FILE_BYTES = 5 * 1024 * 1024;

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

// ELK, Mermaid's largest dependency, would take the Mermaid bundle over MAX_FILE_BYTES, so it's
// built as its own file (dist/elk.js, injected first) and the Mermaid bundle reads it from a global.
const elkFromGlobal = {
  name: "elk-from-global",
  setup(build) {
    build.onResolve({ filter: /^elkjs(\/|$)/ }, () => ({ path: "elkjs", namespace: "elk-global" }));
    build.onLoad({ filter: /.*/, namespace: "elk-global" }, () => ({
      contents: `module.exports = globalThis.${bundles.elkGlobal};`,
      loader: "js",
    }));
  },
};

await rm("dist", { recursive: true, force: true });
await mkdir("dist");
await build({ ...common, entryPoints: { content: "src/content.ts", background: "src/background.ts", popup: "src/popup.ts" } });
// Mermaid is several megabytes, so only its bundles are minified; our own scripts stay readable.
await build({
  ...common,
  entryPoints: { elk: "src/elk-bundle.ts" },
  minify: true,
  plugins: [elkUsesSandboxGlobal],
});
// Lodash finds the global object via `global`, then `self`, then `Function("return this")()`.
// In a Firefox content script `self` is an Xray of the page window, so that check fails and the
// extension CSP blocks the `Function` fallback. Pointing `global` at the sandbox's `globalThis`
// stops it before the fallback.
await build({
  ...common,
  entryPoints: { mermaid: "src/mermaid-bundle.ts" },
  minify: true,
  define: { global: "globalThis" },
  plugins: [elkFromGlobal],
});
await copyFile("src/manifest.json", "dist/manifest.json");
await copyFile("src/popup.html", "dist/popup.html");

for (const file of bundles.injectedFiles) {
  const { size } = await stat(`dist/${file}`);
  if (size > MAX_FILE_BYTES) throw new Error(`dist/${file} is ${size} bytes, over AMO's ${MAX_FILE_BYTES}-byte limit`);
}
