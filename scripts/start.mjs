// Serves the repo over HTTP and opens Firefox on the test page with the built extension loaded.
// HTTP rather than file:// because content scripts may not run on local files.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import webExt from "web-ext";

const root = resolve(".");
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml" };

const server = createServer(async (req, res) => {
  const file = resolve(root, "." + decodeURIComponent(new URL(req.url, "http://localhost").pathname));
  if (!file.startsWith(root + sep)) return res.writeHead(403).end();
  try {
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": types[extname(file)] ?? "application/octet-stream" }).end(body);
  } catch {
    res.writeHead(404).end("Not found");
  }
});

// Port 0 picks a free port, so this never clashes with another server.
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const startUrl = `http://localhost:${server.address().port}/test-pages/mermaid-blocks.html`;
console.log(`Serving the test page at ${startUrl}`);

const runner = await webExt.cmd.run({ sourceDir: resolve("dist"), startUrl: [startUrl] }, { shouldExitProgram: false });
runner.registerCleanup(() => server.close());
