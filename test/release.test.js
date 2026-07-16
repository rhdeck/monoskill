import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

import {
  assertVersionUnpublished,
  assertPublicRepository,
  expectedTarballFiles,
  validatePackageMetadata,
  validateReleaseIdentity,
  validateTarball,
} from "../scripts/release-preflight.js";
import { validateAttestations } from "../scripts/smoke-registry-release.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("package metadata and dry-run tarball satisfy the release contract", async () => {
  const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  assert.doesNotThrow(() => validatePackageMetadata(pkg));
  assert.throws(() => validatePackageMetadata({ ...pkg, version: "01.2.3" }), /not a publishable semantic version/);
  assert.throws(
    () => validatePackageMetadata({ ...pkg, publishConfig: { ...pkg.publishConfig, registry: "https://example.test" } }),
    /publishConfig.registry must be exactly/,
  );

  const [pack] = JSON.parse(execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
    cwd: root,
    encoding: "utf8",
  }));
  assert.equal(pack.name, pkg.name);
  assert.equal(pack.version, pkg.version);
  const expectedFiles = await expectedTarballFiles(root);
  assert.doesNotThrow(() => validateTarball({ pack, expectedFiles }));
});

test("release identity rejects mismatched tags, commits, and tag targets", () => {
  const pkg = { version: "0.3.1" };
  assert.doesNotThrow(() => validateReleaseIdentity({
    pkg, tag: "v0.3.1", headSha: "abc", eventSha: "abc", tagSha: "abc", simulate: false,
  }));
  assert.throws(
    () => validateReleaseIdentity({ pkg, tag: "v0.3", headSha: "abc", eventSha: "abc", simulate: true }),
    /tag must be exactly v0\.3\.1/,
  );
  assert.throws(
    () => validateReleaseIdentity({ pkg, tag: "v0.3.1", headSha: "abc", eventSha: "def", simulate: true }),
    /does not match event commit/,
  );
  assert.throws(
    () => validateReleaseIdentity({
      pkg, tag: "v0.3.1", headSha: "abc", eventSha: "abc", tagSha: "def", simulate: false,
    }),
    /tag v0\.3\.1 resolves to def/,
  );
});

test("tarball inspection rejects missing, extra, duplicate, and non-executable content", () => {
  const valid = {
    files: [
      { path: "bin/monoskill.js", mode: 0o755 },
      { path: "package.json", mode: 0o644 },
    ],
  };
  assert.doesNotThrow(() => validateTarball({ pack: valid, expectedFiles: ["bin/monoskill.js", "package.json"] }));
  assert.throws(
    () => validateTarball({ pack: { files: [...valid.files, { path: ".env", mode: 0o644 }] }, expectedFiles: ["bin/monoskill.js", "package.json"] }),
    /unexpected: \.env/,
  );
  assert.throws(
    () => validateTarball({ pack: { files: [valid.files[0]] }, expectedFiles: ["bin/monoskill.js", "package.json"] }),
    /missing: package\.json/,
  );
  assert.throws(
    () => validateTarball({ pack: { files: [valid.files[0], valid.files[0]] }, expectedFiles: ["bin/monoskill.js"] }),
    /duplicate paths/,
  );
  assert.throws(
    () => validateTarball({ pack: { files: [{ path: "bin/monoskill.js", mode: 0o644 }] }, expectedFiles: ["bin/monoskill.js"] }),
    /not executable/,
  );
});

test("registry check distinguishes unpublished, immutable, and indeterminate versions", async () => {
  const response = (status) => ({ status, ok: status >= 200 && status < 300 });
  await assert.doesNotReject(() => assertVersionUnpublished({
    registry: "https://registry.example", name: "monoskill", version: "0.3.1", fetchImpl: async () => response(404),
  }));
  await assert.rejects(
    () => assertVersionUnpublished({
      registry: "https://registry.example", name: "monoskill", version: "0.3.1", fetchImpl: async () => response(200),
    }),
    /already exists; npm versions are immutable/,
  );
  await assert.rejects(
    () => assertVersionUnpublished({
      registry: "https://registry.example", name: "monoskill", version: "0.3.1", fetchImpl: async () => response(503),
    }),
    /failed closed with HTTP 503/,
  );
  await assert.rejects(
    () => assertVersionUnpublished({
      registry: "https://registry.example", name: "monoskill", version: "0.3.1", fetchImpl: async () => { throw new Error("offline"); },
    }),
    /could not verify immutable version.*offline/,
  );
});

