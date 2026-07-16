---
name: monoskill
description: Use the Monoskill CLI when explicitly asked to package or deploy a repository of agent skills as one provenance-aware router, or check or update Monoskill output. Do not trigger for general skill authoring or installing individual skills.
---

# Monoskill

Turn many upstream skills into one compact router skill. Preserve every upstream skill tree under `references/` and use `provenance.json` to detect and apply source drift.

## Workflow

1. Read [references/cli.md](references/cli.md) before choosing or running a command.
2. Prefer `add --dry-run --json` to resolve the source and preview every deployment target without writing to a harness.
3. Inspect the source and destination. Never replace an existing build directory, archive, or installation unless the user explicitly authorized that exact target.
4. Run the chosen command through the exact public-registry `npx` invocation in the reference, or an already-installed `monoskill` executable of the same version. Use machine-readable output when available.
5. Verify the result, not just the exit code: inspect `SKILL.md`, `agents/openai.yaml`, `provenance.json`, and a representative bundled reference or archive entry.
6. Run `check` after deployment and report detected drift. Use `update` only when the user has authorized replacing the installed output.

Keep the distinction clear: Monoskill compiles a repository of skills into one routed skill. It does not select or install individual upstream skills.
