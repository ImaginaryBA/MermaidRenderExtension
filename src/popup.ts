import { BUTTON_STYLE } from "./buttons";
import type { BlockView } from "./controller";
import { GET_BLOCK_COUNT, SET_ALL_VIEWS, type PopupMessage, type PopupReply } from "./messages";
import { strings } from "./strings";

/**
 * The toolbar popup: how many Mermaid Blocks the current tab has, and the two Bulk Actions. It asks the
 * tab's content script through extension messaging; where no content script is running, it explains why.
 */

const STYLE = `
${BUTTON_STYLE}
:root { color-scheme: light dark; }
body { margin: 0; width: 280px; padding: 14px 16px 16px; font: 13px/1.45 system-ui, sans-serif; }
h1 { margin: 0 0 8px; font-size: 14px; font-weight: 600; }
p { margin: 0; }
.actions { display: flex; gap: 8px; margin-top: 12px; }
.actions button { flex: 1; padding: 8px 12px; }
`;

const style = document.createElement("style");
style.textContent = STYLE;
const title = document.createElement("h1");
title.textContent = strings.popupTitle;
const status = document.createElement("p");
status.setAttribute("role", "status");
document.head.append(style);
document.body.append(title, status);

void showTab();

async function showTab(): Promise<void> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  const reply = tab?.id === undefined ? undefined : await ask(tab.id, { type: GET_BLOCK_COUNT });
  if (!reply) {
    status.textContent = canRunOn(tab?.url) ? strings.reloadPage : strings.restrictedPage;
    return;
  }
  showCount(reply.count);
  if (reply.count === 0) return;

  const actions = document.createElement("div");
  actions.className = "actions";
  const bulkAction = (label: string, view: BlockView) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", async () => {
      const after = await ask(tab.id!, { type: SET_ALL_VIEWS, view });
      if (after) showCount(after.count);
    });
    return button;
  };
  actions.append(bulkAction(strings.renderAll, "diagram"), bulkAction(strings.showAllCode, "code"));
  document.body.append(actions);
}

function showCount(count: number): void {
  status.textContent = count === 0 ? strings.noBlocks : count === 1 ? strings.oneBlock : strings.manyBlocks.replace("{count}", String(count));
}

/** Sends `message` to the tab's content script; undefined if none is running there to answer. */
async function ask(tabId: number, message: PopupMessage): Promise<PopupReply | undefined> {
  try {
    return (await browser.tabs.sendMessage(tabId, message)) as PopupReply | undefined;
  } catch {
    return undefined;
  }
}

/**
 * Whether the extension's content script runs on pages like this one, so a page without it just needs
 * reloading. Browser pages, add-on stores and the like are off limits; their URL is also hidden from
 * the extension, so an unknown URL counts as off limits too.
 */
function canRunOn(url: string | undefined): boolean {
  if (!url) return false;
  const { protocol, hostname } = new URL(url);
  const stores = ["addons.mozilla.org", "chromewebstore.google.com"];
  return ["http:", "https:", "file:"].includes(protocol) && !stores.includes(hostname);
}
