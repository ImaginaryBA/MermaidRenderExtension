# Handoff: Mermaid Render Extension

Written at the end of a cloud session, for continuing locally, starting with the first real test in Firefox. It links to the spec, tickets, glossary and ADRs rather than repeating them.

## Where things stand

- **`main` is at the squash merge of PR #18** and holds tickets #3–#6. The cloud session merged these PRs, all as squash merges: #1 (skills config), #15 (glossary and ADRs), #16 (walking skeleton), #17 (Render Errors and Source Repair) and #18 (Sniffed Blocks and Text Fences).
- **Spec:** issue #2. **Open tickets:** #7–#14, each a sub-issue of #2 that lists its blockers.
  - **Ready now:** #7, #8, #9, #10 and #11.
  - **Blocked:** #12 needs #9, #13 needs #10, and #14 needs Confluence samples.
- **Vocabulary and decisions:** `CONTEXT.md` (glossary) and `docs/adr/0001`–`0003`. ADR 0003 has a Consequences section describing exactly what hiding a block changes on the page.
- **Never run in Firefox.** The cloud container only had Chromium. The built scripts were smoke-tested there with the extension APIs stubbed, so the Firefox-specific wiring hasn't been exercised: the manifest, the background script, `scripting.executeScript` and storage.

## First: test in Firefox

```sh
npm ci
npm run check   # typecheck + 109 tests + build
npm start       # builds, serves the repo over HTTP, then web-ext opens Firefox on test-pages/mermaid-blocks.html
```

If the page shows **no toggles at all**:
1. **Site access:** the extension may not have been granted access to all sites. Firefox MV3 treats host permissions as optional. Open `about:addons` → Mermaid Render → Permissions and allow access to all websites. Handling this properly in the popup is #13.
2. **`file://` URLs:** content scripts may not run on local files, so `npm start` (`scripts/start.mjs`) serves the page over HTTP on a free port instead. If you open a test page by hand, use that `http://localhost:<port>/…` address.

**What to check on the test page:**
- [ ] Hovering over a block shows a "Show diagram" button in its top-right corner. Tab reaches it, and Enter or Space activates it.
- [ ] **Marked Blocks** (the flowchart and sequence diagram) draw, and "Show code" restores the original block exactly.
- [ ] The **invalid block** shows "Could not render this diagram." with Mermaid's line-numbered message under **Details**.
- [ ] The **curly-quote block** draws after Source Repair. The **invalid, repaired** block's error says that spaces or quotes were fixed.
- [ ] The **Sniffed Block** (`stateDiagram-v2` in an unlabelled `<pre>`) draws, and the **Graphviz** block has no toggle.
- [ ] The **paragraph Text Fence** shows its toggle at the opening line when you hover over any of its lines. Diagram View hides every line.
- [ ] The **`<br>` Text Fence** (a pie chart) draws, and the **Python fence** has no toggle.
- [ ] Mermaid loads only on the first click. In the page's Developer Tools → Debugger, the extension's scripts are listed under a `moz-extension://` source. `mermaid.js` should appear there only after the first "Show diagram".

**Firefox-specific risks, if something fails:**
- **"Mermaid failed to load."** means the background script injected `mermaid.js`, but the content script can't see the global it sets (`globalThis.mermaidRenderExtension`). The code assumes `scripting.executeScript` runs in the same isolated world as the content script. See `src/adapters/mermaid-renderer.ts`, `src/background.ts` and `src/mermaid-bundle.ts`.
- **Nothing happens on click:** check the add-on console for errors from `runtime.onMessage`. The background script returns a Promise from the listener, the Firefox style. That is fine in Firefox, but the Chrome port will need to change it.
- **`web-ext lint` errors:** `ADDON_ID_REQUIRED` and `FILE_TOO_LARGE` (the 5.3 MB `mermaid.js`) are known and belong to #11. See the comment on #11. They don't stop `web-ext run`.

## Then

1. **Report the Firefox results.** Fix anything broken before starting new tickets, because everything else builds on this wiring.
2. **Gather the Confluence Data Center samples #14 asks for:** the version number, and a saved HTML page containing a code macro, paragraph fences, and a fence in a table or panel. Read the comment on #14 first. It lists what to look for, including the syntax-highlighter risk.
3. **Pick up the ready tickets.** #8 (dynamic pages) and #7 (Editing Surfaces) matter most for Confluence. #11 unblocks signing.

## How the work has been done

- **Test-driven, at the two seams agreed in #2:**
  - **Seam 2 (Detector):** `findMermaidBlocks` in `src/detector.ts`, tested with HTML samples in `test/detector.test.ts`.
  - **Seam 1 (page controller):** `mount` in `src/controller.ts` with fake renderer and settings ports. Tests use the helpers in `test/page.ts`: `mountPage`, `toggles`, `hosts`, `diagram`, `renderError`, `isHidden`, `waitFor` and `settle` (waits past the rescan delay, for checks that nothing happened). `mountPage` unmounts the previous test's page, because `mount` keeps watching the shared document.
  - Real drawing, zoom and the popup are checked by hand.
- **Unicode test inputs** (non-breaking spaces, curly quotes, zero-width characters) are written as `\u` escapes in the source, never as raw characters, so they stay visible in diffs.
- **Per ticket:** work on a branch, run `npm run check`, run a two-axis review (standards and spec), then open a PR whose body says `Closes #N` and squash-merge it.
- **Chromium smoke tests** used Playwright to load `dist/content.js` into the test page, with a stub `window.browser` whose `runtime.sendMessage` injects `dist/mermaid.js` as a `<script>` tag. The script lived outside the repo. Recreate it if you want a quick check without Firefox.
- **Triage labels** from `docs/agents/triage-labels.md` still don't exist in the repo, so each ticket states its status in its body. Create the labels if you want to use the `triage` skill.

## Suggested skills

- `anthropic-skills:diagnosing-bugs`: if the Firefox test turns up failures.
- `anthropic-skills:implement` and `anthropic-skills:tdd`: for #7–#13, at the two seams above.
- `anthropic-skills:code-review`: two-axis review before each PR.
- `anthropic-skills:triage`: when the Confluence samples arrive (#14).
- `anthropic-skills:domain-modeling`: when a new term or hard-to-reverse decision comes up. Keep `CONTEXT.md` and `docs/adr/` current.
