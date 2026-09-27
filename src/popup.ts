import { isSiteDisabled, setSiteDisabled } from "./adapters/storage-settings";
import type { BlockView } from "./block-view";
import { BUTTON_STYLE } from "./buttons";
import { GET_BLOCK_COUNT, SET_ALL_VIEWS, type PopupMessage, type PopupReply } from "./messages";
import { strings } from "./strings";

/**
 * The toolbar popup. It first makes sure the extension may read the current page: Firefox treats the
 * all-sites host permission as optional, so it asks for it with one click when it's missing. Then it
 * shows the current site's on/off switch (a Disabled Site when off), how many Mermaid Blocks the tab
 * has, and the two Bulk Actions. It asks the tab's content script through extension messaging; where
 * no content script is running, it explains why.
 */

const ALL_SITES = { origins: ["<all_urls>"] };
/** After the switch changes, the tab is asked this many times, this far apart, until it has followed. */
const FOLLOW_ATTEMPTS = 20;
const FOLLOW_INTERVAL_MS = 50;

/** Shows what the tab answered: its count and Bulk Actions, or why there are none. */
type ShowReply = (reply: PopupReply | undefined) => void;

const STYLE = `
${BUTTON_STYLE}
:root { color-scheme: light dark; }
body { margin: 0; width: 280px; padding: 14px 16px 16px; font: 13px/1.45 system-ui, sans-serif; }
h1 { margin: 0 0 10px; font-size: 14px; font-weight: 600; }
p { margin: 0; }
.site { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.site-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; }
.switch { flex: none; width: 40px; height: 22px; padding: 0; position: relative; }
.switch::after {
  content: ""; position: absolute; top: 3px; left: 3px; width: 14px; height: 14px; border-radius: 50%;
  background: #fff; transition: transform 0.15s;
}
.switch[aria-checked="true"]::after { transform: translateX(18px); }
.switch[aria-checked="false"] { background: #6b7280; }
.actions { display: flex; gap: 8px; margin-top: 12px; }
.actions button, .grant { flex: 1; padding: 8px 12px; }
.grant { margin-top: 12px; width: 100%; }
`;

document.title = strings.popupTitle;
const style = document.createElement("style");
style.textContent = STYLE;
document.head.append(style);
const content = document.createElement("main");
document.body.append(content);

void show();

async function show(): Promise<void> {
  const title = element("h1", strings.popupTitle);
  content.replaceChildren(title);
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  // The extension only sees a tab's URL if it may access that site. Without the URL, it asks for access,
  // unless it already has it everywhere (then the tab is a browser page it can never run on).
  if (!tab?.url && !(await browser.permissions.contains(ALL_SITES))) return showAccessRequest();

  const tabId = tab?.id;
  const site = siteOf(tab?.url);
  const status = element("p", "");
  status.setAttribute("role", "status");
  const actions = document.createElement("div");
  actions.className = "actions";

  const showReply: ShowReply = (reply) => {
    actions.replaceChildren();
    if (!reply) {
      status.textContent = isWebPage(tab?.url) ? strings.notRunningHere : strings.restrictedPage;
    } else if (reply.siteDisabled) {
      status.textContent = strings.siteDisabled;
    } else {
      status.textContent = countText(reply.count);
      if (reply.count > 0 && tabId !== undefined) {
        actions.append(bulkAction(tabId, strings.renderAll, "diagram", showReply), bulkAction(tabId, strings.showAllCode, "code", showReply));
      }
    }
  };

  if (site) content.append(await siteSwitch(site, tabId, showReply));
  content.append(status, actions);
  showReply(tabId === undefined ? undefined : await ask(tabId, { type: GET_BLOCK_COUNT }));
}

