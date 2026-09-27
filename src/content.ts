import { mermaidRenderer } from "./adapters/mermaid-renderer";
import { storageSettings } from "./adapters/storage-settings";
import { mount } from "./controller";
import { answerPopup, isPopupMessage } from "./messages";

const mounted = mount(document, { renderer: mermaidRenderer(), settings: storageSettings() });

// Answered with sendResponse and `return true` rather than a returned Promise, which Chrome's MV3 doesn't support (ADR 0001).
browser.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (!isPopupMessage(message)) return false;
  void mounted.then((page) => sendResponse(answerPopup(page, message)));
  return true;
});
