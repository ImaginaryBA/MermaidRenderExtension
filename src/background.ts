import { LOAD_MERMAID } from "./messages";

browser.runtime.onMessage.addListener((message: unknown, sender) => {
  const tabId = sender.tab?.id;
  if ((message as { type?: unknown })?.type !== LOAD_MERMAID || tabId === undefined) return;
  return browser.scripting
    .executeScript({ target: { tabId, frameIds: [sender.frameId ?? 0] }, files: ["mermaid.js"] })
    .then(() => true);
});
