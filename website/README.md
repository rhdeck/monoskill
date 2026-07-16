# Monoskill website

Static, dependency-free product site and install-prompt generator.

## Run locally

```bash
npm run website:serve
```

Open `http://127.0.0.1:4173`. The generator runs entirely in the browser. It does not submit, store, or log source values. On the canonical `monoskill.dev` host only, the built-in collector sends these events to Plausible's Events API:

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

1. Confirm the public repository, npm package, issue, and documentation links resolve without authentication.
2. Choose and authorize a host and the canonical domain. The draft metadata assumes `https://monoskill.dev/`; change the canonical, Open Graph URL, robots sitemap, and sitemap URL together if the domain differs.
3. Run `npm run website:build`. The disposable `website/dist/` directory contains only the ten public static files.
4. For the prepared Cloudflare Pages path, authenticate Wrangler locally, create or select the authorized `monoskill` Pages project, then run `npx wrangler pages deploy website/dist --project-name monoskill --branch main`. This command is documentation, not deployment authorization.
5. After DNS is attached, verify the actual production surface with `curl -fsSI https://monoskill.dev/`, `curl -fsSI https://monoskill.dev/og-image.png`, and `npx lighthouse https://monoskill.dev/ --only-categories=performance,accessibility,best-practices,seo --view`.
6. Confirm the Open Graph image response is `image/png` at exactly 1200 × 630 and every public project link works without authentication.
7. Register `monoskill.dev` in Plausible before launch and confirm the three custom events arrive with only the allowlisted `source_type` property.
8. Serve versioned static assets with long-lived immutable caching and HTML with revalidation in the selected host's headers configuration.

Public deployment is intentionally not configured in this draft because no isolated host or public channel has been authorized.
