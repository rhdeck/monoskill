# Monoskill website

Static, dependency-free product site and install-prompt generator.

## Run locally

```bash
npm run website:serve
```

Open `http://127.0.0.1:4173`. The generator runs entirely in the browser. It does not submit, store, or log source values. On the canonical `monoskill.statechange.ai` host only, the built-in collector sends these events to Plausible's Events API:

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

## Production checklist

1. Run `npm test`, `npm run check`, `npm run website:build`, and `npm run website:test`.
2. Link the repository to the `statechange-monoskill` Netlify site with `netlify link --name statechange-monoskill`.
3. Publish the production build and its `netlify.toml` headers with `netlify deploy --build --prod`.
4. Verify the actual production surface with `curl -fsSI https://monoskill.statechange.ai/`, `curl -fsSI https://monoskill.statechange.ai/og-image.png`, and `npx lighthouse https://monoskill.statechange.ai/ --only-categories=performance,accessibility,best-practices,seo`.
5. Confirm the Open Graph image response is `image/png` at exactly 1200 × 630 and every public project link works without authentication.
6. Confirm the three custom events arrive with only the allowlisted `source_type` property. Source and generated-name values must never enter the analytics payload.

The canonical production site is `https://monoskill.statechange.ai/`. The generated `website/dist/` directory is disposable and intentionally ignored by git.
