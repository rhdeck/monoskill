import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.env.PORT || 4173);
const types = { ".css": "text/css", ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".txt": "text/plain", ".xml": "application/xml" };

createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  const relative = normalize(pathname === "/" ? "index.html" : pathname.slice(1));
  if (relative.startsWith("..")) {
    response.writeHead(403).end("Forbidden");
    return;
  }
  try {
    const file = ["agentation.js", "animatics.js", "app.js", "directions.js"].includes(relative) ? join(root, ".dev", relative) : join(root, relative);
    const body = await readFile(file);
    response.writeHead(200, {
      "content-type": `${types[extname(relative)] || "application/octet-stream"}; charset=utf-8`,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "strict-origin-when-cross-origin"
    });
    response.end(body);
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("Not found");
  }
}).listen(port, "127.0.0.1", () => console.log(`Monoskill website: http://127.0.0.1:${port}`));
