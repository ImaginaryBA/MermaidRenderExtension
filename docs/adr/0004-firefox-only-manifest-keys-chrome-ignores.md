# Firefox-only manifest keys are allowed when Chrome ignores them

ADR 0001 limits the extension to manifest keys Chrome's MV3 also supports. Signing for Firefox needs `browser_specific_settings.gecko`, though: the add-on ID, the minimum Firefox version and the data-collection declaration. Chrome doesn't support that key, but it ignores it with a warning rather than rejecting the manifest.

We allow Firefox-only manifest keys that Chrome ignores, and nothing more. The rule behind ADR 0001 still holds: porting to Chrome must be a packaging change, never a rewrite. A key Chrome would reject, or code that depends on Firefox-only behaviour, is still off the table.

## Consequences

- `browser_specific_settings` stays in `src/manifest.json`. A Chrome build can drop it or leave it in.
- The same reasoning covers `background.scripts` next to `background.service_worker`: Firefox uses the first, Chrome the second, and each ignores the other.
