import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const consumerSurfaces = [
  "README.md",
  "website/generator.js",
  "website/generator.test.js",
  "website/e2e.spec.js",
  "skills/monoskill/SKILL.md",
  "skills/monoskill/references/cli.md",
  "scripts/validate-skill.js",
];

test("consumer CLI surfaces use the exact public registry release", async () => {
  for (const relative of consumerSurfaces) {
    const contents = await readFile(path.join(root, relative), "utf8");
    assert.doesNotMatch(contents, /github:rhdeck\/monoskill/, relative);
  }
  for (const relative of ["README.md", "website/generator.js", "skills/monoskill/references/cli.md"]) {
    const contents = await readFile(path.join(root, relative), "utf8");
    assert.match(contents, /npx --yes monoskill@0\.3\.0/, relative);
  }
});
