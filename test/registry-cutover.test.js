import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
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

const historicalOwnerExceptions = new Map([
  ["docs/DECISIONS.md", 1],
  ["docs/PUBLIC_DISCLOSURE_AUDIT.md", 2],
]);

test("consumer CLI surfaces use the exact public registry release", async () => {
  for (const relative of consumerSurfaces) {
    const contents = await readFile(path.join(root, relative), "utf8");
    assert.doesNotMatch(contents, /github:(?:rhdeck|statechange)\/monoskill/, relative);
  }
  for (const relative of ["README.md", "website/generator.js", "skills/monoskill/references/cli.md"]) {
    const contents = await readFile(path.join(root, relative), "utf8");
    assert.match(contents, /npx --yes monoskill@0\.4\.0/, relative);
  }
});

test("tracked text surfaces reject the personal repository outside explicit history", async () => {
  const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: root })
    .toString("utf8").split("\0").filter(Boolean);
  for (const relative of tracked) {
    const contents = await readFile(path.join(root, relative));
    if (contents.includes(0)) continue;
    const count = [...contents.toString("utf8").matchAll(/rhdeck\/monoskill/g)].length;
    assert.equal(count, historicalOwnerExceptions.get(relative) ?? 0, relative);
  }
});

test("the actual npm tarball README self-references only the ownership-cutover version", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "monoskill-packed-readme-"));
  try {
    const [pack] = JSON.parse(execFileSync("npm", ["pack", "--json", "--ignore-scripts", "--pack-destination", temporary], {
      cwd: root,
      encoding: "utf8",
    }));
    const readme = execFileSync("tar", ["-xOf", path.join(temporary, pack.filename), "package/README.md"], { encoding: "utf8" });
    assert.match(readme, /npx --yes monoskill@0\.4\.0 add /);
    assert.doesNotMatch(readme, /github:(?:rhdeck|statechange)\/monoskill|npx github:|monoskill@0\.3\.[01]/);
    const cliExamples = readme.split("\n").filter((line) => line.startsWith("npx ") && !line.startsWith("npx skills add "));
    assert.ok(cliExamples.length >= 8, "packed README retains the complete CLI example surface");
    assert.ok(cliExamples.every((line) => line.startsWith("npx --yes monoskill@0.4.0 ")));
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
