#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const registry = "https://registry.npmjs.org";
const source = "coreyhaines31/marketingskills";

function decodeStatement(attestation) {
  return JSON.parse(Buffer.from(attestation.bundle.dsseEnvelope.payload, "base64url").toString("utf8"));
}

/** Validate package identity plus the exact GitHub workflow, tag, commit, and hosted builder in npm's attestation bundle. */
export function validateAttestations({ metadata, bundle, pkg, githubSha }) {
  const expectedSubject = `pkg:npm/${encodeURIComponent(pkg.name)}@${pkg.version}`;
  const integrity = metadata.dist?.integrity;
  if (!integrity?.startsWith("sha512-")) throw new Error("registry metadata lacks sha512 integrity");
  const expectedDigest = Buffer.from(integrity.slice("sha512-".length), "base64").toString("hex");
  const statements = bundle.attestations.map((attestation) => decodeStatement(attestation));
  const publish = statements.find((statement) => statement.predicateType === "https://github.com/npm/attestation/tree/main/specs/publish/v0.1");
  const provenance = statements.find((statement) => statement.predicateType === "https://slsa.dev/provenance/v1");
  for (const statement of [publish, provenance]) {
    const subject = statement?.subject?.find((candidate) => candidate.name === expectedSubject);
    if (!subject || subject.digest?.sha512 !== expectedDigest) throw new Error("attestation subject does not match the registry artifact");
  }
  if (publish.predicate?.name !== pkg.name || publish.predicate?.version !== pkg.version || publish.predicate?.registry !== registry) {
    throw new Error("npm publish attestation identity is incorrect");
  }
  const definition = provenance.predicate?.buildDefinition;
  const workflow = definition?.externalParameters?.workflow;
  const dependency = definition?.resolvedDependencies?.find((item) => item.digest?.gitCommit === githubSha);
  if (workflow?.repository !== "https://github.com/statechange/monoskill" ||
      workflow?.path !== ".github/workflows/publish.yml" || workflow?.ref !== `refs/tags/v${pkg.version}` ||
      !dependency || provenance.predicate?.runDetails?.builder?.id !== "https://github.com/actions/runner/github-hosted" ||
      definition?.internalParameters?.github?.event_name !== "push") {
    throw new Error("SLSA provenance does not match the authorized GitHub release workflow");
  }
}

export async function runRegistrySmoke({ root, githubSha, fetchImpl = fetch }) {
  if (!/^[0-9a-f]{40}$/.test(githubSha || "")) throw new Error("GITHUB_SHA must identify the published commit");
  const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  const spec = `${pkg.name}@${pkg.version}`;
  const temporary = await mkdtemp(path.join(os.tmpdir(), "monoskill-registry-smoke-"));
  const cache = path.join(temporary, "npm-cache");
  const home = path.join(temporary, "home");
  const project = path.join(temporary, "project");
  const artifacts = path.join(temporary, "artifacts");

  function run(command, args, options = {}) {
    return execFileSync(command, args, {
      cwd: options.cwd || temporary,
      encoding: "utf8",
      env: { ...process.env, HOME: home, CODEX_HOME: path.join(home, ".codex"),
        CLAUDE_CONFIG_DIR: path.join(home, ".claude"), NPM_CONFIG_CACHE: cache, NPM_CONFIG_REGISTRY: registry },
    }).trim();
  }
  const monoskill = (args, cwd = temporary) => run("npx", ["--yes", "--package", spec, "--", "monoskill", ...args], { cwd });

  async function waitForRegistryProvenance() {
    const encodedName = encodeURIComponent(pkg.name).replace(/^%40/, "@");
    const url = `${registry}/${encodedName}/${encodeURIComponent(pkg.version)}`;
    let lastState = "not found";
    for (let attempt = 1; attempt <= 12; attempt += 1) {
      const response = await fetchImpl(url, { headers: { accept: "application/json" } });
      if (response.ok) {
        const metadata = await response.json();
        const attestationsUrl = metadata.dist?.attestations?.url;
        if (attestationsUrl) {
          const attestationsResponse = await fetchImpl(attestationsUrl, { headers: { accept: "application/json" } });
          if (attestationsResponse.ok) {
            validateAttestations({ metadata, bundle: await attestationsResponse.json(), pkg, githubSha });
            return;
          }
          lastState = `attestations HTTP ${attestationsResponse.status}`;
        } else lastState = "version visible without attestations";
      } else lastState = `HTTP ${response.status}`;
      if (attempt < 12) await new Promise((resolve) => setTimeout(resolve, 10_000));
    }
    throw new Error(`${spec} did not expose valid npm provenance after 120 seconds (${lastState})`);
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
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  runRegistrySmoke({ root, githubSha: process.env.GITHUB_SHA }).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
