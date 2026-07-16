#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const registry = "https://registry.npmjs.org";
const spec = `${pkg.name}@${pkg.version}`;
const source = "coreyhaines31/marketingskills";
const temporary = await mkdtemp(path.join(os.tmpdir(), "monoskill-registry-smoke-"));
const cache = path.join(temporary, "npm-cache");
const home = path.join(temporary, "home");
const project = path.join(temporary, "project");
const artifacts = path.join(temporary, "artifacts");

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd || temporary,
    encoding: "utf8",
    env: {
      ...process.env,
      HOME: home,
      CODEX_HOME: path.join(home, ".codex"),
      CLAUDE_CONFIG_DIR: path.join(home, ".claude"),
      NPM_CONFIG_CACHE: cache,
      NPM_CONFIG_REGISTRY: registry,
    },
  }).trim();
}

function monoskill(args, cwd = temporary) {
  return run("npx", ["--yes", "--package", spec, "--", "monoskill", ...args], { cwd });
}

async function waitForRegistryProvenance() {
  const encodedName = encodeURIComponent(pkg.name).replace(/^%40/, "@");
  const url = `${registry}/${encodedName}/${encodeURIComponent(pkg.version)}`;
  let lastState = "not found";
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    const response = await fetch(url, { headers: { accept: "application/json" } });
    if (response.ok) {
      const metadata = await response.json();
      const attestations = metadata.dist?.attestations;
      if (attestations?.url && attestations.provenance?.predicateType === "https://slsa.dev/provenance/v1") return;
      lastState = "version visible without SLSA provenance";
    } else {
      lastState = `HTTP ${response.status}`;
    }
    if (attempt < 12) await new Promise((resolve) => setTimeout(resolve, 10_000));
  }
  throw new Error(`${spec} did not expose automatic npm provenance after 120 seconds (${lastState})`);
}

try {
  await Promise.all([mkdir(home), mkdir(project), mkdir(artifacts)]);
  await waitForRegistryProvenance();

  const version = monoskill(["--version"]);
  if (version !== pkg.version) throw new Error(`registry CLI returned ${version}, expected ${pkg.version}`);

  const commit = run("git", ["ls-remote", `https://github.com/${source}.git`, "HEAD"]).split(/\s+/)[0];
  if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error(`could not resolve ${source} HEAD`);

  const first = path.join(artifacts, "corey-first.skill");
  const second = path.join(artifacts, "corey-second.skill");
  monoskill(["build", source, "--ref", commit, "--name", "corey-marketing", "--archive", "--output", first]);
  monoskill(["build", source, "--ref", commit, "--name", "corey-marketing", "--archive", "--output", second]);
  const [firstBytes, secondBytes] = await Promise.all([readFile(first), readFile(second)]);
  if (!firstBytes.equals(secondBytes)) throw new Error("registry CLI produced non-deterministic .skill archives");

  monoskill(["add", source, "--ref", commit, "--name", "corey-project"], project);
  monoskill(["check", path.join(project, ".agents", "skills", "corey-project")], project);
  monoskill(["update", path.join(project, ".agents", "skills", "corey-project")], project);

  monoskill(["add", source, "--ref", commit, "--name", "corey-global", "--global", "--yes"]);
  const globalSkill = path.join(home, ".agents", "skills", "corey-global");
  monoskill(["check", globalSkill]);
  monoskill(["update", globalSkill]);

  console.log(`clean-cache registry smoke passed for ${spec} with provenance at Corey commit ${commit}`);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
