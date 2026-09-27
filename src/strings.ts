/**
 * Every piece of user-facing text, kept in one place for later translation. The one exception is the
 * extension's name in manifest.json, which the browser shows as the toolbar button's tooltip; it moves
 * to _locales when the extension is translated.
 */
export const strings = {
  showDiagram: "Show diagram",
  showCode: "Show code",
  rendering: "Rendering diagram…",
  renderError: "Could not render this diagram.",
  sourceRepaired: "Some spaces or quotes in this block were fixed before drawing, which may be related to the error.",
  errorDetails: "Details",
  notSvg: "Mermaid did not produce an SVG image.",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  fitToWidth: "Fit to width",
  openViewer: "Open full screen",
  viewerLabel: "Diagram viewer",
  fitToWindow: "Fit to window",
  closeViewer: "Close",
  popupTitle: "Mermaid Render",
  noBlocks: "No Mermaid blocks on this page.",
  oneBlock: "1 Mermaid block on this page.",
  /** "{count}" is replaced with the number of blocks. */
  manyBlocks: "{count} Mermaid blocks on this page.",
  renderAll: "Render all",
  showAllCode: "Show all code",
  restrictedPage: "Mermaid Render can't run on this page. Browser pages and add-on stores are off limits to extensions, and the extension may not be allowed on this site.",
  notRunningHere: "Mermaid Render isn't running on this page. If the page is still loading, or was open before the extension was installed or updated, reload it.",
  siteDisabled: "Mermaid Render is turned off for this site.",
  /** "{site}" is replaced with the site's hostname. */
  runOnSite: "Run Mermaid Render on {site}",
  needsAccess: "Mermaid Render needs permission to read the pages you visit, so it can find Mermaid code on them.",
  grantAccess: "Allow on all websites",
} as const;
