# Architecture

## Purpose

Monoskill compiles a collection of independently authored agent skills into one router skill. The router exposes a single, concise trigger surface while preserving each source skill as a progressively disclosed reference and recording enough provenance to detect and apply upstream changes.

## Runtime shape

The package is an ECMAScript-module Node.js CLI requiring Node.js 20 or newer.

- `bin/monoskill.js` is the npm executable entry point. It delegates to the CLI module and owns top-level error reporting.
- `src/cli.js` parses `add`, `build`, `package`, `check`, and `update` commands and renders human or JSON output.
- `src/source.js` resolves a local directory, Git URL, or GitHub `owner/repo` shorthand into a materialized Git working tree with a resolved commit.
- `src/compiler.js` discovers skills, parses YAML frontmatter, hashes and copies upstream trees, renders the compact router, and implements drift checks and atomic updates.
- `src/deploy.js` plans project or global harness targets, compiles into isolated staging, records deployment provenance, refuses collisions, and atomically publishes one canonical skill plus per-agent symlinks.
- `src/archive.js` validates generated skills and writes deterministic, atomically published ZIP-format `.skill` artifacts.
- `test/monoskill.test.js` exercises the full compile/check/update lifecycle against a temporary local Git repository.

## Build flow

1. Materialize the requested source and resolve its commit.
2. Use the configured skills directory, the conventional `skills/` directory, or the repository root.
3. Discover directories containing `SKILL.md`; once a skill root is found, do not recursively treat its nested references as sibling skills.
4. Parse each skill's YAML frontmatter, normalize its name, and hash its complete directory tree.
5. Stage the generated output, then atomically replace the destination directory.
6. Clean up temporary source material even when compilation fails.

## Generated skill contract

```text
<name>/
├── SKILL.md
├── agents/openai.yaml
├── provenance.json
└── references/
    └── <upstream-skill>/...
```

`SKILL.md` is intentionally compact. `references/` preserves upstream content without rewriting internal paths. `provenance.json` is the machine-readable source of truth for `check` and `update`.

## Archive flow

`package` validates an existing generated directory, enumerates its complete tree in lexical order, and writes a ZIP archive with normalized timestamps. Regular file contents and modes, symlinks, and empty directories are preserved. The archive has no enclosing directory: its root has the same generated skill contract shown above.

Archive publication is staged beside the destination. A new artifact is linked into place without an overwrite race, with an exclusive-copy fallback for filesystems that do not support hard links; `--force` opts into replacement. `build --archive` compiles in a temporary directory, packages it, and removes the intermediate tree. It records `compiledAt: null` instead of a volatile wall clock so identical source and options produce identical artifacts.

## Drift and update

`check` rebuilds from the recorded source into a temporary directory and compares resolved commits and per-skill hashes. It reports added, removed, and changed skills without mutating the installation. `update` uses the same provenance to rebuild and atomically replace the installed directory.

When an installation was created by `add`, deployment metadata is retained across updates. `update` resolves a supplied harness symlink before swapping so every agent link continues to point at the one canonical installation.

## Harness deployment

`add` is the source-to-installed-skill operation. It uses `.agents/skills/<name>` as the canonical compiled directory in either the current project or the user's home directory. Codex and Claude Code receive relative directory symlinks from their conventional `.codex/skills` and `.claude/skills` roots. A relative link keeps a project tree relocatable while a single canonical copy prevents agent targets from drifting independently.

Target discovery and collision checks happen before compilation. Compilation happens in a temporary directory; harness mutation begins only after it succeeds. Deployment creates the canonical directory first, creates requested links second, and removes everything created by that attempt if a later deployment step fails. Existing canonical paths, files, directories, or even dangling links are collisions and are never replaced.

Project scope needs no confirmation. Global scope requires `--yes`, while `--dry-run` performs source resolution and compilation but no harness writes. JSON errors carry the failed boundary so automation can distinguish source, compilation, target-discovery, and deployment failures.

## Current boundaries

- Monoskill deploys generated skill directories into Codex and Claude Code harness roots. Portable `.skill` archive extraction and third-party harness adapters remain outside the deployment surface.
- The repository currently contains only the CLI package. The website and AI-facing Monoskill skill are tracked as GitHub initiatives, not current architecture.
- Network access is required only for remote Git sources; local-source builds remain local.
