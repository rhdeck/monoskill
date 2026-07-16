# Decisions

This log records settled, load-bearing product and implementation choices. Newest entries go first.

## 2026-07-16 — Make `.skill` a deterministic, archive-only build target

A `.skill` artifact is a standard ZIP whose root exactly matches the generated directory contract, without an enclosing folder. `package` converts an existing compiled directory; `build --archive` compiles through a temporary directory and leaves only the archive. Entries are ordered lexically with normalized timestamps, while file modes, symlinks, empty directories, provenance, and complete reference trees are preserved. Archive publication refuses existing paths unless `--force` is explicit.

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
