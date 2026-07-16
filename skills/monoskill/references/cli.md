# CLI reference

Run `monoskill --help` before acting if the installed version may differ from this reference. Sources may be local directories, Git URLs, GitHub `owner/repo` shorthand, or GitHub tree URLs. Use `--ref` and `--skills-dir` when discovery needs an explicit revision or skill root.

## Deploy one routed skill

Preview a project deployment first:

```bash
monoskill add <source> --name <name> --dry-run --json
```

Install into the current project after inspecting the preview:

```bash
monoskill add <source> --name <name>
monoskill add <source> --name <name> --agent codex --agent claude-code
```

Project scope is the default. The canonical copy lives at `.agents/skills/<name>` and requested agent paths link to it. With no `--agent`, both `codex` and `claude-code` are targeted.

For an explicitly authorized global deployment:

```bash
monoskill add <source> --name <name> --agent codex --agent claude-code --global --yes --json
```

The canonical global copy lives under `HOME/.agents/skills`. Codex discovery honors `CODEX_HOME`; Claude Code honors `CLAUDE_CONFIG_DIR`. Never substitute guessed harness paths. When isolating a smoke test, redirect all three variables. Global writes require `--yes`; a global `--dry-run` does not.

`add` refuses any collision at the canonical or agent target paths. It does not accept `--output`, `--archive`, or `--force`.

## Build without deploying

Compile to a generated skill directory:

```bash
monoskill build <source> --name <name> --output <dir>
```

Useful build controls are `--ref <git-ref>`, `--skills-dir <path>`, and `--description <text>`. Inspect `<dir>` before building: directory builds may replace an existing output, so use a new path unless replacement was explicitly authorized.

Compile directly to a deterministic portable `.skill` ZIP archive:

```bash
monoskill build <source> --name <name> --archive --output <file.skill>
```

Archive output must end in `.skill`. Existing archives are refused unless `--force` is explicit.

## Package an existing build

Package a compiled skill directory:

```bash
monoskill package <skill-dir> --output <file.skill>
```

Omit `--output` to write `<skill-dir>.skill`. Use `--force` only when the user explicitly authorized replacing that archive. The archive root preserves `SKILL.md`, `agents/openai.yaml`, `provenance.json`, and complete `references/` trees.

## Check and update

Detect source drift without modifying the installed skill:

```bash
monoskill check <skill-dir>
monoskill check <skill-dir> --json
```

Exit status `0` means current. Exit status `2` means the source commit or one or more skill hashes changed. Read `added`, `removed`, and `changed` from JSON output when automating.

After inspecting drift and receiving authorization, rebuild atomically from `provenance.json`:

```bash
monoskill update <skill-dir>
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
