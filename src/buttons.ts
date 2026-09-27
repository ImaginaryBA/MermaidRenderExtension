/**
 * The extension's buttons, shared by the controls beside each block and the Diagram Viewer: a navy
 * gradient pill for the Render Toggle and round icon buttons for everything else. Icons are drawn in
 * CSS, so each button's text (or `aria-label`) is exactly its label.
 */

const WHITE = "linear-gradient(#fff, #fff)";
/** A white bar of the given size at a background position within the icon. */
const bar = (position: string, width: string, height: string) => `${WHITE} ${position} / ${width} ${height} no-repeat`;
const PLUS = [bar("center", "8px", "1.5px"), bar("center", "1.5px", "8px")].join(", ");
const MINUS = bar("center", "8px", "1.5px");

export const BUTTON_STYLE = `
button {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer;
  font: 500 13px/1 system-ui, sans-serif; letter-spacing: 0.01em; color: #fff;
  border: 1px solid #3d8bf033; border-radius: 999px;
  background: linear-gradient(90deg, #16233d 0%, #1a4f8f 55%, #1f74d6 100%);
  box-shadow: 0 2px 8px #0b1a3366, inset 0 1px 0 #ffffff1f;
  transition: opacity 0.1s, filter 0.1s, box-shadow 0.1s;
}
button:hover:not([aria-disabled="true"]) { filter: brightness(1.12); box-shadow: 0 3px 12px #0b1a3380, inset 0 1px 0 #ffffff26; }
button:active:not([aria-disabled="true"]) { filter: brightness(0.95); }
button:focus-visible { outline: 2px solid #7cb7ff; outline-offset: 2px; }
button[aria-disabled="true"] { cursor: default; filter: saturate(0.4); }
.toggle { padding: 5px 16px 5px 5px; }
.icon { width: 30px; height: 30px; padding: 0; background: #16233d; }
/* The ring every icon sits in. Its 8px content box is where the icon's bars are drawn. Each icon's "background"
   shorthand resets "background-origin", so every icon rule sets it again. */
.toggle::before, .icon::before {
  content: ""; flex: none; width: 18px; height: 18px; padding: 3.5px; box-sizing: border-box;
  border: 1.5px solid #fff; border-radius: 50%; background-origin: content-box;
}
.toggle::before, .zoom-in::before { background: ${PLUS}; background-origin: content-box; }
.toggle[aria-pressed="true"]::before, .zoom-out::before { background: ${MINUS}; background-origin: content-box; }
/* Fit: a width marker, |—|. */
.fit::before {
  background: ${[bar("center", "100%", "1.5px"), bar("left center", "1.5px", "6px"), bar("right center", "1.5px", "6px")].join(", ")};
  background-origin: content-box;
}
/* Open the Diagram Viewer: four corner brackets, the usual "full screen" symbol. */
.open-viewer::before {
  background: ${["left top", "right top", "left bottom", "right bottom"]
    .flatMap((corner) => [bar(corner, "3px", "1.5px"), bar(corner, "1.5px", "3px")])
    .join(", ")};
  background-origin: content-box;
}
/* Close: a cross. */
.close::before {
  background:
    linear-gradient(45deg, transparent 44%, #fff 44%, #fff 56%, transparent 56%) no-repeat,
    linear-gradient(-45deg, transparent 44%, #fff 44%, #fff 56%, transparent 56%) no-repeat;
  background-origin: content-box;
}
`;

/**
 * A round icon button labelled for assistive technology. It's marked unavailable with `aria-disabled`
 * rather than `disabled`, so a button that reaches a limit keeps keyboard focus; clicks are then ignored.
 */
export function iconButton(doc: Document, label: string, icon: string, onClick: () => void): HTMLButtonElement {
  const el = doc.createElement("button");
  el.type = "button";
  el.className = `icon ${icon}`;
  el.setAttribute("aria-label", label);
  el.title = label;
  el.addEventListener("click", () => {
    if (el.getAttribute("aria-disabled") !== "true") onClick();
  });
  return el;
}
