import { describe, expect, test } from "vitest";
import { diagram, fakeRenderer, fakeSettings, isHidden, mountPage, toggles, waitFor } from "./page";

const MARKED = `<p>Intro</p><pre id="code"><code class="language-mermaid">graph TD; A-->B</code></pre><p>Outro</p>`;

describe("Render Toggle", () => {
  test("flipping the toggle shows the Diagram in place of the code", async () => {
    await mountPage(MARKED);

    toggles()[0].click();

    await waitFor(() => expect(diagram()?.textContent).toBe("graph TD; A-->B"));
    expect(isHidden(document.getElementById("code")!)).toBe(true);
  });

  test("flipping back restores the page's original content exactly", async () => {
    await mountPage(`<pre id="code" style="color: red"><code class="language-mermaid">graph TD; A-->B</code></pre>
      <pre id="plain"><code class="language-mermaid">graph TD; C-->D</code></pre>`);
    const before = [document.getElementById("code")!.outerHTML, document.getElementById("plain")!.outerHTML];

    for (const t of toggles()) t.click();
    await waitFor(() => expect(diagram(1)).not.toBeNull());
    for (const t of toggles()) t.click();

    expect([document.getElementById("code")!.outerHTML, document.getElementById("plain")!.outerHTML]).toEqual(before);
    expect(diagram(0)).toBeNull();
    expect(diagram(1)).toBeNull();
  });

  test("the toggle is a pressable button whose label names the view it switches to", async () => {
    await mountPage(MARKED);
    const [toggle] = toggles();

    expect(toggle.tagName).toBe("BUTTON");
    expect([toggle.getAttribute("aria-pressed"), toggle.textContent]).toEqual(["false", "Show diagram"]);
    toggle.click();
    expect([toggle.getAttribute("aria-pressed"), toggle.textContent]).toEqual(["true", "Show code"]);
  });

  test("each block's toggle is independent", async () => {
    await mountPage(`<pre id="one"><code class="language-mermaid">graph TD; one</code></pre>
      <pre id="two"><code class="language-mermaid">graph TD; two</code></pre>`);

    toggles()[1].click();

    await waitFor(() => expect(diagram(1)?.textContent).toBe("graph TD; two"));
    expect(diagram(0)).toBeNull();
    expect(isHidden(document.getElementById("one")!)).toBe(false);
  });

  test("flipping back before drawing finishes never shows a stale Diagram", async () => {
    let finish!: () => void;
    const slow = fakeRenderer();
    const render = slow.render;
    slow.render = async (source) => {
      await new Promise<void>((resolve) => (finish = resolve));
      return render(source);
    };
    await mountPage(MARKED, { renderer: slow });

    toggles()[0].click();
    toggles()[0].click();
    finish();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(diagram()).toBeNull();
    expect(isHidden(document.getElementById("code")!)).toBe(false);
  });

  test("a Render Error is shown instead of a Diagram when drawing fails", async () => {
    await mountPage(MARKED, { renderer: fakeRenderer(() => ({ ok: false, message: "Parse error on line 1" })) });

    toggles()[0].click();

    await waitFor(() => expect(document.querySelector("mermaid-render-block")!.shadowRoot!.textContent).toContain("Parse error on line 1"));
    expect(diagram()).toBeNull();
  });
});

describe("pages without Mermaid", () => {
  test("get no toggles and never draw anything", async () => {
    const renderer = fakeRenderer();
    await mountPage(`<pre><code class="language-js">const graph = 1;</code></pre>`, { renderer });

    expect(toggles()).toEqual([]);
    expect(renderer.calls).toEqual([]);
  });
});

describe("Disabled Site", () => {
  test("gets no toggles", async () => {
    await mountPage(MARKED, { settings: fakeSettings({ disabled: true }) });

    expect(toggles()).toEqual([]);
  });
});
