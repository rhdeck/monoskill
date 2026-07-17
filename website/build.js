import { cp, mkdir, rm } from "node:fs/promises";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const output = join(root, "dist");
const publicFiles = [
  "analytics.js",
  "app.js",
  "favicon.svg",
  "generator.js",
  "index.html",
  "og-image-context.png",
  "og-image.png",
  "robots.txt",
  "site.webmanifest",
  "sitemap.xml",
  "state-change-logo.png",
  "styles.css"
];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const file of publicFiles) await cp(join(root, file), join(output, basename(file)));
console.log(`Built ${publicFiles.length} static files in ${output}`);
