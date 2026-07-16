# Contributing to Monoskill

Issues and pull requests are welcome. Before starting a substantial change, open an issue so the behavior and compatibility boundary can be agreed on first.

## Development checks

Monoskill requires Node.js 20 or newer. From a clean checkout:

```bash
npm install
npm test
npm run check
npm run validate:skill
```

Exercise CLI changes through the published-style entry point, for example `node bin/monoskill.js --help`. Changes to source resolution, compilation, archives, deployment, drift detection, or updates should include an integration test that covers the affected boundary.

Keep generated router roots compact, preserve complete upstream skill trees, and never silently replace a user's output or installed skill.

## Security reports

Do not open a public issue for a suspected vulnerability or exposed credential. Follow [SECURITY.md](SECURITY.md) instead.
