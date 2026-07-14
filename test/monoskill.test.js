import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { build, check, update } from "../src/compiler.js";

const exec = promisify(execFile);

test("build, detect drift, and update a local git skill collection", async () => {
  const temp = await mkdtemp(join(tmpdir(), "monoskill-test-"));
  const source = join(temp, "vendor");
  const output = join(temp, "compiled");
  try {
    await createSkill(source, "copywriting", "Write and revise marketing copy.");
    await createSkill(source, "seo", "Audit search performance. This second sentence should stay out of the compact router.");
    await exec("git", ["init", "-q", source]);
    await exec("git", ["-C", source, "add", "."]);
    await exec("git", ["-C", source, "-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-qm", "initial"]);

    const built = await build(source, { name: "vendor-marketing", output });
    assert.equal(built.skillCount, 2);
    assert.match(await readFile(join(output, "SKILL.md"), "utf8"), /references\/copywriting\/SKILL\.md/);
    assert.doesNotMatch(await readFile(join(output, "SKILL.md"), "utf8"), /second sentence/);
    assert.equal((await check(output)).current, true);

    await writeFile(join(source, "skills", "copywriting", "SKILL.md"), skillText("copywriting", "Write sharper marketing copy."));
    await createSkill(source, "analytics", "Design analytics and measurement plans.");
    await exec("git", ["-C", source, "add", "."]);
    await exec("git", ["-C", source, "-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-qm", "vendor update"]);

    const drift = await check(output);
    assert.equal(drift.current, false);
    assert.deepEqual(drift.added, ["analytics"]);
    assert.deepEqual(drift.changed, ["copywriting"]);

    const updated = await update(output);
    assert.equal(updated.current, false);
    assert.equal((await check(output)).current, true);
    assert.equal(JSON.parse(await readFile(join(output, "provenance.json"), "utf8")).skills.length, 3);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

async function createSkill(root, name, description) {
  const dir = join(root, "skills", name);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "SKILL.md"), skillText(name, description));
}

function skillText(name, description) {
  return `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n\nFollow the upstream workflow.\n`;
}
