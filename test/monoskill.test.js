import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmod, lstat, mkdtemp, mkdir, readFile, readlink, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, normalize, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import yauzl from "yauzl";
import { packageSkill } from "../src/archive.js";
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

test("package produces a deterministic, lossless .skill archive and protects existing artifacts", async () => {
  const temp = await mkdtemp(join(tmpdir(), "monoskill-package-test-"));
  const source = join(temp, "vendor");
  const compiled = join(temp, "compiled");
  const firstArchive = join(temp, "first.skill");
  const secondArchive = join(temp, "second.skill");
  const utcArchive = join(temp, "utc.skill");
  const kiritimatiArchive = join(temp, "kiritimati.skill");
  const extracted = join(temp, "extracted");
  try {
    await createSkill(source, "copywriting", "Write and revise marketing copy.");
    await mkdir(join(source, "skills", "copywriting", "empty"));
    await writeFile(join(source, "skills", "copywriting", "script.sh"), "#!/bin/sh\necho copy\n");
    await chmod(join(source, "skills", "copywriting", "script.sh"), 0o755);
    await symlink("script.sh", join(source, "skills", "copywriting", "script-link"));
    await commitFixture(source);
    await build(source, { name: "vendor-marketing", output: compiled });

    await assert.rejects(packageSkill(compiled, { output: join(compiled, "nested.skill") }), /outside the skill directory/);
    const outputAlias = join(temp, "compiled-alias");
    await symlink(compiled, outputAlias, "dir");
    const rejectedParent = join(outputAlias, "new-parent");
    await assert.rejects(packageSkill(compiled, { output: join(rejectedParent, "nested.skill") }), /outside the skill directory/);
    assert.equal(await pathExists(rejectedParent), false);
    if (sep !== "\\") {
      const unsafeName = join(compiled, "unsafe\\name");
      await writeFile(unsafeName, "unsafe");
      await assert.rejects(packageSkill(compiled, { output: join(temp, "unsafe.skill") }), /path containing a backslash/);
      await rm(unsafeName);
    }

    const first = await packageSkill(compiled, { output: firstArchive });
    const second = await packageSkill(compiled, { output: secondArchive });
    assert.equal(first.skillCount, 1);
    assert.deepEqual(await readFile(firstArchive), await readFile(secondArchive));
    assert.equal((await readFile(firstArchive)).subarray(0, 4).toString("hex"), "504b0304");

    const cli = join(process.cwd(), "bin", "monoskill.js");
    await exec(process.execPath, [cli, "package", compiled, "--output", utcArchive], { env: { ...process.env, TZ: "UTC" } });
    await exec(process.execPath, [cli, "package", compiled, "--output", kiritimatiArchive], { env: { ...process.env, TZ: "Pacific/Kiritimati" } });
    assert.deepEqual(await readFile(utcArchive), await readFile(kiritimatiArchive));
    assert.deepEqual(await readFile(firstArchive), await readFile(utcArchive));

    await extractArchive(firstArchive, extracted);
    assert.deepEqual(await describeTree(extracted), await describeTree(compiled));
    await assert.rejects(packageSkill(compiled, { output: firstArchive }), /already exists.*--force/);
    await packageSkill(compiled, { output: firstArchive, force: true });
    assert.deepEqual(await readFile(firstArchive), await readFile(secondArchive));
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("build --archive path packages directly and invalid generated skills fail clearly", async () => {
  const temp = await mkdtemp(join(tmpdir(), "monoskill-direct-archive-test-"));
  const source = join(temp, "vendor");
  const archive = join(temp, "vendor-marketing.skill");
  const secondArchive = join(temp, "vendor-marketing-second.skill");
  const invalid = join(temp, "invalid");
  try {
    await createSkill(source, "seo", "Audit search performance.");
    await commitFixture(source);
    const { stdout } = await exec(process.execPath, [join(process.cwd(), "bin", "monoskill.js"), "build", source, "--name", "vendor-marketing", "--archive", "--output", archive]);
    assert.match(stdout, /Built 1 skills into .*vendor-marketing\.skill/);
    await exec(process.execPath, [join(process.cwd(), "bin", "monoskill.js"), "build", source, "--name", "vendor-marketing", "--archive", "--output", secondArchive]);
    assert.deepEqual(await readFile(archive), await readFile(secondArchive));
    const extracted = join(temp, "direct-extracted");
    await extractArchive(archive, extracted);
    assert.equal(JSON.parse(await readFile(join(extracted, "provenance.json"), "utf8")).compiledAt, null);
    assert.equal(await pathExists(join(temp, "vendor-marketing")), false);

    await mkdir(invalid);
    await assert.rejects(packageSkill(invalid, { output: join(temp, "invalid.skill") }), /missing SKILL\.md/);
    await assert.rejects(packageSkill(join(temp, "missing")), /does not exist/);
    await assert.rejects(packageSkill(invalid, { output: join(invalid, "nested.skill") }), /missing SKILL\.md/);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

async function createSkill(root, name, description) {
  const dir = join(root, "skills", name);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "SKILL.md"), skillText(name, description));
}

async function commitFixture(source) {
  await exec("git", ["init", "-q", source]);
  await exec("git", ["-C", source, "add", "."]);
  await exec("git", ["-C", source, "-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-qm", "initial"]);
}

async function extractArchive(archive, output) {
  await mkdir(output, { recursive: true });
  const zip = await new Promise((resolveZip, reject) => yauzl.open(archive, { lazyEntries: true }, (error, value) => error ? reject(error) : resolveZip(value)));
  await new Promise((resolveDone, reject) => {
    zip.on("error", reject);
    zip.on("end", resolveDone);
    zip.on("entry", (entry) => {
      extractEntry(zip, entry, output).then(() => zip.readEntry(), reject);
    });
    zip.readEntry();
  });
}

async function extractEntry(zip, entry, output) {
  const destination = resolve(output, normalize(entry.fileName));
  if (destination !== resolve(output) && !destination.startsWith(`${resolve(output)}${sep}`)) throw new Error(`unsafe archive entry: ${entry.fileName}`);
  const mode = entry.externalFileAttributes >>> 16;
  if (entry.fileName.endsWith("/")) {
    await mkdir(destination, { recursive: true });
    return;
  }
  await mkdir(dirname(destination), { recursive: true });
  const data = await new Promise((resolveData, reject) => {
    zip.openReadStream(entry, (error, stream) => {
      if (error) return reject(error);
      const chunks = [];
      stream.on("data", (chunk) => chunks.push(chunk));
      stream.on("error", reject);
      stream.on("end", () => resolveData(Buffer.concat(chunks)));
    });
  });
  if ((mode & 0o170000) === 0o120000) await symlink(data.toString(), destination);
  else {
    await writeFile(destination, data);
    await chmod(destination, mode & 0o777);
  }
}

async function describeTree(root) {
  const result = [];
  async function walk(dir) {
    const entries = (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name));
    if (dir !== root && entries.length === 0) result.push({ path: `${relative(root, dir)}/`, type: "directory" });
    for (const entry of entries) {
      const path = join(dir, entry.name);
      const name = relative(root, path).split(sep).join("/");
      const info = await lstat(path);
      if (entry.isDirectory()) await walk(path);
      else if (entry.isSymbolicLink()) result.push({ path: name, type: "symlink", target: await readlink(path) });
      else result.push({ path: name, type: "file", mode: info.mode & 0o777, data: (await readFile(path)).toString("base64") });
    }
  }
  await walk(root);
  return result.sort((a, b) => a.path.localeCompare(b.path));
}

async function pathExists(path) {
  try {
    await lstat(path);
    return true;
  } catch {
    return false;
  }
}

function skillText(name, description) {
  return `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n\nFollow the upstream workflow.\n`;
}
