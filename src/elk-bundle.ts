// ELK, the layout engine Mermaid uses for some diagrams, is built as its own file because together
// they'd be over AMO's 5 MB file limit (see scripts/build.mjs). The background script injects this
// before the Mermaid bundle, which reads ELK from this global.
import ELK from "elkjs/lib/elk.bundled.js";
import bundles from "./bundles.json";

(globalThis as Record<string, unknown>)[bundles.elkGlobal] = ELK;
