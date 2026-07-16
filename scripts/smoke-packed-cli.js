#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const temporary = await mkdtemp(path.join(os.tmpdir(), "monoskill-packed-smoke-"));

try {
  const pack = JSON.parse(execFileSync("npm", ["pack", "--json", "--ignore-scripts", "--pack-destination", temporary], {
    cwd: root,
    encoding: "utf8",
  }))[0];
  const tarball = path.join(temporary, pack.filename);
  execFileSync("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", tarball], {
    cwd: temporary,
    stdio: "pipe",
  });
  const executable = path.join(temporary, "node_modules", ".bin", "monoskill");
  const version = execFileSync(executable, ["--version"], { cwd: temporary, encoding: "utf8" }).trim();
  if (version !== pkg.version) throw new Error(`packed CLI returned ${version}, expected ${pkg.version}`);
  console.log(`packed CLI smoke passed for monoskill@${version}`);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
