import { githubRepository } from "../src/naming.js";

const API_ROOT = "https://api.github.com/repos";
const EXCLUDED_DIRECTORIES = new Set([".git", "node_modules", ".agents", ".claude", ".codex"]);

export async function inspectGitHubSkills(source, { fetch = globalThis.fetch, signal } = {}) {
  const repository = githubRepository(source);
  if (!repository) throw new Error("This source is not a GitHub repository.");

  const slug = `${repository.owner}/${repository.repo}`;
  const metadata = await getJson(`${API_ROOT}/${slug}`, fetch, signal);
  const defaultBranch = metadata.default_branch;
  const tree = await getJson(`${API_ROOT}/${slug}/git/trees/${encodeURIComponent(defaultBranch)}?recursive=1`, fetch, signal);
  if (tree.truncated) throw new Error("GitHub returned a partial repository tree, so the skill count is unavailable.");

  const skillPaths = tree.tree
    .filter(({ type, path }) => type === "blob" && (path === "SKILL.md" || path.endsWith("/SKILL.md")))
    .map(({ path }) => path)
    .filter((path) => !path.split("/").some((segment) => EXCLUDED_DIRECTORIES.has(segment)));
  const hasConventionalSkillsDirectory = skillPaths.some((path) => path.startsWith("skills/"));
  const discovered = hasConventionalSkillsDirectory
    ? skillPaths.filter((path) => path.startsWith("skills/"))
    : skillPaths;

  return {
    fullName: metadata.full_name || slug,
    defaultBranch,
    skillCount: discovered.length
  };
}

async function getJson(url, fetch, signal) {
  const response = await fetch(url, {
    signal,
    headers: { Accept: "application/vnd.github+json" }
  });
  if (!response.ok) throw new Error(response.status === 404
    ? "GitHub could not find a public repository at that source."
    : `GitHub could not inspect this repository (HTTP ${response.status}).`);
  return response.json();
}
