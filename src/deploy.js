import { cp, lstat, mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { dirname, join, relative, resolve } from "node:path";
import { build } from "./compiler.js";

const HARNESS_ADAPTERS = {
  codex: {
    skillRoot: (root, scope) => scope === "global"
      ? join(resolve(process.env.CODEX_HOME?.trim() || join(root, ".codex")), "skills")
      : join(root, ".codex", "skills")
  },
  "claude-code": {
    skillRoot: (root, scope) => scope === "global"
      ? join(resolve(process.env.CLAUDE_CONFIG_DIR?.trim() || join(root, ".claude")), "skills")
      : join(root, ".claude", "skills")
  }
};

/**
 * Resolve, compile, and transactionally deploy one generated router skill.
 * The canonical path is an atomically replaceable symlink to a private version
 * directory; requested harnesses receive relative links to that canonical path.
 * Any failed link step rolls back every artifact created by this invocation.
 */
export async function add(source, options) {
  const plan = deploymentPlan(options);
  await validateProjectParents(plan);
  await refuseCollisions(plan);

  const stagingRoot = await mkdtemp(join(tmpdir(), "monoskill-add-"));
  const stagedSkill = join(stagingRoot, options.name);
  try {
    let compiled;
    try {
      compiled = await build(source, { ...options, output: stagedSkill });
    } catch (error) {
      throw stageError(error.stage === "source" ? "source" : "compilation", error);
    }

    const deployment = {
      scope: plan.scope,
      canonicalPath: relative(plan.root, plan.canonical),
      versionStore: relative(plan.root, plan.versionStore),
      installedAt: options.dryRun ? null : new Date().toISOString(),
      targets: plan.targets.map(({ agent, path }) => ({ agent, path: relative(plan.root, path), mode: "symlink" }))
    };
    try {
      await recordDeployment(stagedSkill, deployment);
    } catch (error) {
      throw stageError("deployment", error);
    }

    if (options.dryRun) {
      return { ...compiled, output: plan.canonical, ...plan, dryRun: true, deployment };
    }

    const created = [];
    try {
      await mkdir(dirname(plan.canonical), { recursive: true });
      const version = await publishVersionedCanonical(stagedSkill, plan);
      created.push(version);
      created.push(plan.canonical);
      for (const target of plan.targets) {
        await mkdir(dirname(target.path), { recursive: true });
        await symlink(relative(dirname(target.path), plan.canonical), target.path, "dir");
        created.push(target.path);
      }
    } catch (error) {
      for (const path of created.reverse()) await rm(path, { recursive: true, force: true });
      throw stageError("deployment", error);
    }
    return { ...compiled, output: plan.canonical, ...plan, dryRun: false, deployment };
  } finally {
    await rm(stagingRoot, { recursive: true, force: true });
  }
}

/**
 * Discover supported harness destinations for a project or user scope without
 * touching the filesystem. Project scope is rooted at cwd; global scope uses
 * the active HOME. Codex and Claude Code adapters own their path conventions.
 */
export function deploymentPlan(options) {
  if (!options.name) throw stageError("target discovery", new Error("add requires --name <name>"));
  if (!/^[a-z0-9-]{1,63}$/.test(options.name)) {
    throw stageError("target discovery", new Error("skill name must use lowercase letters, digits, and hyphens (max 63 characters)"));
  }
  if (options.global && !options.yes && !options.dryRun) {
    throw stageError("target discovery", new Error("global installation requires --yes (use --dry-run to preview)"));
  }
  if (options.output || options.archive || options.force) {
    throw stageError("target discovery", new Error("add destinations are derived from scope and do not accept --output, --archive, or --force"));
  }
  const scope = options.global ? "global" : "project";
  const root = options.global ? resolve(options.home ?? homedir()) : resolve(options.projectRoot ?? process.cwd());
  const agents = normalizeAgents(options.agent);
  const canonical = join(root, ".agents", "skills", options.name);
  const versionStore = join(root, ".agents", "skills", ".monoskill", options.name);
  return {
    scope,
    root,
    canonical,
    versionStore,
    agents,
    targets: agents.map((agent) => ({ agent, path: join(HARNESS_ADAPTERS[agent].skillRoot(root, scope), options.name) }))
  };
}

function normalizeAgents(values = []) {
  const requested = values.length ? values : Object.keys(HARNESS_ADAPTERS);
  const expanded = requested.includes("*") ? Object.keys(HARNESS_ADAPTERS) : requested;
  const agents = [...new Set(expanded)];
  const unsupported = agents.filter((agent) => !HARNESS_ADAPTERS[agent]);
  if (unsupported.length) {
    throw stageError("target discovery", new Error(`unsupported agent: ${unsupported.join(", ")} (supported: ${Object.keys(HARNESS_ADAPTERS).join(", ")})`));
  }
  return agents;
}

async function refuseCollisions(plan) {
  const collisions = [];
  for (const path of [plan.canonical, ...plan.targets.map((target) => target.path)]) {
    if (await pathExists(path)) collisions.push(path);
  }
  if (collisions.length) {
    throw stageError("deployment", new Error(`refusing to overwrite existing installation${collisions.length > 1 ? "s" : ""}: ${collisions.join(", ")}`));
  }
}

async function recordDeployment(skillDir, deployment) {
  const path = join(skillDir, "provenance.json");
  const manifest = JSON.parse(await readFile(path, "utf8"));
  manifest.deployment = deployment;
  await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`);
}

async function publishVersionedCanonical(stagedSkill, plan) {
  await mkdir(plan.versionStore, { recursive: true });
  const version = join(plan.versionStore, `${Date.now()}-${process.pid}-${randomUUID()}`);
  await publishDirectory(stagedSkill, version);
  try {
    await symlink(relative(dirname(plan.canonical), version), plan.canonical, "dir");
  } catch (error) {
    await rm(version, { recursive: true, force: true });
    throw error;
  }
  return version;
}

async function publishDirectory(stagedSkill, destination) {
  try {
    await rename(stagedSkill, destination);
  } catch (error) {
    if (error.code !== "EXDEV") throw error;
    const localStaging = `${destination}.staging-${process.pid}-${Date.now()}`;
    try {
      await cp(stagedSkill, localStaging, { recursive: true });
      await rename(localStaging, destination);
    } finally {
      await rm(localStaging, { recursive: true, force: true });
    }
  }
}

async function validateProjectParents(plan) {
  if (plan.scope !== "project") return;
  const parents = [dirname(plan.canonical), ...plan.targets.map((target) => dirname(target.path))];
  for (const parent of parents) {
    let cursor = plan.root;
    for (const part of relative(plan.root, parent).split(/[\\/]/).filter(Boolean)) {
      cursor = join(cursor, part);
      try {
        const info = await lstat(cursor);
        if (info.isSymbolicLink()) {
          throw stageError("target discovery", new Error(`project harness parent must not be a symlink: ${cursor}`));
        }
      } catch (error) {
        if (error.code === "ENOENT") break;
        throw error;
      }
    }
  }
}

async function pathExists(path) {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

function stageError(stage, error) {
  const wrapped = new Error(`${stage} failed: ${error.message}`);
  wrapped.stage = stage;
  wrapped.cause = error;
  return wrapped;
}
