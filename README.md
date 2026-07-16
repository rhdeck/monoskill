# monoskill

Compile a repository full of agent skills into one provenance-aware router skill. The generated skill exposes one trigger surface, keeps upstream skills behind progressive-disclosure references, and records exactly which repository revision and content hashes produced it.

## Install in one command

`add` resolves the source, compiles every upstream skill into one router, and installs that one generated skill. Project scope is the safe default:

```bash
npx --yes monoskill@0.3.2 add coreyhaines31/marketingskills \
  --name corey-marketing
```

The canonical skill path is `.agents/skills/corey-marketing`; it atomically points to the active compiled version. By default Monoskill links both `.codex/skills/corey-marketing` and `.claude/skills/corey-marketing` to it, so there is one active copy to check and update. Limit the links by repeating `--agent`:

```bash
npx --yes monoskill@0.3.2 add coreyhaines31/marketingskills \
  --name corey-marketing \
  --agent codex --agent claude-code
```

Global installation uses the same layout under the user's home directory and requires explicit non-interactive confirmation. Codex honors `CODEX_HOME`; Claude Code honors `CLAUDE_CONFIG_DIR`, so configured harness roots are discovered instead of forced back to the defaults:

```bash
npx --yes monoskill@0.3.2 add coreyhaines31/marketingskills \
  --name corey-marketing \
  --agent codex --agent claude-code \
  --global --yes
```

Use `--dry-run` to resolve and compile the source while previewing all destinations without writing to a harness. Add `--json` for machine-readable success or error output. Monoskill refuses the whole operation if the canonical path or any requested agent path already exists; it never guesses that a collision is safe to replace.

Each installed `provenance.json` records the source revision, compiled skill hashes, scope, relocatable canonical path, agent targets, and link mode. Drift checks and atomic updates operate on the canonical installation; passing an agent symlink to `update` is also safe:

```bash
npx --yes monoskill@0.3.2 check .agents/skills/corey-marketing
npx --yes monoskill@0.3.2 update .codex/skills/corey-marketing
```

The command is named `add` to match the familiar `skills add` source-to-harness flow. Its installed unit remains deliberately different: Monoskill always compiles many source skills into one provenance-aware router rather than selecting or installing the upstream skills individually.

Failure messages name the boundary that failed: source resolution, compilation, target discovery, or deployment.

## Compile without installing

```bash
npx --yes monoskill@0.3.2 build coreyhaines31/marketingskills \
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
npx --yes monoskill@0.3.2 check ~/.agents/skills/corey-marketing
```

Exit status is `0` when current and `2` when the upstream commit changed or skills were added, removed, or changed. Use `--json` for automation.

Rebuild from the source recorded in `provenance.json`:

```bash
npx --yes monoskill@0.3.2 update ~/.agents/skills/corey-marketing
```

The replacement is staged and swapped atomically. A failed swap restores the previous skill.

## Portable `.skill` archives

A `.skill` file is a standard ZIP archive whose root is the generated skill root. It contains `SKILL.md`, `agents/openai.yaml`, `provenance.json`, the complete `references/` trees, and every other file in the compiled directory. There is no extra enclosing directory, so extracting the archive directly produces a usable skill.

Package an existing compiled skill:

```bash
npx --yes monoskill@0.3.2 package ./corey-marketing
# writes ./corey-marketing.skill
```

Or compile directly to one portable file without retaining an intermediate directory:

```bash
npx --yes monoskill@0.3.2 build coreyhaines31/marketingskills \
  --name corey-marketing \
  --archive
```

Use `--output ./artifacts/corey-marketing.skill` to choose the archive path. Archive output must end in `.skill` and must live outside the input skill directory. Existing artifacts are never replaced unless `--force` is explicit.

Before packaging, Monoskill validates the generated root files, the provenance manifest, and every referenced skill entrypoint. Entries are stored in lexical order with normalized timestamps while preserving file contents, relative paths, filesystem modes, symlinks, and empty directories. Packaging the same compiled tree twice therefore produces byte-identical archives. Direct archive builds also omit the volatile build clock (`compiledAt` is `null`), so compiling the same source and options produces the same bytes.

