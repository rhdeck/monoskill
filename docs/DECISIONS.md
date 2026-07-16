# Decisions

This log records settled, load-bearing product and implementation choices. Newest entries go first.

## 2026-07-16 — Bootstrap consumers from the exact public registry release

After the OIDC workflow published and verified `monoskill@0.3.0` with npm provenance, every consumer CLI command moved from a pinned GitHub checkout to `npx --yes monoskill@0.3.0`. The website generator, README, and bundled agent skill share that exact executable contract, while `npx skills add rhdeck/monoskill --skill monoskill` remains the separate standard agent-skill installer. Contract tests compare the working CLI help to the registry artifact and reject any return of the old GitHub bootstrap.

## 2026-07-16 — Publish only through a version-matched npm OIDC workflow

The sole automated publisher is the tag-triggered, GitHub-hosted `.github/workflows/publish.yml`, bound in npm as `rhdeck / monoskill / publish.yml` with no environment and allowed action `npm publish`. It uses Node 24 and npm 11.5.1, has only `contents: read` and `id-token: write`, carries no npm token fallback or release cache, and serializes all package releases. Preflight requires exact package/registry metadata, `v<package-version>`, identical tag/event/checkout commits, clean packaged bytes, an unpublished immutable version, and an exact tarball; simulation plus packed-install smoke exercises every pre-publish repository-controlled step except the outward publish. Issue #13's public-repository cutover precedes the first release so trusted publishing can generate npm's automatic provenance attestation. The workflow then verifies the clean-cache registry artifact, provenance, deterministic archives, and project/global lifecycle as its immutable release receipt.

## 2026-07-16 — Publish the source repository only through a disclosure gate

Monoskill's source repository is intended to be public so users can inspect and install the CLI and agent skill, and so npm trusted publishing can attach provenance to public releases. A visibility change requires a history-aware secret scan, targeted review of every reachable ref, inspection of the GitHub collaboration and Actions surfaces, a merged audit receipt, and anonymous post-flip verification. A credential or private-data finding blocks publication until rotation and remediation are complete; cleanup after publication is not an acceptable sequence.

## 2026-07-16 — Keep the agent skill narrow and CLI-backed

The distributable `monoskill` agent skill triggers only on explicit Monoskill or compile-as-one intent. Its root contains the mental model and safety workflow, while exact commands live in one progressively disclosed reference whose command and option names are validated against CLI help.

## 2026-07-16 — Name the one-command workflow `add` and deploy one canonical copy

The source-to-harness command is `add`, matching the familiar `skills add` verb while preserving Monoskill's distinct unit: it compiles all discovered upstream skills and deploys one router skill. Project scope is the default; global scope requires `--yes`. Each scope stores the compiled directory under `.agents/skills/<name>` and links explicit Codex and Claude Code harness targets to it. Collisions are refused rather than inferred safe, deployment provenance is recorded, and `check`/`update` continue to operate after installation. This canonical-copy-plus-links layout prevents separately copied harness targets from drifting.

## 2026-07-16 — Make `.skill` a deterministic, archive-only build target

A `.skill` artifact is a standard ZIP whose root exactly matches the generated directory contract, without an enclosing folder. `package` converts an existing compiled directory; `build --archive` compiles through a temporary directory and leaves only the archive. Entries are ordered lexically with normalized timestamps, while file modes, symlinks, empty directories, provenance, and complete reference trees are preserved. Direct archive builds record `compiledAt: null` so the build clock cannot change artifact bytes. Archive publication refuses existing paths unless `--force` is explicit.

## 2026-07-15 — Publish the CLI as `monoskill`

The public npm package and executable are named `monoskill`. The singular name describes the product's core transformation: many upstream skills become one composed skill and one trigger surface.

## 2026-07-14 — Preserve provenance and complete upstream skill trees

Generated output includes `provenance.json` with the source URL, requested ref, resolved commit, source paths, and content hashes. Each upstream skill directory is copied intact under `references/<skill>/` so relative scripts, assets, and references continue to work. Provenance and updateability are product behavior, not optional metadata.

## 2026-07-14 — Keep the root router compact

The generated root `SKILL.md` contains short route summaries and points into progressively disclosed references. Full upstream descriptions do not belong in the root routing table because loading them all defeats the context-saving purpose of the mono-skill.

## 2026-07-14 — Start with direct-execution JavaScript

The first CLI uses JavaScript rather than a TypeScript build pipeline to keep npm/npx execution direct, publishing simple, and debugging transparent. Stronger typing remains available if expanding source adapters or manifest schemas makes the added build step worthwhile.

## 2026-07-14 — Make updates atomic

`update` compiles into staging, swaps the generated directory only after compilation succeeds, and restores the prior directory if the swap fails. An upstream error must not destroy a working installed skill.
