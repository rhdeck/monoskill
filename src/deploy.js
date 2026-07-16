import { cp, lstat, mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { build } from "./compiler.js";

const AGENTS = {
  codex: { project: [".codex", "skills"], global: [".codex", "skills"] },
  "claude-code": { project: [".claude", "skills"], global: [".claude", "skills"] }
};

export async function add(source, options) {
  const plan = deploymentPlan(options);
  await refuseCollisions(plan);

  const stagingRoot = await mkdtemp(join(tmpdir(), "monoskill-add-"));
  const stagedSkill = join(stagingRoot, options.name);
  try {
    let compiled;
    try {
      compiled = await build(source, { ...options, output: stagedSkill });
    } catch (error) {
      throw stageError(error.message.startsWith("could not fetch") ? "source" : "compilation", error);
    }

    const deployment = {
      scope: plan.scope,
      canonicalPath: plan.canonical,
      installedAt: options.dryRun ? null : new Date().toISOString(),
      targets: plan.targets.map(({ agent, path }) => ({ agent, path, mode: "symlink" }))
    };
    await recordDeployment(stagedSkill, deployment);

    if (options.dryRun) {
      return { ...compiled, output: plan.canonical, ...plan, dryRun: true, deployment };
    }

    const created = [];
    try {
      await mkdir(dirname(plan.canonical), { recursive: true });
      await publishCanonical(stagedSkill, plan.canonical);
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
  return {
    scope,
    root,
    canonical,
    agents,
    targets: agents.map((agent) => ({ agent, path: join(root, ...AGENTS[agent][scope], options.name) }))
  };
}

function normalizeAgents(values = []) {
  const requested = values.length ? values : Object.keys(AGENTS);
  const expanded = requested.includes("*") ? Object.keys(AGENTS) : requested;
  const agents = [...new Set(expanded)];
  const unsupported = agents.filter((agent) => !AGENTS[agent]);
  if (unsupported.length) {
    throw stageError("target discovery", new Error(`unsupported agent: ${unsupported.join(", ")} (supported: ${Object.keys(AGENTS).join(", ")})`));
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

async function publishCanonical(stagedSkill, canonical) {
  try {
    await rename(stagedSkill, canonical);
  } catch (error) {
    if (error.code !== "EXDEV") throw error;
    const localStaging = `${canonical}.staging-${process.pid}-${Date.now()}`;
    try {
      await cp(stagedSkill, localStaging, { recursive: true });
      await rename(localStaging, canonical);
    } finally {
      await rm(localStaging, { recursive: true, force: true });
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
