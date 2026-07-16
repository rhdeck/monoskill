const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const GITHUB_SHORTHAND = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const SCP_GIT_URL = /^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+:[^\s]+$/;
const LOCAL_PATH = /^(?:\.{0,2}\/|~\/|\/)/;
const SKILL_NAME = /^[a-z0-9-]{1,63}$/;
const SUPPORTED_PROTOCOLS = new Set(["https:", "http:", "ssh:", "git:", "file:"]);

export function validateSource(raw) {
  const source = String(raw ?? "").trim();
  if (!source) return { valid: false, message: "Paste a GitHub repository, Git URL, or local path." };
  if (source.length > 2048) return { valid: false, message: "Source must be 2,048 characters or fewer." };
  if (CONTROL_CHARACTERS.test(source)) return { valid: false, message: "Source cannot contain line breaks or control characters." };
  if (GITHUB_SHORTHAND.test(source)) return { valid: true, value: source, type: "github-shorthand" };
  if (LOCAL_PATH.test(source)) return { valid: true, value: source, type: "local-path" };
  if (SCP_GIT_URL.test(source)) return { valid: true, value: source, type: "git-url" };

  try {
    const url = new URL(source);
    if (SUPPORTED_PROTOCOLS.has(url.protocol) && url.hostname) {
      return { valid: true, value: source, type: url.protocol === "file:" ? "local-path" : "git-url" };
    }
  } catch {
    // The specific validation message below is more useful than URL's parser error.
  }

  return {
    valid: false,
    message: "Use owner/repo, a supported Git URL, or a local path beginning with ./, ../, ~/, or /."
  };
}

export function inferSkillName(source) {
  const trimmed = String(source ?? "").trim().replace(/[?#].*$/, "").replace(/\/+$/, "");
  const scpPath = trimmed.includes(":") && !trimmed.includes("://") ? trimmed.split(":").at(-1) : trimmed;
  const segment = scpPath.split(/[\\/]/).filter(Boolean).at(-1)?.replace(/\.git$/i, "") || "mono-skill";
  return normalizeSkillName(segment) || "mono-skill";
}

export function normalizeSkillName(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63)
    .replace(/-+$/g, "");
}

export function validateSkillName(value) {
  return SKILL_NAME.test(String(value ?? ""));
}

export function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

export function makeCommand(source, name) {
  if (!validateSource(source).valid) throw new Error("Cannot generate a command for an invalid source.");
  if (!validateSkillName(name)) throw new Error("Cannot generate a command for an invalid skill name.");
  return `npx monoskill build ${shellQuote(String(source).trim())} --name ${shellQuote(name)}`;
}

export function makePrompt(source, name) {
  const command = makeCommand(source, name);
  return [
    "Install or load the lightweight Monoskill skill if this harness provides it.",
    `Compile the skill source into one provenance-aware router named ${JSON.stringify(name)}.`,
    "Run this command exactly:",
    command,
    `When it succeeds, install or link ./${name} in this harness as a skill. Do not discard SKILL.md, agents/openai.yaml, references/, or provenance.json. Report the resolved source commit and where the skill was installed. If this harness cannot install local skills, stop after compilation and explain the exact remaining manual step.`
  ].join("\n\n");
}
