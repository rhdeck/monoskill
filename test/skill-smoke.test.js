import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { lstat, mkdtemp, mkdir, readFile, readlink, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const exec = promisify(execFile);
const cli = resolve("bin/monoskill.js");

test("agent skill command workflow builds, checks, and updates through the real CLI", async () => {
  const temp = await mkdtemp(join(tmpdir(), "monoskill-skill-smoke-"));
  const source = join(temp, "source");
  const output = join(temp, "compiled");
  const archive = join(temp, "smoke-router.skill");
  try {
    await writeSkill(source, "alpha", "Handle alpha work.");
    await exec("git", ["init", "-q", source]);
    await commit(source, "initial");

    const built = await runCli(["build", source, "--name", "smoke-router", "--output", output]);
    assert.match(built.stdout, /Built 1 skills/);
    assert.equal(JSON.parse(await readFile(join(output, "provenance.json"), "utf8")).skills.length, 1);
    assert.match(await readFile(join(output, "references", "alpha", "SKILL.md"), "utf8"), /Handle alpha work/);
    assert.match((await runCli(["package", output, "--output", archive])).stdout, /Packaged 1 skills/);
    assert.equal((await readFile(archive)).subarray(0, 4).toString("hex"), "504b0304");

    const current = await runCli(["check", output, "--json"]);
    assert.equal(JSON.parse(current.stdout).current, true);

    await writeSkill(source, "beta", "Handle beta work.");
    await commit(source, "add beta");
    await assert.rejects(
      runCli(["check", output, "--json"]),
      (error) => error.code === 2 && JSON.parse(error.stdout).added.includes("beta")
    );

    const updated = await runCli(["update", output]);
    assert.match(updated.stdout, /Updated 2 skills/);
    assert.equal(JSON.parse((await runCli(["check", output, "--json"])).stdout).current, true);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("agent skill deployment workflow previews and isolates project and global harnesses", async () => {
  const temp = await mkdtemp(join(tmpdir(), "monoskill-skill-deploy-smoke-"));
  const source = join(temp, "source");
  const project = join(temp, "project");
  const home = join(temp, "home");
  const env = {
    ...process.env,
    HOME: home,
    CODEX_HOME: join(home, "codex-config"),
    CLAUDE_CONFIG_DIR: join(home, "claude-config")
  };
  try {
    await writeSkill(source, "alpha", "Handle alpha work.");
    await exec("git", ["init", "-q", source]);
    await commit(source, "initial");
    await mkdir(project, { recursive: true });
    await mkdir(home, { recursive: true });

    const preview = JSON.parse((await runCli(["add", source, "--name", "preview-router", "--dry-run", "--json"], { cwd: project, env })).stdout);
    assert.equal(preview.dryRun, true);
    await assert.rejects(lstat(join(project, ".agents")), { code: "ENOENT" });

    await runCli(["add", source, "--name", "project-router", "--agent", "codex", "--json"], { cwd: project, env });
    const projectCanonical = join(project, ".agents", "skills", "project-router");
    const projectCodex = join(project, ".codex", "skills", "project-router");
    assert.equal((await lstat(projectCodex)).isSymbolicLink(), true);
    assert.match(await readlink(projectCodex), /\.agents\/skills\/project-router$/);
    assert.equal(JSON.parse((await runCli(["check", projectCanonical, "--json"], { env })).stdout).current, true);

    await runCli(["add", source, "--name", "global-router", "--agent", "codex", "--agent", "claude-code", "--global", "--yes", "--json"], { cwd: project, env });
    assert.equal((await lstat(join(home, "codex-config", "skills", "global-router"))).isSymbolicLink(), true);
    assert.equal((await lstat(join(home, "claude-config", "skills", "global-router"))).isSymbolicLink(), true);
    assert.equal(JSON.parse(await readFile(join(home, ".agents", "skills", "global-router", "provenance.json"), "utf8")).deployment.scope, "global");
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

async function runCli(args, options = {}) {
  return exec(process.execPath, [cli, ...args], options);
}

async function writeSkill(root, name, description) {
  const dir = join(root, "skills", name);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "SKILL.md"), `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n\nFollow this workflow.\n`);
}

async function commit(root, message) {
  await exec("git", ["-C", root, "add", "."]);
  await exec("git", ["-C", root, "-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-qm", message]);
}
