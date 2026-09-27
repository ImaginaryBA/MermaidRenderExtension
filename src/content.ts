import { mermaidRenderer } from "./adapters/mermaid-renderer";
import { storageSettings } from "./adapters/storage-settings";
import { answerPopup, mount } from "./controller";
import { isPopupMessage } from "./messages";

const mounted = mount(document, { renderer: mermaidRenderer(), settings: storageSettings() });

// Answered with sendResponse and `return true` rather than a returned Promise, which Chrome's MV3 doesn't support (ADR 0001).
browser.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (!isPopupMessage(message)) return false;
  // If mounting failed there's nothing to report, but the popup still gets an answer rather than waiting forever.
  mounted.then(
    (page) => sendResponse(answerPopup(page, message)),
    () => sendResponse(undefined),
  );
  return true;
});
