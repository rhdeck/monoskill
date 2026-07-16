# monoskill

Compile a repository full of agent skills into one provenance-aware router skill. The generated skill exposes one trigger surface, keeps upstream skills behind progressive-disclosure references, and records exactly which repository revision and content hashes produced it.

## Install in one command

`add` resolves the source, compiles every upstream skill into one router, and installs that one generated skill. Project scope is the safe default:

```bash
npx github:rhdeck/monoskill add coreyhaines31/marketingskills \
  --name corey-marketing
```

The canonical skill path is `.agents/skills/corey-marketing`; it atomically points to the active compiled version. By default Monoskill links both `.codex/skills/corey-marketing` and `.claude/skills/corey-marketing` to it, so there is one active copy to check and update. Limit the links by repeating `--agent`:

```bash
npx github:rhdeck/monoskill add coreyhaines31/marketingskills \
  --name corey-marketing \
  --agent codex --agent claude-code
```

Global installation uses the same layout under the user's home directory and requires explicit non-interactive confirmation:

```bash
npx github:rhdeck/monoskill add coreyhaines31/marketingskills \
  --name corey-marketing \
  --agent codex --agent claude-code \
  --global --yes
```

Use `--dry-run` to resolve and compile the source while previewing all destinations without writing to a harness. Add `--json` for machine-readable success or error output. Monoskill refuses the whole operation if the canonical path or any requested agent path already exists; it never guesses that a collision is safe to replace.

Each installed `provenance.json` records the source revision, compiled skill hashes, scope, canonical path, agent targets, and link mode. Drift checks and atomic updates operate on the canonical installation; passing an agent symlink to `update` is also safe:

```bash
npx github:rhdeck/monoskill check .agents/skills/corey-marketing
npx github:rhdeck/monoskill update .codex/skills/corey-marketing
```

The command is named `add` to match the familiar `skills add` source-to-harness flow. Its installed unit remains deliberately different: Monoskill always compiles many source skills into one provenance-aware router rather than selecting or installing the upstream skills individually.

Failure messages name the boundary that failed: source resolution, compilation, target discovery, or deployment.

## Compile without installing

```bash
npx github:rhdeck/monoskill build coreyhaines31/marketingskills \
  --name corey-marketing \
  --output ~/.agents/skills/corey-marketing
```

The output is a normal agent skill:

```text
corey-marketing/
├── SKILL.md                 # compact routing instructions and route table
├── agents/openai.yaml       # Codex UI metadata
├── provenance.json          # source, commit, paths, hashes, compile timestamp
└── references/
    ├── copywriting/         # upstream skill preserved as a self-contained tree
    ├── seo-audit/
    └── ...
```

Detect vendor drift without modifying the installed skill:

```bash
npx github:rhdeck/monoskill check ~/.agents/skills/corey-marketing
```

Exit status is `0` when current and `2` when the upstream commit changed or skills were added, removed, or changed. Use `--json` for automation.

Rebuild from the source recorded in `provenance.json`:

```bash
npx github:rhdeck/monoskill update ~/.agents/skills/corey-marketing
```

The replacement is staged and swapped atomically. A failed swap restores the previous skill.

## Portable `.skill` archives

A `.skill` file is a standard ZIP archive whose root is the generated skill root. It contains `SKILL.md`, `agents/openai.yaml`, `provenance.json`, the complete `references/` trees, and every other file in the compiled directory. There is no extra enclosing directory, so extracting the archive directly produces a usable skill.

Package an existing compiled skill:

```bash
npx github:rhdeck/monoskill package ./corey-marketing
# writes ./corey-marketing.skill
```

Or compile directly to one portable file without retaining an intermediate directory:

```bash
npx github:rhdeck/monoskill build coreyhaines31/marketingskills \
  --name corey-marketing \
  --archive
```

Use `--output ./artifacts/corey-marketing.skill` to choose the archive path. Archive output must end in `.skill` and must live outside the input skill directory. Existing artifacts are never replaced unless `--force` is explicit.

Before packaging, Monoskill validates the generated root files, the provenance manifest, and every referenced skill entrypoint. Entries are stored in lexical order with normalized timestamps while preserving file contents, relative paths, filesystem modes, symlinks, and empty directories. Packaging the same compiled tree twice therefore produces byte-identical archives. Direct archive builds also omit the volatile build clock (`compiledAt` is `null`), so compiling the same source and options produces the same bytes.

## Source conventions

Sources can be GitHub shorthand (`owner/repo`), a full GitHub repository URL, a GitHub `/tree/<ref>/<path>` URL, any Git clone URL, or a local directory. `monoskill` uses `skills/` when present; otherwise it searches the repository. A tree URL supplies its ref and source path; explicit `--ref` and `--skills-dir` values override source inference. Pin a branch, tag, or commit with `--ref`.

Each discovered skill must be a directory containing `SKILL.md` with YAML frontmatter. Its entire directory is preserved so relative links to scripts, references, and assets continue to work.

## Development

```bash
npm install
npm test
npm run check
```

MIT
