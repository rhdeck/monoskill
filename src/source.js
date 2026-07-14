import { existsSync } from "node:fs";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

export async function materializeSource(input, ref) {
  const localPath = resolve(input);
  if (existsSync(localPath)) {
    const root = await realpath(localPath);
    return {
      root,
      input,
      url: await gitValue(root, ["config", "--get", "remote.origin.url"]) || pathToFileURL(root).href,
      commit: await gitValue(root, ["rev-parse", "HEAD"]) || `local-${Date.now()}`,
      requestedRef: ref ?? null,
      cleanup: async () => {}
    };
  }

  const url = normalizeSource(input);
  const temp = await mkdtemp(join(tmpdir(), "monoskill-"));
  const root = join(temp, basename(input.replace(/\.git$/, "")) || "source");
  try {
    await exec("git", ["clone", "--quiet", "--depth", "1", url, root]);
    if (ref) {
      await exec("git", ["-C", root, "fetch", "--quiet", "--depth", "1", "origin", ref]);
      await exec("git", ["-C", root, "checkout", "--quiet", "--detach", "FETCH_HEAD"]);
    }
    return {
      root,
      input,
      url,
      commit: await gitValue(root, ["rev-parse", "HEAD"]),
      requestedRef: ref ?? null,
      cleanup: () => rm(temp, { recursive: true, force: true })
    };
  } catch (error) {
    await rm(temp, { recursive: true, force: true });
    throw new Error(`could not fetch ${input}: ${error.stderr?.trim() || error.message}`);
  }
}

export function normalizeSource(input) {
  if (/^[\w.-]+\/[\w.-]+$/.test(input)) return `https://github.com/${input}.git`;
  return input;
}

async function gitValue(cwd, args) {
  try {
    const { stdout } = await exec("git", ["-C", cwd, ...args]);
    return stdout.trim();
  } catch {
    return "";
  }
}
