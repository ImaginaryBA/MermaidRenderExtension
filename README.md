# Mermaid Render

A Firefox extension that finds the Mermaid Blocks on a web page and lets you swap each one for the Diagram it describes, one block at a time. It finds code blocks labelled as Mermaid, unlabelled code that starts with a Mermaid diagram keyword, and ```` ```mermaid ```` fences typed as plain text (as on wiki pages). Diagrams can be zoomed inline or opened full screen in the Diagram Viewer. The toolbar popup can switch every block on the page at once (Render all, Show all code), or turn the extension off for a site.

The words used here (Mermaid Block, Render Toggle, Diagram Viewer, Disabled Site…) are defined in [CONTEXT.md](CONTEXT.md).

## Install

Mermaid Render is signed by Mozilla but not listed on addons.mozilla.org, so you install the `.xpi` file yourself. It needs Firefox 128 or later.

1. Get the signed `mermaid-render-<version>.xpi` (see [Release](#release)).
2. In Firefox, open `about:addons`, click the gear menu, and choose **Install Add-on From File…**. Pick the `.xpi`.
3. Firefox's install prompt asks for access to your data for all websites. Accept it: the extension needs it to find Mermaid Blocks. Pages that were already open need a reload.

If you later revoke that access (`about:addons` → Mermaid Render → Permissions), the toolbar popup offers **Allow on all websites** to grant it again. Firefox usually closes the popup when its prompt opens, so reopen the popup afterwards.

Updates are installed the same way, over the top of the old version. Your settings are kept.

## Development

Needs Node.js (see `package-lock.json`) and Firefox.

```sh
npm ci
npm run check   # typecheck, tests, build into dist/, and web-ext lint (which fails on errors, not warnings)
npm start       # builds, serves the repo over HTTP, and opens Firefox with the extension loaded
```

`npm start` opens `test-pages/mermaid-blocks.html` in a fresh Firefox profile with the extension installed temporarily. It reloads the extension when `dist/` changes, so run `npm run build` after an edit and refresh the page. The other manual test pages are `test-pages/presentation.html` and `test-pages/dynamic.html`, at the same address.

Code lives in `src/`. Tests (`test/`) run in jsdom through two seams: the Detector (`findMermaidBlocks`) and the page controller (`mount`, with fake renderer and settings). Real drawing, zoom, the viewer and the popup are checked by hand with the [manual test checklist](docs/manual-test-checklist.md). Decisions are recorded in [docs/adr/](docs/adr/). [AGENTS.md](AGENTS.md) and [docs/handoff.md](docs/handoff.md) describe how the work is done.

The build (`scripts/build.mjs`) bundles Mermaid into `dist/mermaid.js` and its ELK layout engine into `dist/elk.js`. They're separate because AMO won't sign a file over 5 MB, and the build fails if either gets that big. Both load only the first time a diagram is drawn.

## Release

Releases are signed through AMO's **unlisted** channel: Mozilla signs the `.xpi` so Firefox will install it, but it isn't published.

**Once:** create API credentials at [addons.mozilla.org → Developer Hub → Manage API Keys](https://addons.mozilla.org/developers/addon/api/key/). Keep them out of the repository. Set them as environment variables in your shell only:

```powershell
$env:WEB_EXT_API_KEY = "user:…"
$env:WEB_EXT_API_SECRET = "…"
```

**Each release:**

1. Bump `version` in `src/manifest.json` and `package.json` to the same new version. AMO never signs the same version twice, and `npm run sign` refuses if the two differ.
2. Run the [manual test checklist](docs/manual-test-checklist.md).
3. Commit.
4. Run `npm run sign`.

`npm run sign` runs `npm run check` first. It refuses to run with uncommitted changes. It then sends `dist/` to AMO together with a zip of the committed source, because AMO needs readable source for bundled, minified code. It waits for the signature, which usually takes a few minutes. The signed `.xpi` and the source zip end up in `web-ext-artifacts/`, which git ignores.

The add-on ID, `mermaid-render@imaginaryba`, is fixed forever. Every signed version must keep it.

## License

[Apache 2.0](LICENSE)
