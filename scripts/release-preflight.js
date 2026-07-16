#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const EXPECTED_REPOSITORY = "git+https://github.com/rhdeck/monoskill.git";
const DEFAULT_REGISTRY = "https://registry.npmjs.org";
const REQUIRED_STATIC_FILES = ["LICENSE", "README.md", "bin/monoskill.js", "package.json"];

function fail(message) {
  throw new Error(`release preflight: ${message}`);
}

export function validatePackageMetadata(pkg) {
  if (pkg.name !== "monoskill") fail(`expected package name monoskill, got ${pkg.name}`);
  if (pkg.private === true) fail("package must be public");
  if (pkg.repository?.type !== "git" || pkg.repository?.url !== EXPECTED_REPOSITORY) {
    fail(`repository must be exactly ${EXPECTED_REPOSITORY}`);
  }
  if (pkg.publishConfig?.access !== "public") fail("publishConfig.access must be public");
  if (pkg.publishConfig?.provenance === false) fail("automatic npm provenance must not be disabled");
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(pkg.version)) {
    fail(`package version is not a publishable semantic version: ${pkg.version}`);
  }
}

export function validateReleaseIdentity({ pkg, tag, headSha, eventSha, tagSha, simulate }) {
  const expectedTag = `v${pkg.version}`;
  if (tag !== expectedTag) fail(`tag must be exactly ${expectedTag}, got ${tag || "<missing>"}`);
  if (!headSha || !eventSha || headSha !== eventSha) {
    fail(`checked-out commit ${headSha || "<missing>"} does not match event commit ${eventSha || "<missing>"}`);
  }
  if (!simulate && tagSha !== headSha) {
    fail(`tag ${tag} resolves to ${tagSha || "<missing>"}, not checked-out commit ${headSha}`);
  }
}

async function walkFiles(root, relativeDirectory) {
  const absoluteDirectory = path.join(root, relativeDirectory);
  const entries = await readdir(absoluteDirectory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const relative = path.posix.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) files.push(...await walkFiles(root, relative));
    else if (entry.isFile()) files.push(relative);
    else fail(`publish source contains unsupported entry ${relative}`);
  }
  return files;
}

export async function expectedTarballFiles(root) {
  const dynamic = [...await walkFiles(root, "src")];
  return [...REQUIRED_STATIC_FILES, ...dynamic].sort();
}

export function validateTarball({ pack, expectedFiles }) {
  const actualFiles = pack.files.map((file) => file.path).sort();
  if (new Set(actualFiles).size !== actualFiles.length) fail("tarball contains duplicate paths");
  if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
    const missing = expectedFiles.filter((file) => !actualFiles.includes(file));
    const unexpected = actualFiles.filter((file) => !expectedFiles.includes(file));
    fail(`tarball contents differ (missing: ${missing.join(", ") || "none"}; unexpected: ${unexpected.join(", ") || "none"})`);
  }
  const executable = pack.files.find((file) => file.path === "bin/monoskill.js");
  if (!executable || (executable.mode & 0o111) === 0) fail("bin/monoskill.js is not executable in the tarball");
}

export async function assertVersionUnpublished({ registry, name, version, fetchImpl = fetch }) {
  const registryBase = registry.replace(/\/$/, "");
  const packagePath = encodeURIComponent(name).replace(/^%40/, "@");
  let response;
  try {
    response = await fetchImpl(`${registryBase}/${packagePath}/${encodeURIComponent(version)}`, {
      headers: { accept: "application/json" },
    });
  } catch (error) {
    fail(`could not verify immutable version at ${registryBase}: ${error.message}`);
  }
  if (response.status === 404) return;
  if (response.ok) fail(`${name}@${version} already exists; npm versions are immutable`);
  fail(`registry version check failed closed with HTTP ${response.status}`);
}

function git(root, ...args) {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch (error) {
    fail(`git ${args.join(" ")} failed: ${error.stderr?.trim() || error.message}`);
  }
}

function parseArgs(argv) {
  const allowed = new Set(["--simulate"]);
  for (const argument of argv) if (!allowed.has(argument)) fail(`unknown argument ${argument}`);
  return { simulate: argv.includes("--simulate") };
}

export async function runPreflight({ root, simulate, env = process.env }) {
  const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  validatePackageMetadata(pkg);

  const headSha = git(root, "rev-parse", "HEAD");
  const tag = simulate ? (env.RELEASE_TAG || `v${pkg.version}`) : env.GITHUB_REF_NAME;
  const eventSha = simulate ? (env.RELEASE_SHA || headSha) : env.GITHUB_SHA;
  let tagSha;
  if (!simulate) {
    if (env.GITHUB_ACTIONS !== "true") fail("real release preflight only runs in GitHub Actions; use --simulate locally");
    if (env.GITHUB_REF_TYPE !== "tag" || env.GITHUB_REF !== `refs/tags/${tag}`) {
      fail("release event must be an exact GitHub tag ref");
    }
    tagSha = git(root, "rev-parse", `${tag}^{commit}`);
  }
  validateReleaseIdentity({ pkg, tag, headSha, eventSha, tagSha, simulate });

  const packOutput = execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
    cwd: root,
    encoding: "utf8",
  });
  const packs = JSON.parse(packOutput);
  if (!Array.isArray(packs) || packs.length !== 1) fail("npm pack did not describe exactly one package");
  const pack = packs[0];
  if (pack.name !== pkg.name || pack.version !== pkg.version) fail("tarball identity differs from package.json");
  validateTarball({ pack, expectedFiles: await expectedTarballFiles(root) });

  await assertVersionUnpublished({
    registry: env.NPM_CONFIG_REGISTRY || DEFAULT_REGISTRY,
    name: pkg.name,
    version: pkg.version,
  });

  console.log(`release preflight passed for ${pkg.name}@${pkg.version} (${tag}, ${pack.entryCount} files)`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  runPreflight({ root, ...parseArgs(process.argv.slice(2)) }).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
