import type { Settings } from "../ports";

/** Reads the user's settings from extension storage. */
export function storageSettings(): Settings {
  return {
    async isSiteDisabled(hostname) {
      const { disabledSites } = await browser.storage.local.get("disabledSites");
      return Array.isArray(disabledSites) && disabledSites.includes(hostname);
    },
  };
}
