import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rename, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import YAML from "yaml";
import { packageSkill } from "./archive.js";
import { materializeSource } from "./source.js";

const TOOL_VERSION = "0.3.0";

export async function build(sourceInput, options) {
  assertSkillName(options.name);
  const source = await materializeSource(sourceInput, options.ref);
  try {
    return await compileMaterialized(source, options);
  } finally {
    await source.cleanup();
  }
}

/**
 * Compile through a temporary tree and leave only a reproducible .skill file.
 * Temporary output is always cleaned; archive overwrite still requires force.
 */
export async function buildArchive(sourceInput, options) {
  assertSkillName(options.name);
  const temp = await mkdtemp(join(tmpdir(), "monoskill-build-archive-"));
  try {
    const built = await build(sourceInput, { ...options, reproducible: true, output: join(temp, options.name) });
    const packaged = await packageSkill(built.output, { output: options.output, force: options.force });
    return { ...built, output: packaged.output, entryCount: packaged.entryCount };
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}

export async function check(skillDir) {
  const manifest = await readManifest(skillDir);
  const source = await materializeSource(manifest.source.url, manifest.source.requestedRef);
  const temp = await mkdtemp(join(tmpdir(), "monoskill-check-"));
  try {
    const result = await compileMaterialized(source, {
      name: manifest.skill.name,
      description: manifest.skill.descriptionOverride,
      skillsDir: manifest.source.skillsDir,
      output: join(temp, manifest.skill.name)
    });
    const next = await readManifest(result.output);
    return compareManifests(manifest, next);
  } finally {
    await source.cleanup();
    await rm(temp, { recursive: true, force: true });
  }
}

export async function update(skillDir) {
  skillDir = await realpath(skillDir);
  const manifest = await readManifest(skillDir);
  const drift = await check(skillDir);
  if (drift.current) return { current: true, commit: manifest.source.commit, skillCount: manifest.skills.length };

  if (await isAtomicDeployment(manifest, skillDir)) {
    return updateAtomicDeployment(skillDir, manifest);
  }

  const parent = dirname(skillDir);
  const temp = await mkdtemp(join(parent, ".monoskill-update-"));
  try {
    const result = await build(manifest.source.url, {
      name: manifest.skill.name,
      description: manifest.skill.descriptionOverride,
      ref: manifest.source.requestedRef,
      skillsDir: manifest.source.skillsDir,
      output: join(temp, basename(skillDir))
    });
    if (manifest.deployment) {
      const nextManifest = await readManifest(result.output);
      nextManifest.deployment = { ...manifest.deployment, updatedAt: new Date().toISOString() };
      await writeFile(join(result.output, "provenance.json"), `${JSON.stringify(nextManifest, null, 2)}\n`);
    }
    const backup = `${skillDir}.backup-${Date.now()}`;
    await rename(skillDir, backup);
    try {
      await rename(result.output, skillDir);
      await rm(backup, { recursive: true, force: true });
    } catch (error) {
      await rename(backup, skillDir);
      throw error;
    }
    return { current: false, previousCommit: manifest.source.commit, commit: result.commit, skillCount: result.skillCount };
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}

/**
 * Refresh an add-managed installation without ever removing its public path.
 * A complete new version is built privately, then a temporary canonical link
 * is renamed over the old link in one filesystem operation. Harness links keep
 * resolving throughout the swap; the retired version is cleaned afterward.
 */
async function updateAtomicDeployment(currentVersion, manifest) {
  const canonical = resolve(manifest.deployment.canonicalPath);
  const versionStore = resolve(manifest.deployment.versionStore ?? dirname(currentVersion));
  await mkdir(versionStore, { recursive: true });
  const nextVersion = join(versionStore, `${Date.now()}-${process.pid}-${randomUUID()}`);
  const nextLink = `${canonical}.next-${process.pid}-${randomUUID()}`;
  let result;
  try {
    result = await build(manifest.source.url, {
      name: manifest.skill.name,
      description: manifest.skill.descriptionOverride,
      ref: manifest.source.requestedRef,
      skillsDir: manifest.source.skillsDir,
      output: nextVersion
    });
    const nextManifest = await readManifest(nextVersion);
    nextManifest.deployment = { ...manifest.deployment, updatedAt: new Date().toISOString() };
    await writeFile(join(nextVersion, "provenance.json"), `${JSON.stringify(nextManifest, null, 2)}\n`);
    await symlink(relative(dirname(canonical), nextVersion), nextLink, "dir");
    await rename(nextLink, canonical);
  } catch (error) {
    await rm(nextLink, { force: true });
    await rm(nextVersion, { recursive: true, force: true });
    throw error;
  }
  await rm(currentVersion, { recursive: true, force: true }).catch(() => {});
  return { current: false, previousCommit: manifest.source.commit, commit: result.commit, skillCount: result.skillCount };
}

async function isAtomicDeployment(manifest, currentVersion) {
  if (!manifest.deployment?.canonicalPath) return false;
  try {
    const canonical = resolve(manifest.deployment.canonicalPath);
    return (await lstat(canonical)).isSymbolicLink() && await realpath(canonical) === currentVersion;
  } catch {
    return false;
  }
}

async function compileMaterialized(source, options) {
  const skillsRoot = resolveSkillsRoot(source.root, options.skillsDir ?? source.suggestedSkillsDir);
  const skillDirs = await findSkillDirs(skillsRoot);
  if (!skillDirs.length) throw new Error(`no SKILL.md files found under ${skillsRoot}`);

  const skills = [];
  for (const dir of skillDirs) {
    const raw = await readFile(join(dir, "SKILL.md"), "utf8");
    const metadata = parseFrontmatter(raw, join(dir, "SKILL.md"));
    const name = normalizeSkillName(metadata.name || basename(dir));
    if (skills.some((skill) => skill.name === name)) throw new Error(`duplicate skill name: ${name}`);
    skills.push({
      name,
      description: oneLine(metadata.description || `Use the ${name} upstream skill.`),
      sourcePath: relative(source.root, dir),
      dir,
      hash: await hashDirectory(dir)
    });
  }
  skills.sort((a, b) => a.name.localeCompare(b.name));

  const descriptionOverride = options.description ?? null;
  const description = descriptionOverride ?? makeDescription(options.name, skills);
  const output = resolve(options.output);
  const staging = `${output}.staging-${process.pid}-${Date.now()}`;
  await rm(staging, { recursive: true, force: true });
  await mkdir(join(staging, "references"), { recursive: true });

  for (const skill of skills) {
    await cp(skill.dir, join(staging, "references", skill.name), { recursive: true });
  }

  const manifest = {
    schemaVersion: 1,
    compiledAt: options.reproducible ? null : new Date().toISOString(),
    compiler: { name: "monoskill", version: TOOL_VERSION },
    skill: { name: options.name, description, descriptionOverride },
    source: {
      input: source.input,
      url: source.url,
      requestedRef: source.requestedRef,
      commit: source.commit,
      skillsDir: relative(source.root, skillsRoot) || "."
    },
    skills: skills.map(({ name, description: routeDescription, sourcePath, hash }) => ({ name, description: routeDescription, sourcePath, hash }))
  };

  await writeFile(join(staging, "SKILL.md"), renderSkill(manifest));
  await mkdir(join(staging, "agents"), { recursive: true });
  await writeFile(join(staging, "agents", "openai.yaml"), renderOpenAiYaml(options.name));
  await writeFile(join(staging, "provenance.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  await mkdir(dirname(output), { recursive: true });
  await replaceDirectory(staging, output);
  return { output, skillCount: skills.length, sourceUrl: source.url, commit: source.commit };
}

function resolveSkillsRoot(root, configured) {
  if (configured) {
    const candidate = resolve(root, configured);
    if (!candidate.startsWith(`${resolve(root)}/`) && candidate !== resolve(root)) throw new Error("--skills-dir must stay inside the source repository");
    if (!existsSync(candidate)) throw new Error(`skills directory does not exist: ${configured}`);
    return candidate;
  }
  const conventional = join(root, "skills");
  return existsSync(conventional) ? conventional : root;
}

async function findSkillDirs(root) {
  const found = [];
  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    if (entries.some((entry) => entry.isFile() && entry.name === "SKILL.md")) {
      found.push(dir);
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || [".git", "node_modules", ".agents", ".claude", ".codex"].includes(entry.name)) continue;
      await walk(join(dir, entry.name));
    }
  }
  await walk(root);
  return found;
}

function parseFrontmatter(raw, path) {
  const match = raw.match(/^---\s*\r?\n([\s\S]*?)\r?\n---(?:\s*\r?\n|$)/);
  if (!match) throw new Error(`missing YAML frontmatter in ${path}`);
  try {
    return YAML.parse(match[1]) || {};
  } catch (error) {
    throw new Error(`invalid YAML frontmatter in ${path}: ${error.message}`);
  }
}

function renderSkill(manifest) {
  const rows = manifest.skills.map((skill) => `| \`${skill.name}\` | ${escapeTable(compactRoute(skill.description))} | \`references/${skill.name}/SKILL.md\` |`).join("\n");
  return `---
name: ${manifest.skill.name}
description: ${yamlScalar(manifest.skill.description)}
---

# ${titleCase(manifest.skill.name)}

Route marketing work to the smallest relevant set of upstream skills. Do not load every reference.

## Workflow

1. Match the request to one or more routes below.
2. Read each selected \`references/<name>/SKILL.md\` completely before acting.
3. Resolve files mentioned by an upstream skill relative to that skill's directory.
4. When several skills apply, use the narrowest execution skill first and load shared context only when it is required.
5. Attribute upstream-derived guidance to the source recorded in \`provenance.json\` when provenance matters.

## Routes

| Skill | Use for | Load |
|---|---|---|
${rows}

## Provenance

This skill was compiled by monoskill from \`${manifest.source.url}\` at commit \`${manifest.source.commit}\`. Read \`provenance.json\` for per-skill paths and content hashes. Run \`monoskill check <this-skill-directory>\` to detect upstream drift and \`monoskill update <this-skill-directory>\` to rebuild atomically.
`;
}

function renderOpenAiYaml(name) {
  return `interface:\n  display_name: ${yamlScalar(titleCase(name))}\n  short_description: ${yamlScalar("Route work across a compiled skill collection")}\n  default_prompt: ${yamlScalar(`Use $${name} to route this request to the right upstream expertise.`)}\n`;
}

function makeDescription(name, skills) {
  const examples = skills.slice(0, 8).map((skill) => skill.name).join(", ");
  return `Route work across the compiled ${name} skill collection without loading every upstream skill. Use for requests covered by its vendor skill set, including ${examples}${skills.length > 8 ? ", and related topics" : ""}; select and read only the relevant bundled subskills.`;
}

function compareManifests(current, next) {
  const oldByName = new Map(current.skills.map((skill) => [skill.name, skill]));
  const newByName = new Map(next.skills.map((skill) => [skill.name, skill]));
  const added = [...newByName.keys()].filter((name) => !oldByName.has(name));
  const removed = [...oldByName.keys()].filter((name) => !newByName.has(name));
  const changed = [...newByName.keys()].filter((name) => oldByName.has(name) && oldByName.get(name).hash !== newByName.get(name).hash);
  return {
    current: current.source.commit === next.source.commit && added.length === 0 && removed.length === 0 && changed.length === 0,
    localCommit: current.source.commit,
    remoteCommit: next.source.commit,
    skillCount: next.skills.length,
    added,
    removed,
    changed
  };
}

async function replaceDirectory(staging, output) {
  if (!existsSync(output)) {
    await rename(staging, output);
    return;
  }
  const backup = `${output}.backup-${Date.now()}`;
  await rename(output, backup);
  try {
    await rename(staging, output);
    await rm(backup, { recursive: true, force: true });
  } catch (error) {
    await rename(backup, output);
    throw error;
  }
}

async function readManifest(skillDir) {
  try {
    return JSON.parse(await readFile(join(skillDir, "provenance.json"), "utf8"));
  } catch (error) {
    throw new Error(`cannot read ${join(skillDir, "provenance.json")}: ${error.message}`);
  }
}

async function hashDirectory(root) {
  const hash = createHash("sha256");
  async function walk(dir) {
    const entries = (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile()) {
        const rel = relative(root, path);
        const info = await stat(path);
        hash.update(`${rel}\0${info.mode}\0`);
        hash.update(await readFile(path));
        hash.update("\0");
      }
    }
  }
  await walk(root);
  return `sha256:${hash.digest("hex")}`;
}

function normalizeSkillName(name) {
  return String(name).trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
}

function assertSkillName(name) {
  if (!/^[a-z0-9-]{1,63}$/.test(name)) throw new Error("skill name must use lowercase letters, digits, and hyphens (max 63 characters)");
}

function oneLine(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

function compactRoute(value) {
  const text = oneLine(value);
  const sentence = text.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? text;
  if (sentence.length <= 180) return sentence;
  const clipped = sentence.slice(0, 177).replace(/\s+\S*$/, "").trimEnd();
  return `${clipped}...`;
}

function yamlScalar(value) {
  return JSON.stringify(String(value));
}

function escapeTable(value) {
  return oneLine(value).replaceAll("|", "\\|");
}

function titleCase(value) {
  return value.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}
