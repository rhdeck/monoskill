# Monoskill website

Static product site and install-prompt generator. GSAP is bundled into the self-contained production artifact; local visual review adds a dev-only Agentation island.

## Run locally

```bash
npm run website:dev
```

Open `http://127.0.0.1:4173`. This development server adds the Agentation toolbar for element-level visual feedback. Annotations stay in the browser unless you explicitly copy or send them. Agentation and its React island are development dependencies; neither enters `website/dist/` or loads on `monoskill.com`.

For a production-like preview without the feedback toolbar:

```bash
npm run website:serve
```

The generator runs entirely in the browser. It does not submit, store, or log source values. On the canonical `monoskill.com` host only, the built-in collector sends these events to Plausible's Events API:

- `source_input_completed` with `source_type` (`github-shorthand`, `git-url`, or `local-path`)
- `copy_cli`
- `copy_ai_prompt`

The payload allowlist contains event name, canonical path without query/hash, and the three-value `source_type`. Tests prove source and generated-name values cannot enter the payload. Local previews never send analytics.

## Verify

```bash
npm test
npm run check
npm run website:test
```

The Playwright test starts the local server and covers desktop, mobile, keyboard focus, validation, copy generation, analytics privacy, and reduced motion. Visual receipts are written to `website/artifacts/` and are intentionally ignored by git.

The generated CLI command is version-exact: `npx --yes monoskill@0.4.0`. The separate agent prompt retains `npx skills add statechange/monoskill --skill monoskill` because the skill installer discovers the repository's bundled skill rather than the npm CLI tarball.

## Production checklist

1. Run `npm test`, `npm run check`, `npm run website:build`, and `npm run website:test`.
2. Merge to `main`; `.github/workflows/deploy-site.yml` rebuilds and deploys the verified output to the existing `statechange-monoskill` Netlify site.
3. Use `npx --yes netlify-cli@24.11.1 link --name statechange-monoskill` followed by `npx --yes netlify-cli@24.11.1 deploy --build --prod` only for an explicitly authorized recovery deploy.
4. Verify the actual production surface with `curl -fsSI https://monoskill.com/`, `curl -fsSI https://monoskill.com/og-image.png`, and `npx lighthouse https://monoskill.com/ --only-categories=performance,accessibility,best-practices,seo`.
5. Confirm the Open Graph image response is `image/png` at exactly 1200 × 630 and every public project link works without authentication.
6. Confirm the three custom events arrive with only the allowlisted `source_type` property. Source and generated-name values must never enter the analytics payload.

The canonical production site is `https://monoskill.com/`. The generated `website/dist/` directory is disposable and intentionally ignored by git.
