// Signs the built extension (dist/) through AMO's unlisted channel, producing a .xpi to install by hand.
// Run with `npm run sign`, which builds and tests first. Credentials come only from the environment:
// WEB_EXT_API_KEY and WEB_EXT_API_SECRET (from addons.mozilla.org → Developer Hub → Manage API Keys).
import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

if (!process.env.WEB_EXT_API_KEY || !process.env.WEB_EXT_API_SECRET) {
  throw new Error("Set WEB_EXT_API_KEY and WEB_EXT_API_SECRET to your AMO API credentials first (see README.md, Release).");
}

// AMO needs the readable source of bundled, minified code. It's taken from the last commit, so the
// working tree must match it, or the source would differ from what was built and signed.
const changes = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim();
if (changes) {
  throw new Error(`Commit or stash your changes first, so the source sent to AMO matches this build:\n${changes}`);
}

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const { version } = await readJson("src/manifest.json");
const { version: packageVersion } = await readJson("package.json");
if (version !== packageVersion) {
  throw new Error(`src/manifest.json is version ${version} but package.json is ${packageVersion}; bump both to the same version.`);
}

const artifactsDir = "web-ext-artifacts";
const sourceArchive = `${artifactsDir}/mermaid-render-${version}-source.zip`;
await mkdir(artifactsDir, { recursive: true });
execFileSync("git", ["archive", "--format=zip", `--output=${sourceArchive}`, "HEAD"]);

// The web-ext command line rather than its Node API, which leaves out the command line's defaults
// (such as AMO's address and the timeouts). It reads WEB_EXT_API_KEY and WEB_EXT_API_SECRET itself.
console.log(`Signing version ${version} through the unlisted channel…`);
// web-ext doesn't export its command-line entry point, so it's found in node_modules directly.
const webExt = fileURLToPath(new URL("../node_modules/web-ext/bin/web-ext.js", import.meta.url));
const signing = spawnSync(
  process.execPath,
  [webExt, "sign", "--channel", "unlisted", "--source-dir", "dist", "--artifacts-dir", artifactsDir, "--upload-source-code", sourceArchive],
  { stdio: "inherit" },
);
if (signing.status !== 0) throw new Error(`web-ext sign failed (exit code ${signing.status}); see its output above.`);
