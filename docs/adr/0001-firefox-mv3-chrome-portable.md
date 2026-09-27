# Firefox Manifest V3, limited to APIs Chrome also supports

Firefox is the only target for now, but a Chrome port is likely. We build on Manifest V3 and use only the extension APIs and manifest keys that Chrome's MV3 also supports. Porting later should then be a packaging change rather than a rewrite. Firefox-only MV2 conveniences, such as persistent background pages and blocking webRequest, are deliberately off the table even where they would be simpler.

Keys that only Firefox supports are allowed when Chrome ignores them; see [ADR 0004](0004-firefox-only-manifest-keys-chrome-ignores.md).
