import type { Settings } from "../ports";

/**
 * Each Disabled Site is its own storage key, so turning two sites off at once (say, from popups in two
 * windows) can never lose one of the writes, as a shared list read and written back could.
 */
const DISABLED_PREFIX = "disabled:";
const keyFor = (hostname: string) => DISABLED_PREFIX + hostname;

/** Whether the user has turned the extension off for `hostname`. */
export async function isSiteDisabled(hostname: string): Promise<boolean> {
  const key = keyFor(hostname);
  const { [key]: disabled } = await browser.storage.local.get(key);
  return disabled === true;
}

/** Turns the extension off (or back on) for a site; every open tab of the site follows through `onChange`. */
export async function setSiteDisabled(hostname: string, disabled: boolean): Promise<void> {
  if (disabled) await browser.storage.local.set({ [keyFor(hostname)]: true });
  else await browser.storage.local.remove(keyFor(hostname));
}

/** Reads the user's settings from extension storage. */
export function storageSettings(): Settings {
  return {
    isSiteDisabled,
    onChange(listener) {
      const onChanged = (changes: Record<string, unknown>, area: string) => {
        if (area === "local" && Object.keys(changes).some((key) => key.startsWith(DISABLED_PREFIX))) listener();
      };
      browser.storage.onChanged.addListener(onChanged);
      return () => browser.storage.onChanged.removeListener(onChanged);
    },
  };
}
