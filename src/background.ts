import bundles from "./bundles.json";
import { LOAD_MERMAID, type LoadMermaidReply } from "./messages";

// Answered with sendResponse and `return true` rather than a returned Promise, which Chrome's MV3 doesn't support (ADR 0001).
browser.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  const tabId = sender.tab?.id;
  if ((message as { type?: unknown })?.type !== LOAD_MERMAID || tabId === undefined) return false;
  browser.scripting
    .executeScript({ target: { tabId, frameIds: [sender.frameId ?? 0] }, files: bundles.injectedFiles })
    .then(
      () => sendResponse(true satisfies LoadMermaidReply),
      (error: unknown) => sendResponse({ error: String(error) } satisfies LoadMermaidReply),
    );
  return true;
});
