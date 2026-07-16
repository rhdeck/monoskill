# Monoskill agent guide

Monoskill is a Node.js CLI that compiles a repository containing many agent skills into one provenance-aware router skill. The project is graveyard-managed: GitHub issues are the work queue, pull requests are the delivery surface, and the strategic project state is linked from `docs/OVERVIEW.md`.

repo-type: code
project-types: none

## Canon

- Read `docs/ARCHITECTURE.md` before changing compiler boundaries or output layout.
- Read `docs/DECISIONS.md` before revisiting settled product or implementation choices.
- Use `docs/OVERVIEW.md` to find the human-facing strategic state in Notion.
- Treat open GitHub issues as future work. Do not write unshipped aspirations into architecture canon.

## Working rules

- Requires Node.js 20 or newer.
- Install dependencies with `npm install` and run the complete test suite with `npm test`.
- Run `npm run check` for JavaScript syntax validation.
- Exercise CLI changes through the published-style entry point: `node bin/monoskill.js <command>`.
- Preserve the generated skill contract: a compact root `SKILL.md`, `agents/openai.yaml`, full upstream trees under `references/`, and `provenance.json`.
- Preserve user artifacts. Never overwrite an output directory or packaged artifact silently.
- Keep source resolution compatible with GitHub shorthand, Git URLs, and local directories.
- Every merge must close or explicitly advance its GitHub issue and include tests proportional to the behavior changed.

