const GITHUB_SHORTHAND = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

export function normalizeSkillName(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63)
    .replace(/-+$/g, "");
}

export function inferSkillName(source) {
  const repository = githubRepository(source);
  if (repository) {
    const owner = normalizeSkillName(repository.owner);
    const repo = normalizeSkillName(repository.repo).replace(/-?skills$/i, "").replace(/-+$/g, "");
    return normalizeSkillName([owner, repo].filter(Boolean).join("-")) || "mono-skill";
  }

  const trimmed = String(source ?? "").trim().replace(/[?#].*$/, "").replace(/\/+$/, "");
  const scpPath = trimmed.includes(":") && !trimmed.includes("://") ? trimmed.split(":").at(-1) : trimmed;
  const segment = scpPath.split(/[\\/]/).filter(Boolean).at(-1)?.replace(/\.git$/i, "") || "mono-skill";
  return normalizeSkillName(segment) || "mono-skill";
}

export function githubRepository(source) {
  const raw = String(source ?? "").trim().replace(/[?#].*$/, "").replace(/\/+$/, "");
  let path;

  if (GITHUB_SHORTHAND.test(raw)) path = raw;
  else {
    const scp = raw.match(/^[^@\s]+@github\.com:(.+)$/i);
    if (scp) path = scp[1];
    else {
      try {
        const url = new URL(raw);
        if (url.hostname.toLowerCase() !== "github.com") return null;
        path = url.pathname;
      } catch {
        return null;
      }
    }
  }

  const [owner, repo] = path.replace(/^\/+/, "").split("/");
  if (!owner || !repo) return null;
  return { owner, repo: repo.replace(/\.git$/i, "") };
}
