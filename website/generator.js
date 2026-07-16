const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const GITHUB_SHORTHAND = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const SCP_GIT_URL = /^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+:[^\s]+$/;
const LOCAL_PATH = /^(?:\.{0,2}\/|~\/|\/)/;
const BARE_LOCAL_PATH = /^[A-Za-z0-9_][A-Za-z0-9._' ()@+-]*(?:\/[A-Za-z0-9._' ()@+-]+)*$/;
const SKILL_NAME = /^[a-z0-9-]{1,63}$/;
const SUPPORTED_PROTOCOLS = new Set(["https:", "http:", "ssh:", "git:", "file:"]);
const CLI_BOOTSTRAP = "npx --yes monoskill@0.3.0";
const SKILL_BOOTSTRAP = "npx skills add rhdeck/monoskill --skill monoskill";
const SCOPES = new Set(["project", "global"]);

/**
 * Classify source text the live CLI can materialize: GitHub owner/repo
 * shorthand, HTTP/HTTPS/SSH/Git/file URLs, SCP-style Git URLs, and absolute,
 * home-relative, dot-relative, or bare POSIX paths. This is shape validation,
 * not a network/existence check; the CLI remains authoritative when it fetches
 * or resolves the safely quoted value.
 */
export function validateSource(raw) {
  const source = String(raw ?? "").trim();
  if (!source) return { valid: false, message: "Paste a GitHub repository, Git URL, or local path." };
  if (source.length > 2048) return { valid: false, message: "Source must be 2,048 characters or fewer." };
  if (CONTROL_CHARACTERS.test(source)) return { valid: false, message: "Source cannot contain line breaks or control characters." };
  if (GITHUB_SHORTHAND.test(source)) return { valid: true, value: source, type: "github-shorthand" };
  if (LOCAL_PATH.test(source)) return { valid: true, value: source, type: "local-path" };
  if (SCP_GIT_URL.test(source)) return { valid: true, value: source, type: "git-url" };
  if (BARE_LOCAL_PATH.test(source)) return { valid: true, value: source, type: "local-path" };

  try {
    const url = new URL(source);
    if (SUPPORTED_PROTOCOLS.has(url.protocol) && (url.hostname || url.protocol === "file:" && url.pathname.startsWith("/"))) {
      return { valid: true, value: source, type: url.protocol === "file:" ? "local-path" : "git-url" };
    }
  } catch {
    // The specific validation message below is more useful than URL's parser error.
  }

  return {
    valid: false,
    message: "Use owner/repo, a supported Git URL, or a POSIX local path."
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

/**
 * Render one validated source as a single POSIX shell argument. A leading `~/`
 * is expressed as the shell's HOME variable plus a separately single-quoted
 * suffix; quoting the tilde itself would disable expansion. All other content
 * uses `shellQuote`, so spaces and shell metacharacters remain literal.
 */
export function shellQuoteSource(value) {
  const source = String(value);
  if (source.startsWith("~/")) return `"\${HOME}"/${shellQuote(source.slice(2))}`;
  return shellQuote(source);
}

/**
 * Generate the live CLI's `add <source> --name <name>` invocation. Inputs
 * must pass the same source shapes and skill-name limits presented by the UI;
 * both arguments are emitted as independent POSIX shell literals. Project
 * scope is the safe default; global scope makes both target agents and the
 * CLI's required non-interactive confirmation explicit.
 */
export function makeCommand(source, name, scope = "project") {
  if (!validateSource(source).valid) throw new Error("Cannot generate a command for an invalid source.");
  if (!validateSkillName(name)) throw new Error("Cannot generate a command for an invalid skill name.");
  if (!SCOPES.has(scope)) throw new Error("Cannot generate a command for an invalid scope.");
  const base = `${CLI_BOOTSTRAP} add ${shellQuoteSource(String(source).trim())} --name ${shellQuote(name)}`;
  return scope === "global" ? `${base} --agent codex --agent claude-code --global --yes` : base;
}

/**
 * Produce an agent handoff only after `makeCommand` validates both fields. The
 * prompt bootstraps the shipped `$monoskill` skill through standard tooling,
 * previews every target with the exact published CLI, and deploys only after
 * collision inspection. Global scope is explicitly user-authorized by the
 * generator choice and retains the CLI's required `--yes` confirmation.
 */
export function makePrompt(source, name, scope = "project") {
  const command = makeCommand(source, name, scope);
  const preview = `${command.replace(/ --global --yes$/, " --global")} --dry-run --json`;
  return [
    "Install the shipped Monoskill agent skill with standard skill tooling:",
    SKILL_BOOTSTRAP,
    `Use $monoskill to deploy the source as one provenance-aware router named ${JSON.stringify(name)} at ${scope} scope. Read the skill's CLI reference before acting.`,
    "Preview source resolution, compilation, collisions, and every destination without writing to a harness:",
    preview,
    "If the preview is clean, run this exact install command:",
    command,
    "Verify the canonical path and agent links, then inspect SKILL.md, agents/openai.yaml, provenance.json, and one bundled references/<skill>/SKILL.md. Run the exact-version check command against the canonical installation and report the resolved source commit, installed targets, and drift result. Never replace a collision without explicit authorization."
  ].join("\n\n");
}