/** The one-click request for the permission to read web pages, without which nothing else works. */
function showAccessRequest(): void {
  const grant = element("button", strings.grantAccess);
  grant.type = "button";
  grant.className = "grant";
  // permissions.request must run straight from the click, before anything else is awaited. Firefox
  // usually closes the popup when its prompt opens, so after granting, the popup is opened again.
  grant.addEventListener("click", () => {
    void browser.permissions.request(ALL_SITES).then((granted) => {
      if (granted) void show();
    });
  });
  content.append(element("p", strings.needsAccess), grant);
}

/** The switch that turns the extension on or off for `site`; the tab's answer after a change goes to `showReply`. */
async function siteSwitch(site: string, tabId: number | undefined, showReply: ShowReply): Promise<HTMLElement> {
  const row = document.createElement("div");
  row.className = "site";
  const name = element("span", site);
  name.className = "site-name";
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "switch";
  toggle.setAttribute("role", "switch");
  const label = strings.runOnSite.replace("{site}", site);
  toggle.setAttribute("aria-label", label);
  toggle.title = label;
  const setOn = (on: boolean) => toggle.setAttribute("aria-checked", String(on));
  setOn(!(await isSiteDisabled(site)));

  toggle.addEventListener("click", async () => {
    const on = toggle.getAttribute("aria-checked") !== "true";
    setOn(on);
    try {
      await setSiteDisabled(site, !on);
    } catch {
      // Not saved, so the switch goes back to what's really in effect.
      setOn(!on);
      return;
    }
    if (tabId !== undefined) showReply(await answerOnceFollowed(tabId, !on));
  });
  row.append(name, toggle);
  return row;
}

/**
 * Asks the tab for its count once it has followed the new setting. The tab hears of the change from
 * extension storage, independently of the popup, so this asks a few times until the answer agrees.
 */
async function answerOnceFollowed(tabId: number, disabled: boolean): Promise<PopupReply | undefined> {
  let reply: PopupReply | undefined;
  for (let attempt = 0; attempt < FOLLOW_ATTEMPTS; attempt++) {
    reply = await ask(tabId, { type: GET_BLOCK_COUNT });
    if (!reply || reply.siteDisabled === disabled) return reply;
    await new Promise((done) => setTimeout(done, FOLLOW_INTERVAL_MS));
  }
  return reply;
}

function bulkAction(tabId: number, label: string, view: BlockView, showReply: ShowReply): HTMLButtonElement {
  const button = element("button", label);
  button.type = "button";
  button.addEventListener("click", async () => showReply(await ask(tabId, { type: SET_ALL_VIEWS, view })));
  return button;
}

function countText(count: number): string {
  return count === 0 ? strings.noBlocks : count === 1 ? strings.oneBlock : strings.manyBlocks.replace("{count}", String(count));
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, text: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.textContent = text;
  return el;
}

/** Sends `message` to the tab's content script; undefined if none is running there to answer. */
async function ask(tabId: number, message: PopupMessage): Promise<PopupReply | undefined> {
  try {
    return (await browser.tabs.sendMessage(tabId, message)) as PopupReply | undefined;
  } catch {
    return undefined;
  }
}

/** Add-on stores, where browsers never let extensions run. */
const ADD_ON_STORES = ["addons.mozilla.org", "chromewebstore.google.com", "chrome.google.com", "microsoftedge.microsoft.com"];

/**
 * Whether this looks like an ordinary web page, where the content script normally runs. Browser pages
 * and add-on stores are off limits; the extension can't even see the URL of a page it may not access,
 * so an unknown URL counts as off limits too.
 */
function isWebPage(url: string | undefined): boolean {
  if (!url) return false;
  const { protocol, hostname } = new URL(url);
  return ["http:", "https:", "file:"].includes(protocol) && !ADD_ON_STORES.includes(hostname);
}

/** The site a Disabled Site setting applies to: the page's hostname (see CONTEXT.md), for web pages served from one. */
function siteOf(url: string | undefined): string | null {
  if (!url || !isWebPage(url)) return null;
  return new URL(url).hostname || null;
}
