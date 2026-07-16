import { existsSync } from "node:fs";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

export async function materializeSource(input, ref) {
  let localPath;
  try {
    localPath = input.startsWith("file:") ? fileURLToPath(input) : resolve(input);
  } catch (error) {
    throw sourceError(`could not resolve local source ${input}`, error);
  }
  if (existsSync(localPath)) {
    try {
      const root = await realpath(localPath);
      if (!ref) {
        return {
          root,
          input,
          url: pathToFileURL(root).href,
          commit: await gitValue(root, ["rev-parse", "HEAD"]) || "local",
          requestedRef: null,
          suggestedSkillsDir: null,
          cleanup: async () => {}
        };
      }
      return cloneSource(input, { url: pathToFileURL(root).href, ref, skillsDir: null });
    } catch (error) {
      if (error.stage === "source") throw error;
      throw sourceError(`could not read local source ${input}`, error);
    }
  }

  let parsed;
  try {
    parsed = await resolveTreeRef(parseRemoteSource(input, ref));
  } catch (error) {
    if (error.stage === "source") throw error;
    throw sourceError(`could not resolve ${input}`, error);
  }
  return cloneSource(input, parsed);
}

async function cloneSource(input, parsed) {
  const url = parsed.url;
  const temp = await mkdtemp(join(tmpdir(), "monoskill-"));
  const root = join(temp, basename(input.replace(/\.git$/, "")) || "source");
  try {
    await exec("git", ["clone", "--quiet", "--depth", "1", url, root]);
    if (parsed.ref) {
      await exec("git", ["-C", root, "fetch", "--quiet", "--depth", "1", "origin", parsed.ref]);
      await exec("git", ["-C", root, "checkout", "--quiet", "--detach", "FETCH_HEAD"]);
    }
    return {
      root,
      input,
      url,
      commit: await gitValue(root, ["rev-parse", "HEAD"]),
      requestedRef: parsed.ref,
      suggestedSkillsDir: parsed.skillsDir,
      cleanup: () => rm(temp, { recursive: true, force: true })
    };
  } catch (error) {
    await rm(temp, { recursive: true, force: true });
    throw sourceError(`could not fetch ${input}`, error);
  }
}

export function normalizeSource(input) {
  if (/^[\w.-]+\/[\w.-]+$/.test(input)) return `https://github.com/${input}.git`;
  return input;
}

/**
 * Normalize remote source syntax. GitHub tree URLs are left as path segments
 * for remote-ref discovery unless --ref explicitly supplies the ref; in that
 * case the remaining suffix becomes the inferred skills directory.
 */
export function parseRemoteSource(input, ref) {
  const tree = input.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/tree\/(.+?)\/?$/);
  if (tree) {
    const treeParts = decodeURIComponent(tree[3]).split("/").filter(Boolean);
    const explicitPrefix = ref && treeParts.join("/").startsWith(`${ref}/`) ? ref.split("/").length : 1;
    return {
      url: `https://github.com/${tree[1]}/${tree[2]}.git`,
      ref: ref ?? null,
      skillsDir: ref ? treeParts.slice(explicitPrefix).join("/") || null : null,
      treeParts: ref ? null : treeParts
    };
  }
  return { url: normalizeSource(input), ref: ref ?? null, skillsDir: null, treeParts: null };
}

async function resolveTreeRef(parsed) {
  if (!parsed.treeParts) return parsed;
  const joined = parsed.treeParts.join("/");
  let stdout;
  try {
    ({ stdout } = await exec("git", ["ls-remote", "--heads", "--tags", parsed.url]));
  } catch (error) {
    throw sourceError(`could not inspect refs for ${parsed.url}`, error);
  }
  const refs = stdout.split("\n")
    .map((line) => line.split("\t")[1] ?? "")
    .filter((name) => name.startsWith("refs/heads/") || (name.startsWith("refs/tags/") && !name.endsWith("^{}")))
    .map((name) => name.replace(/^refs\/(?:heads|tags)\//, ""));
  const resolvedRef = selectTreeRef(parsed.treeParts, refs);
  if (!resolvedRef) {
    throw sourceError(`could not resolve a branch, tag, or commit from GitHub tree path ${joined}`, new Error("pass --ref and --skills-dir explicitly"));
  }
  return {
    ...parsed,
    ref: resolvedRef,
    skillsDir: joined === resolvedRef ? null : joined.slice(resolvedRef.length + 1),
    treeParts: null
  };
}

/**
 * Select the longest remote branch/tag prefix from a GitHub tree path, allowing
 * slash-containing branch names. A full commit SHA is accepted directly. When
 * --ref is supplied, parseRemoteSource treats it as authoritative and retains
 * the URL suffix as the inferred skills directory.
 */
export function selectTreeRef(treeParts, refs) {
  const joined = treeParts.join("/");
  return refs
    .filter((name) => joined === name || joined.startsWith(`${name}/`))
    .sort((a, b) => b.length - a.length)[0]
    ?? (/^[0-9a-f]{40}(?:\/|$)/i.test(joined) ? treeParts[0] : null);
}

function sourceError(message, error) {
  const detail = error.stderr?.trim() || error.message;
  const wrapped = new Error(`${message}: ${detail}`);
  wrapped.stage = "source";
  wrapped.cause = error;
  return wrapped;
}

async function gitValue(cwd, args) {
  try {
    const { stdout } = await exec("git", ["-C", cwd, ...args]);
    return stdout.trim();
  } catch {
    return "";
  }
}
