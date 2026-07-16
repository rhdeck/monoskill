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
- `skills/monoskill/` is the distributable agent-facing adapter. Its compact root routes detailed CLI syntax to one reference; `scripts/validate-skill.js` checks its metadata and documented command surface against the CLI help.
- `.github/workflows/ci.yml` runs the full tests, syntax and skill-contract checks, and a standard-tooling install smoke on pull requests and `main`.
- `website/` is a dependency-light static brand site and client-side install-prompt generator. Its generator emits the exact public-registry `npx --yes monoskill@0.3.2 add <source> --name <name>` contract, shell-quotes every argument, and emits value-free analytics events. Unit and Playwright tests cover validation, generation, privacy, keyboard use, responsive behavior, and reduced motion.
- `.github/workflows/publish.yml` is the sole automated npm publisher. A GitHub-hosted Node 24 job uses npm OIDC, serializes releases package-wide, exercises the non-publishing simulation, then rechecks the real tag and immutable registry boundary immediately before `npm publish`.
- `scripts/release-preflight.js` owns release metadata, clean packaged bytes, tag/commit identity, immutable-version, and exact dry-run tarball invariants. `scripts/smoke-packed-cli.js` installs the produced tarball in an isolated directory and executes its binary. After publishing, `scripts/smoke-registry-release.js` proves clean-cache registry identity, SLSA provenance, deterministic archives, and project/global add-check-update behavior against a pinned upstream commit.

The website remains outside the npm package's `files` allowlist. Its development-only Playwright dependency does not ship to CLI consumers.

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

`add` is the source-to-installed-skill operation. It uses `.agents/skills/<name>` as the canonical path in either the current project or the user's home directory. That path is an atomically replaceable pointer to a private version under `.agents/skills/.monoskill/<name>/`; Codex and Claude Code receive relative directory symlinks from their adapter-discovered roots. Global adapters honor `CODEX_HOME` and `CLAUDE_CONFIG_DIR` before their `.codex/skills` and `.claude/skills` defaults. Deployment paths are recorded relative to the installation root, so moving a project does not disable atomic updates. Relative links keep a project tree relocatable while a single active compiled copy prevents agent targets from drifting independently.

Target discovery and collision checks happen before compilation. Project target discovery conservatively refuses existing harness parent symlinks, preventing target escape from the project root. Compilation happens in a temporary directory; harness mutation begins only after it succeeds. Deployment publishes the private version and canonical pointer first, creates requested links second, and removes published skill/link artifacts plus still-empty parent scaffolding if a later deployment step fails. Existing canonical paths, files, directories, or even dangling links are collisions and are never replaced.

Project scope needs no confirmation. Global scope requires `--yes`, while `--dry-run` performs source resolution and compilation but no harness writes. JSON errors carry the failed boundary so automation can distinguish source, compilation, target-discovery, and deployment failures.

## Current boundaries

- Monoskill deploys generated skill directories into Codex and Claude Code harness roots. Portable `.skill` archive extraction and third-party harness adapters remain outside the deployment surface.
- The repository contains the CLI package and the static website deployed through Netlify at `https://monoskill.statechange.ai/`. Its production metadata, security headers, redirect, and build contract live in `netlify.toml` and `website/`.
- `.github/workflows/deploy-site.yml` is the continuous production bridge for the organization-owned repository. It runs only from the `main` ref, whether triggered by a push or explicit dispatch, holds read-only GitHub permissions, rebuilds and browser-tests the verified static artifact on the same Node runtime as Netlify, and deploys to the existing site using an encrypted repository secret. The pinned Netlify CLI is installed by `npm ci` before the credential-bearing deploy step, which refuses dynamic package installation.
- Network access is required only for remote Git sources; local-source builds remain local.
- Release simulation reads the public npm registry to prove the candidate version is unpublished but has no outward write. The tag-driven workflow is the only publish path and cannot authenticate with a traditional npm write token.
- Consumer CLI examples and the website generator use the exact verified registry version. GitHub remains the source, provenance, and agent-skill discovery surface, not the CLI bootstrap.
