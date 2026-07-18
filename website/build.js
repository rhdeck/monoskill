import { cp, mkdir, rm } from "node:fs/promises";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = fileURLToPath(new URL(".", import.meta.url));
const output = join(root, "dist");
const publicFiles = [
  "favicon.svg",
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
await build({
  entryPoints: [join(root, "app.js")],
  outfile: join(output, "app.js"),
  bundle: true,
  format: "esm",
  minify: true,
  external: ["./agentation.js"]
});
console.log(`Built ${publicFiles.length + 1} static files in ${output}`);