test("public-source gate requires anonymous repository and exact commit visibility", async () => {
  const response = (body, status = 200) => ({ status, ok: status === 200, json: async () => body });
  await assert.doesNotReject(() => assertPublicRepository({
    headSha: "a".repeat(40),
    fetchImpl: async (url) => url.includes("/commits/")
      ? response({ sha: "a".repeat(40) })
      : response({ full_name: "rhdeck/monoskill", private: false }),
  }));
  await assert.rejects(() => assertPublicRepository({
    headSha: "a".repeat(40), fetchImpl: async () => response({ full_name: "rhdeck/monoskill", private: true }),
  }), /not confirmed public/);
  await assert.rejects(() => assertPublicRepository({
    headSha: "a".repeat(40), fetchImpl: async () => response({}, 404),
  }), /failed closed with HTTP 404/);
});

test("registry provenance is bound to the package, workflow, tag, commit, and hosted runner", () => {
  const sha = "a".repeat(40);
  const digest = "b".repeat(128);
  const pkg = { name: "monoskill", version: "0.3.1" };
  const subject = [{ name: "pkg:npm/monoskill@0.3.1", digest: { sha512: digest } }];
  const attestation = (statement) => ({ bundle: { dsseEnvelope: { payload: Buffer.from(JSON.stringify(statement)).toString("base64url") } } });
  const publish = { subject, predicateType: "https://github.com/npm/attestation/tree/main/specs/publish/v0.1",
    predicate: { name: "monoskill", version: "0.3.1", registry: "https://registry.npmjs.org" } };
  const provenance = { subject, predicateType: "https://slsa.dev/provenance/v1", predicate: {
    buildDefinition: { externalParameters: { workflow: { repository: "https://github.com/rhdeck/monoskill",
      path: ".github/workflows/publish.yml", ref: "refs/tags/v0.3.1" } },
    internalParameters: { github: { event_name: "push" } }, resolvedDependencies: [{ digest: { gitCommit: sha } }] },
    runDetails: { builder: { id: "https://github.com/actions/runner/github-hosted" } },
  } };
  const input = { metadata: { dist: { integrity: `sha512-${Buffer.from(digest, "hex").toString("base64")}` } },
    bundle: { attestations: [attestation(publish), attestation(provenance)] }, pkg, githubSha: sha };
  assert.doesNotThrow(() => validateAttestations(input));
  const wrong = structuredClone(input);
  const decoded = provenance;
  decoded.predicate.buildDefinition.externalParameters.workflow.path = ".github/workflows/other.yml";
  wrong.bundle.attestations[1] = attestation(decoded);
  assert.throws(() => validateAttestations(wrong), /does not match the authorized GitHub release workflow/);
});

test("publish workflow is a single GitHub-hosted OIDC path with no token or cache fallback", async () => {
  const source = await readFile(path.join(root, ".github/workflows/publish.yml"), "utf8");
  const workflow = parse(source);

  assert.deepEqual(Object.keys(workflow.on), ["push"]);
  assert.deepEqual(workflow.on.push.tags, ["v*"]);
  assert.deepEqual(workflow.permissions, { contents: "read", "id-token": "write" });
  assert.deepEqual(workflow.concurrency, { group: "npm-release-monoskill", "cancel-in-progress": false });

  const publish = workflow.jobs.publish;
  assert.equal(publish["runs-on"], "ubuntu-latest");
  assert.equal(publish.environment, undefined);
  const checkout = publish.steps.find((step) => step.uses?.startsWith("actions/checkout@"));
  const setupNode = publish.steps.find((step) => step.uses?.startsWith("actions/setup-node@"));
  assert.equal(checkout.uses, "actions/checkout@v6");
  assert.equal(checkout.with["fetch-depth"], 0);
  assert.equal(setupNode.uses, "actions/setup-node@v6");
  assert.equal(setupNode.with["node-version"], "24");
  assert.equal(setupNode.with["registry-url"], "https://registry.npmjs.org");
  assert.equal(setupNode.with["package-manager-cache"], false);

  const commands = publish.steps.map((step) => step.run).filter(Boolean);
  assert.ok(commands.includes("npm install --global npm@11.5.1"));
  assert.ok(commands.includes("npm ci"));
  assert.ok(commands.includes("npm run release:simulate"));
  assert.ok(commands.includes("npm run release:preflight"));
  assert.deepEqual(commands.filter((command) => /^npm publish\s*$/.test(command)), ["npm publish"]);
  assert.ok(commands.includes("npm run smoke:registry"));
  assert.ok(commands.indexOf("npm run smoke:registry") > commands.indexOf("npm publish"));
  assert.doesNotMatch(source, /NODE_AUTH_TOKEN|NPM_TOKEN|_authToken|actions\/cache/i);
  assert.doesNotMatch(source, /^\s+cache:/im);
  assert.doesNotMatch(source, /workflow_dispatch|workflow_call|self-hosted/);
});
