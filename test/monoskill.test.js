import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmod, lstat, mkdtemp, mkdir, readFile, readlink, readdir, realpath, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, normalize, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import yauzl from "yauzl";
import { packageSkill } from "../src/archive.js";
import { build, check, update } from "../src/compiler.js";
import { parseRemoteSource, selectTreeRef } from "../src/source.js";

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

test("add compiles one canonical project skill and links explicit harness targets", async () => {
  const temp = await mkdtemp(join(tmpdir(), "monoskill-add-test-"));
  const source = join(temp, "vendor");
  const project = join(temp, "project");
  const cli = join(process.cwd(), "bin", "monoskill.js");
  try {
    await createSkill(source, "seo", "Audit search performance.");
    await commitFixture(source);
    await mkdir(project);
    const { stdout } = await exec(process.execPath, [cli, "add", source, "--name", "vendor-marketing", "--agent", "codex", "--json"], { cwd: project });
    const result = JSON.parse(stdout);
    const projectRoot = await realpath(project);
    const canonical = join(projectRoot, ".agents", "skills", "vendor-marketing");
    const codex = join(projectRoot, ".codex", "skills", "vendor-marketing");
    assert.equal(result.output, canonical);
    assert.equal((await lstat(codex)).isSymbolicLink(), true);
    assert.equal(resolve(dirname(codex), await readlink(codex)), canonical);
    assert.equal(await pathExists(join(projectRoot, ".claude", "skills", "vendor-marketing")), false);
    const manifest = JSON.parse(await readFile(join(canonical, "provenance.json"), "utf8"));
    assert.equal(manifest.deployment.scope, "project");
    assert.deepEqual(manifest.deployment.targets.map((target) => target.agent), ["codex"]);
    assert.equal((await check(canonical)).current, true);
    const previousVersion = await realpath(canonical);

    await writeFile(join(source, "skills", "seo", "SKILL.md"), skillText("seo", "Audit organic search performance."));
    await exec("git", ["-C", source, "add", "."]);
    await exec("git", ["-C", source, "-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-qm", "update"]);
    await update(codex);
    assert.equal((await check(canonical)).current, true);
    assert.equal((await lstat(canonical)).isSymbolicLink(), true);
    assert.notEqual(await realpath(canonical), previousVersion);
    assert.equal(await pathExists(previousVersion), false);
    assert.equal((await lstat(codex)).isSymbolicLink(), true);
    assert.equal(JSON.parse(await readFile(join(canonical, "provenance.json"), "utf8")).deployment.targets[0].agent, "codex");

    await assert.rejects(exec(process.execPath, [cli, "add", source, "--name", "vendor-marketing", "--agent", "codex"], { cwd: project }), /refusing to overwrite existing installation/);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("add previews safely and requires explicit confirmation for global harness writes", async () => {
  const temp = await mkdtemp(join(tmpdir(), "monoskill-global-add-test-"));
  const source = join(temp, "vendor");
  const project = join(temp, "project");
  const home = join(temp, "home");
  const cli = join(process.cwd(), "bin", "monoskill.js");
  const env = {
    ...process.env,
    HOME: home,
    CODEX_HOME: join(home, "custom-codex"),
    CLAUDE_CONFIG_DIR: join(home, "custom-claude")
  };
  try {
    await createSkill(source, "seo", "Audit search performance.");
    await commitFixture(source);
    await mkdir(project);
    const preview = await exec(process.execPath, [cli, "add", source, "--name", "preview", "--global", "--dry-run", "--json"], { cwd: project, env });
    assert.equal(JSON.parse(preview.stdout).dryRun, true);
    assert.equal(await pathExists(join(home, ".agents")), false);

    await assert.rejects(exec(process.execPath, [cli, "add", source, "--name", "global-skill", "--global"], { cwd: project, env }), /global installation requires --yes/);
    await exec(process.execPath, [cli, "add", source, "--name", "global-skill", "--global", "--yes"], { cwd: project, env });
    const homeRoot = await realpath(home);
    const canonical = join(homeRoot, ".agents", "skills", "global-skill");
    assert.equal(await pathExists(join(canonical, "SKILL.md")), true);
    assert.equal((await lstat(join(homeRoot, "custom-codex", "skills", "global-skill"))).isSymbolicLink(), true);
    assert.equal((await lstat(join(homeRoot, "custom-claude", "skills", "global-skill"))).isSymbolicLink(), true);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("add-managed projects remain atomically updateable after relocation", async () => {
  const temp = await mkdtemp(join(tmpdir(), "monoskill-relocation-test-"));
  const source = join(temp, "vendor");
  const project = join(temp, "project");
  const moved = join(temp, "moved-project");
  const cli = join(process.cwd(), "bin", "monoskill.js");
  try {
    await createSkill(source, "seo", "Audit search performance.");
    await commitFixture(source);
    await mkdir(project);
    await exec(process.execPath, [cli, "add", source, "--name", "portable", "--agent", "codex"], { cwd: project });
    await rename(project, moved);
    await writeFile(join(source, "skills", "seo", "SKILL.md"), skillText("seo", "Audit organic search performance."));
    await exec("git", ["-C", source, "add", "."]);
    await exec("git", ["-C", source, "-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-qm", "update"]);
    await exec(process.execPath, [cli, "update", join(moved, ".codex", "skills", "portable")]);
    assert.equal((await check(join(moved, ".agents", "skills", "portable"))).current, true);
    assert.equal((await lstat(join(moved, ".agents", "skills", "portable"))).isSymbolicLink(), true);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("source parser supports shorthand, clone URLs, and GitHub tree paths", () => {
  assert.equal(parseRemoteSource("owner/repo").url, "https://github.com/owner/repo.git");
  assert.equal(parseRemoteSource("git@github.com:owner/repo.git").url, "git@github.com:owner/repo.git");
  assert.deepEqual(parseRemoteSource("https://github.com/owner/repo/tree/main/packages/skills"), {
    url: "https://github.com/owner/repo.git",
    ref: null,
    skillsDir: null,
    treeParts: ["main", "packages", "skills"]
  });
  assert.equal(selectTreeRef(["feature", "nested", "skills"], ["main", "feature", "feature/nested"]), "feature/nested");
});

test("project add refuses harness parents symlinked outside the project", async () => {
  const temp = await mkdtemp(join(tmpdir(), "monoskill-path-safety-test-"));
  const source = join(temp, "vendor");
  const project = join(temp, "project");
  const outside = join(temp, "outside");
  const cli = join(process.cwd(), "bin", "monoskill.js");
  try {
    await createSkill(source, "seo", "Audit search performance.");
    await commitFixture(source);
    await mkdir(project);
    await mkdir(outside);
    await symlink(outside, join(project, ".agents"), "dir");
    await assert.rejects(exec(process.execPath, [cli, "add", source, "--name", "escape"], { cwd: project }), /project harness parent must not be a symlink/);
    assert.equal(await pathExists(join(outside, "skills", "escape")), false);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("add JSON errors identify source, compilation, and target-discovery boundaries", async () => {
  const temp = await mkdtemp(join(tmpdir(), "monoskill-errors-test-"));
  const emptySource = join(temp, "empty");
  const cli = join(process.cwd(), "bin", "monoskill.js");
  try {
    await mkdir(emptySource);
    await writeFile(join(emptySource, "README.md"), "No skills here.\n");
    await commitFixture(emptySource);
    const sourceError = await commandFailure(process.execPath, [cli, "add", "file:///definitely/missing/monoskill-source", "--name", "broken", "--json"], { cwd: temp });
    assert.equal(JSON.parse(sourceError.stderr).stage, "source");
    const compileError = await commandFailure(process.execPath, [cli, "add", emptySource, "--name", "empty", "--json"], { cwd: temp });
    assert.equal(JSON.parse(compileError.stderr).stage, "compilation");
    const targetError = await commandFailure(process.execPath, [cli, "add", emptySource, "--name", "empty", "--agent", "unknown", "--json"], { cwd: temp });
    assert.equal(JSON.parse(targetError.stderr).stage, "target discovery");
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

async function commandFailure(command, args, options) {
  try {
    await exec(command, args, options);
  } catch (error) {
    return error;
  }
  assert.fail("expected command to fail");
}

function skillText(name, description) {
  return `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n\nFollow the upstream workflow.\n`;
}
