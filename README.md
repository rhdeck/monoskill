# monoskill

Compile a repository full of agent skills into one provenance-aware router skill. The generated skill exposes one trigger surface, keeps upstream skills behind progressive-disclosure references, and records exactly which repository revision and content hashes produced it.

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

## Source conventions

Sources can be GitHub shorthand (`owner/repo`), any Git clone URL, or a local directory. `monoskill` uses `skills/` when present; otherwise it searches the repository. Override that with `--skills-dir`. Pin a branch, tag, or commit with `--ref`.

Each discovered skill must be a directory containing `SKILL.md` with YAML frontmatter. Its entire directory is preserved so relative links to scripts, references, and assets continue to work.

## Development

```bash
npm install
npm test
```

MIT
