# CLI reference

The skill and CLI install separately. On a clean machine, use the exact public-registry invocation shown below; it downloads and runs Monoskill 0.3.0 without a prior global install. If `monoskill` 0.3.0 is already installed, `monoskill <command>` is equivalent. Run `npx --yes monoskill@0.3.0 --help` before acting.

Sources may be local directories, Git URLs, GitHub `owner/repo` shorthand, or GitHub tree URLs. Use `--ref` and `--skills-dir` when discovery needs an explicit revision or skill root.

## Deploy one routed skill

Preview a project deployment first:

```bash
npx --yes monoskill@0.3.0 add <source> --name <name> --dry-run --json
```

Install into the current project after inspecting the preview:

```bash
npx --yes monoskill@0.3.0 add <source> --name <name>
npx --yes monoskill@0.3.0 add <source> --name <name> --agent codex --agent claude-code
```

Project scope is the default. The canonical copy lives at `.agents/skills/<name>` and requested agent paths link to it. With no `--agent`, both `codex` and `claude-code` are targeted.

For an explicitly authorized global deployment:

```bash
npx --yes monoskill@0.3.0 add <source> --name <name> --agent codex --agent claude-code --global --yes --json
```

The canonical global copy lives under `HOME/.agents/skills`. Codex discovery honors `CODEX_HOME`; Claude Code honors `CLAUDE_CONFIG_DIR`. Never substitute guessed harness paths. When isolating a smoke test, redirect all three variables. Global writes require `--yes`; a global `--dry-run` does not.

`add` refuses any collision at the canonical or agent target paths. It does not accept `--output`, `--archive`, or `--force`.

## Build without deploying

Compile to a generated skill directory:

```bash
npx --yes monoskill@0.3.0 build <source> --name <name> --output <dir>
```

Useful build controls are `--ref <git-ref>`, `--skills-dir <path>`, and `--description <text>`. Inspect `<dir>` before building: directory builds may replace an existing output, so use a new path unless replacement was explicitly authorized.

Compile directly to a deterministic portable `.skill` ZIP archive:

```bash
npx --yes monoskill@0.3.0 build <source> --name <name> --archive --output <file.skill>
```

Archive output must end in `.skill`. Existing archives are refused unless `--force` is explicit.

## Package an existing build

Package a compiled skill directory:

```bash
npx --yes monoskill@0.3.0 package <skill-dir> --output <file.skill>
```

Omit `--output` to write `<skill-dir>.skill`. Use `--force` only when the user explicitly authorized replacing that archive. The archive root preserves `SKILL.md`, `agents/openai.yaml`, `provenance.json`, and complete `references/` trees.

## Check and update

Detect source drift without modifying the installed skill:

```bash
npx --yes monoskill@0.3.0 check <skill-dir>
npx --yes monoskill@0.3.0 check <skill-dir> --json
```

Exit status `0` means current. Exit status `2` means the source commit or one or more skill hashes changed. Read `added`, `removed`, and `changed` from JSON output when automating.

After inspecting drift and receiving authorization, rebuild atomically from `provenance.json`:

```bash
npx --yes monoskill@0.3.0 update <skill-dir>
```

For an `add` installation, pass either the canonical `.agents/skills/<name>` path or an agent symlink. Deployment provenance and all agent links are preserved across the update.

## Verify

For a directory or deployment, confirm that the generated root contains:

```text
SKILL.md
agents/openai.yaml
provenance.json
references/<upstream-skill>/SKILL.md
```

Inspect `provenance.json` for the resolved source commit, discovered skill paths, content hashes, and deployment targets when applicable. Open at least one routed reference. For a `.skill` file, list or extract the ZIP into a temporary directory and inspect the same root contract.
