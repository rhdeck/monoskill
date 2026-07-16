# Public disclosure audit

## Decision

The 2026-07-16 disclosure audit found no secret or private-data blocker to publishing `statechange/monoskill`. Repository visibility may change to public only after the preparation PR containing this report merges and the pre-flip gate below is repeated against the then-current remote refs and collaboration surfaces.

One disclosure defect was found outside Git history: seven running-register issue comments exposed absolute workstation and internal worker paths. Those comments were edited in place before the clean collaboration-corpus rescan. No credential required rotation and no history rewrite was required.

## Audited surface

The baseline included:

- every fetched remote branch and tag, including unmerged feature branches;
- all 23 reachable commits and 624 Git objects present after the trusted-publishing and website-launch branches were fetched;
- the working tree, package metadata, distributable agent skill, and every workflow version reachable from remote refs;
- 14 issue/pull-request records, 19 issue comments, six pull requests and their reviews/comments, commit comments, releases, and repository metadata;
- six GitHub Actions runs and their logs, plus Actions artifacts, repository secrets, variables, and environments.

At baseline there were no Git tags, releases, Actions artifacts, repository Actions secrets, variables, environments, pull-request review comments, or commit comments.

## Scanner receipt

Gitleaks 8.30.1 was downloaded into a unique temporary tooling directory from the official `gitleaks/gitleaks` GitHub release. It was not installed globally or committed to the repository.

The history-aware scan was:

```bash
git fetch --all --tags --prune
gitleaks git . \
  --log-opts='--all --full-history' \
  --redact=100 \
  --report-format=json \
  --report-path="$report" \
  --no-banner --no-color
```

Receipt: 23 commits and approximately 267.76 KB scanned; exit status 0; zero findings. A separate scan of the uncommitted preparation tree, including this report, scanned approximately 109.48 KB with exit status 0 and zero findings.

The GitHub collaboration corpus was exported with the REST endpoints for issues, issue comments, pulls, pull review comments, commit comments, pull reviews, releases, Actions runs, and Actions artifacts. Every available Actions log was added, then the directory was scanned with:

```bash
gitleaks dir "$corpus" \
  --redact=100 \
  --report-format=json \
  --report-path="$corpus/gitleaks.json" \
  --no-banner --no-color
```

Receipt after path remediation and the two new pull-request runs: approximately 495.36 KB scanned; exit status 0; zero findings. Targeted expressions also returned no absolute workstation paths, internal worker paths, or unredacted credential patterns. Actions logs contain GitHub's expected redacted checkout header (`AUTHORIZATION: basic ***`), never its value.

## Targeted checks and adjudication

All reachable history was searched independently of Gitleaks for common cloud, GitHub, npm, OpenAI, Slack, and private-key formats; credential assignments; sensitive filenames; private-network URLs; email addresses; hosted workspace links; absolute user paths; large blobs; and generated-artifact extensions.

The only matches were reviewed and accepted:

- `/Users/example/skills` and `test@example.com` are explicit test fixtures;
- `127.0.0.1:4173` is the website branch's loopback-only development server;
- `docs/OVERVIEW.md` intentionally links to the canonical human-facing Notion Project Overview;
- the website branch tracks one public Open Graph image and no other artifact-like binary;
- commit metadata identifies the repository owner using the same public identity as the license and GitHub account.

No sensitive filename or blob at least 100 KiB was reachable. No customer data, real local user path, private service URL, credential, token, key, or certificate was found.

## Workflow and fork safety

Ordinary CI runs on `pull_request` and pushes to `main`. Repository Actions settings give `GITHUB_TOKEN` read-only default permissions and prohibit workflow approval of pull requests. CI has no job-level write permission, secret reference, privileged environment, `pull_request_target`, or self-hosted runner. Untrusted pull-request code therefore receives no repository credential with useful write authority.

The trusted-publishing branch adds a separate tag-push workflow. It grants only `contents: read` and `id-token: write`, uses a GitHub-hosted runner, and invokes `npm publish` without `NODE_AUTH_TOKEN`, `NPM_TOKEN`, `_authToken`, or an Actions cache. The package metadata sets the repository to `git+https://github.com/statechange/monoskill.git`, which resolves to `https://github.com/statechange/monoskill` as required by the release contract.

## Public repository contract

- The MIT license, package description, repository description, README, and package identity are mutually consistent.
- [CONTRIBUTING.md](../CONTRIBUTING.md) defines the public contribution and verification expectations.
- [SECURITY.md](../SECURITY.md) directs sensitive reports to GitHub private vulnerability reporting rather than public issues.
- The repository homepage remains unset until the separately tracked website has a verified production URL.
- The Notion link remains the intentional pointer to strategic project state; technical canon stays in this repository.

## Required pre-flip gate

Immediately before changing visibility:

1. fetch and enumerate all current remote refs and tags;
2. rerun the history-aware and targeted scans, including any newly pushed branch;
3. re-export and scan the GitHub collaboration corpus and current Actions logs/artifacts;
4. confirm the preparation PR is merged and `main` CI is green;
5. confirm no new secret, private path, customer data, or unsafe workflow has appeared.

If any check fails, do not change visibility. Revoke or rotate exposed credentials first, remediate the collaboration surface, and use an explicit history-rewrite plan if the sensitive material is reachable from Git.

After the flip, verify repository visibility through GitHub's API, anonymous HTTPS web access, a credential-free clone, public CI, standard skill discovery, and private vulnerability reporting. Record the live receipts on issue #13.