## Agent skill

Install the lightweight Monoskill skill with standard agent-skill tooling:

```bash
npx skills add statechange/monoskill --skill monoskill
```

The skill triggers on explicit Monoskill and compile-as-one requests, teaches agents to use the real CLI, and keeps detailed commands behind progressive disclosure. It also requires destination inspection before any operation that could replace an existing output.

## Source conventions

Sources can be GitHub shorthand (`owner/repo`), a full GitHub repository URL, a GitHub `/tree/<ref>/<path>` URL, any Git clone URL, or a local directory. `monoskill` uses `skills/` when present; otherwise it searches the repository. A tree URL supplies its ref and source path; explicit `--ref` and `--skills-dir` values override source inference. Pin a branch, tag, or commit with `--ref`.

Each discovered skill must be a directory containing `SKILL.md` with YAML frontmatter. Its entire directory is preserved so relative links to scripts, references, and assets continue to work.

## Development

```bash
npm install
npm test
npm run check
npm run validate:skill
```

## Releasing (maintainers)

Releases use npm Trusted Publishing from `.github/workflows/publish.yml`; there is no npm write token or manual workflow fallback. The target npm package binding for the ownership cutover is:

- Provider: GitHub Actions
- Organization or user: `statechange`
- Repository: `monoskill`
- Workflow filename: `publish.yml`
- Environment: none
- Allowed action: `npm publish`

Treat that target as active only after npm accepts it and an OIDC release from `statechange/monoskill` publishes with matching provenance.

The only trigger is a pushed `v*` tag. Before publishing, the GitHub-hosted workflow requires Node 24 and npm 11.5.1, runs the complete release simulation, then fails unless the tag is exactly `v<package.json version>`, the tag, event, and checkout resolve to the same commit, that repository and commit are anonymously readable from GitHub, packaged worktree bytes are clean, the version is still absent from the exact public registry, and the dry-run tarball contains exactly the intended package files. Releases are serialized package-wide and never cancel one another. Do not create a tag until its package version is ready: npm versions are immutable, so a failed or incorrect published version is repaired only with a new version, never by moving or replaying the tag.

Run `npm run release:simulate` before tagging to exercise tests, syntax and skill validation, metadata, registry availability, tarball inspection, and installation/execution from the packed artifact. It performs no publish. The actual tag must still run the non-simulated preflight in GitHub Actions.

OIDC publishing can work from a private GitHub repository, but npm automatic provenance cannot. Issue #13 completed the disclosure audit, public visibility change, and anonymous-access verification before the first release. The preflight rechecks public repository and commit access on every release; an OIDC publish of this public package then receives npm's automatic provenance attestation. The workflow deliberately does not disable it or add a redundant `--provenance` flag.

After `npm publish`, the same workflow waits for the clean-cache registry artifact and validates that its npm and SLSA attestations bind the package digest to this repository, `publish.yml`, the version tag, exact commit, push event, and GitHub-hosted runner. It then executes `monoskill@<version>`, checks deterministic `.skill` output against a pinned Corey Haines source commit, and exercises isolated project and global `add`, `check`, and `update` flows. A failed post-publish smoke cannot overwrite or retract the immutable version; it is a release receipt and a signal to fix forward with a new version if the artifact itself is wrong.

See [CONTRIBUTING.md](CONTRIBUTING.md) for change and verification expectations. Report suspected vulnerabilities privately according to [SECURITY.md](SECURITY.md).

MIT

## Website

The static website and source-to-command generator live in [`website/`](website/). Run it locally with:

```bash
npm run website:serve
```

The website is intentionally not part of the published npm package. Production is available at [monoskill.com](https://monoskill.com/); see [`website/README.md`](website/README.md) for browser checks, metadata, analytics privacy, and the Netlify production contract.
