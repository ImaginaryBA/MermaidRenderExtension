// Signs the built extension (dist/) through AMO's unlisted channel, producing a .xpi to install by hand.
// Run with `npm run sign`, which builds and tests first. Credentials come only from the environment:
// WEB_EXT_API_KEY and WEB_EXT_API_SECRET (from addons.mozilla.org → Developer Hub → Manage API Keys).
import { execFileSync } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import webExt from "web-ext";

const apiKey = process.env.WEB_EXT_API_KEY;
const apiSecret = process.env.WEB_EXT_API_SECRET;
if (!apiKey || !apiSecret) {
  console.error("Set WEB_EXT_API_KEY and WEB_EXT_API_SECRET to your AMO API credentials first (see README.md, Release).");
  process.exit(1);
}

// AMO needs the readable source of bundled, minified code. It's taken from the last commit, so the
// working tree must match it, or the source would differ from what was built and signed.
const changes = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim();
if (changes) {
  console.error("Commit or stash your changes first, so the source sent to AMO matches this build:\n" + changes);
  process.exit(1);
}

const { version } = JSON.parse(await readFile("src/manifest.json", "utf8"));
const artifactsDir = "web-ext-artifacts";
const sourceArchive = `${artifactsDir}/mermaid-render-${version}-source.zip`;
await mkdir(artifactsDir, { recursive: true });
execFileSync("git", ["archive", "--format=zip", `--output=${sourceArchive}`, "HEAD"]);

console.log(`Signing version ${version} through the unlisted channel…`);
await webExt.cmd.sign({
  sourceDir: "dist",
  artifactsDir,
  channel: "unlisted",
  apiKey,
  apiSecret,
  uploadSourceCode: sourceArchive,
});
