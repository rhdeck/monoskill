# Architecture

## Purpose

Monoskill compiles a collection of independently authored agent skills into one router skill. The router exposes a single, concise trigger surface while preserving each source skill as a progressively disclosed reference and recording enough provenance to detect and apply upstream changes.

## Runtime shape

The package is an ECMAScript-module Node.js CLI requiring Node.js 20 or newer.

- `bin/monoskill.js` is the npm executable entry point. It delegates to the CLI module and owns top-level error reporting.
- `src/cli.js` parses `build`, `package`, `check`, and `update` commands and renders human or JSON output.
- `src/source.js` resolves a local directory, Git URL, or GitHub `owner/repo` shorthand into a materialized Git working tree with a resolved commit.
- `src/compiler.js` discovers skills, parses YAML frontmatter, hashes and copies upstream trees, renders the compact router, and implements drift checks and atomic updates.
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

## Current boundaries

- Monoskill compiles and packages repositories of skills; it does not install archives into agent harnesses.
- The repository currently contains only the CLI package. The website and AI-facing Monoskill skill are tracked as GitHub initiatives, not current architecture.
- Network access is required only for remote Git sources; local-source builds remain local.
