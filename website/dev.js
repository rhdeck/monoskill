import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = fileURLToPath(new URL(".", import.meta.url));
const output = join(root, ".dev");

await mkdir(output, { recursive: true });
await build({
  entryPoints: {
    app: join(root, "app.js"),
    agentation: join(root, "agentation-entry.jsx")
  },
  outdir: output,
  bundle: true,
  format: "esm",
  jsx: "automatic",
  sourcemap: "inline",
  external: ["./agentation.js"]
});

await import("./server.js");
