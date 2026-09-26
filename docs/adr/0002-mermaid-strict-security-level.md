# Render with Mermaid's `strict` security level

The Mermaid Source comes from arbitrary web pages, and the extension draws it with its own privileges. Mermaid's `strict` level turns off click handlers and HTML labels and sanitizes text, so a hostile page can't use a Diagram to run script. As a result, diagrams that rely on `click` links or HTML labels render in a simplified form. We accept that trade-off; don't loosen the level to "fix" such diagrams.
