import type { Settings } from "../ports";

/** The storage key holding the hostnames of Disabled Sites. */
const DISABLED_SITES = "disabledSites";

async function disabledSites(): Promise<string[]> {
  const { [DISABLED_SITES]: sites } = await browser.storage.local.get(DISABLED_SITES);
  return Array.isArray(sites) ? sites : [];
}

/** Reads the user's settings from extension storage. */
export function storageSettings(): Settings {
  return {
    async isSiteDisabled(hostname) {
      return (await disabledSites()).includes(hostname);
    },
    onChange(listener) {
      const onChanged = (changes: Record<string, unknown>, area: string) => {
        if (area === "local" && DISABLED_SITES in changes) listener();
      };
      browser.storage.onChanged.addListener(onChanged);
      return () => browser.storage.onChanged.removeListener(onChanged);
    },
  };
}

/** Turns the extension off (or back on) for a site; every open tab of the site follows through `onChange`. */
export async function setSiteDisabled(hostname: string, disabled: boolean): Promise<void> {
  const others = (await disabledSites()).filter((site) => site !== hostname);
  await browser.storage.local.set({ [DISABLED_SITES]: disabled ? [...others, hostname] : others });
}
