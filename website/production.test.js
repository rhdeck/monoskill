import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parse } from "yaml";

const origin = "https://monoskill.com";
const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("all discovery metadata uses the production origin", async () => {
  const [html, robots, sitemap, manifestText] = await Promise.all([
    read("./index.html"),
    read("./robots.txt"),
    read("./sitemap.xml"),
    read("./site.webmanifest")
  ]);
  const manifest = JSON.parse(manifestText);

  assert.match(html, new RegExp(`<link rel="canonical" href="${origin}/">`));
  assert.match(html, new RegExp(`<meta property="og:url" content="${origin}/">`));
  assert.match(html, new RegExp(`<meta property="og:image" content="${origin}/og-image-context.png">`));
  assert.match(html, new RegExp(`<meta name="twitter:image" content="${origin}/og-image-context.png">`));
  assert.equal(robots.includes(`${origin}/sitemap.xml`), true);
  assert.equal(sitemap.includes(`<loc>${origin}/</loc>`), true);
  assert.equal(manifest.id, `${origin}/`);
  assert.equal(manifest.start_url, `${origin}/`);
  assert.equal(manifest.scope, `${origin}/`);
  assert.equal(manifest.icons[0].src, `${origin}/favicon.svg`);
  assert.equal([html, robots, sitemap, manifestText].join("\n").includes("monoskill.dev"), false);
});

test("Netlify contract builds the verified static site with restrictive headers", async () => {
  const config = await read("../netlify.toml");
  assert.match(config, /command = "npm test && npm run check && npm run website:build"/);
  assert.match(config, /publish = "website\/dist"/);
  assert.match(config, new RegExp(`to = "${origin}/:splat"`));
  assert.match(config, /connect-src 'self' https:\/\/plausible\.io/);
  assert.match(config, /frame-ancestors 'none'/);
});

test("Agentation is available locally without entering the production bundle", async () => {
  const [app, html, dev, entry, packageText] = await Promise.all([
    read("./app.js"),
    read("./index.html"),
    read("./dev.js"),
    read("./agentation-entry.jsx"),
    read("../package.json")
  ]);
  const packageJson = JSON.parse(packageText);

  assert.equal(packageJson.scripts["website:dev"], "node website/dev.js");
  assert.equal(packageJson.devDependencies.agentation, "^3.0.2");
  assert.match(app, /\["127\.0\.0\.1", "localhost"\]/);
  assert.match(app, /import\("\.\/agentation\.js"\)/);
  assert.match(dev, /agentation-entry\.jsx/);
  assert.match(entry, /<Agentation \/>/);
  assert.doesNotMatch(html, /agentation\.js/);
});

test("State Change is credited as the giver", async () => {
  const [html, build] = await Promise.all([read("./index.html"), read("./build.js")]);
  assert.match(html, /<a class="gift-banner" href="https:\/\/statechange\.ai\/">/);
  assert.match(html, /<img src="\.\/state-change-logo\.png" alt="">/);
  assert.match(html, /A free gift from <strong>State Change<\/strong>/);
  assert.match(build, /"state-change-logo\.png"/);
});

test("the page leads with measured context savings and usable documentation", async () => {
  const html = await read("./index.html");
  assert.match(html, /Too many skills/);
  assert.match(html, /flood your context\./);
  assert.match(html, /class="flood"/);
  assert.match(html, /class="skill-field"/);
  assert.match(html, /class="skill-paths"/);
  assert.match(html, /visible from the start/);
  assert.match(html, /47 skills · one collection/);
  assert.equal((html.match(/<span>[a-z][a-z-]*<\/span>/g) || []).length, 47);
  assert.match(html, /47 skills become one/);
  assert.match(html, /99% less discovery context/);
  assert.match(html, /331 characters instead of 32,817/);
  assert.match(html, /npx --yes monoskill@0\.3\.2 add coreyhaines31\/marketingskills --name corey-marketing/);
  assert.match(html, /id="how-it-works"/);
  assert.doesNotMatch(html, /href="#provenance"/);
});

test("GitHub main is the fail-closed Netlify production path", async () => {
  const workflow = await read("../.github/workflows/deploy-site.yml");
  const config = parse(workflow);
  const steps = config.jobs.deploy.steps;

  assert.deepEqual(config.on.push.branches, ["main"]);
  assert.equal(config.permissions.contents, "read");
  assert.equal(config.jobs.deploy.if, "github.ref == 'refs/heads/main'");
  assert.equal(steps[1].with["node-version"], "20.20.2");
  assert.equal(steps[0].uses, "actions/checkout@df4cb1c069e1874edd31b4311f1884172cec0e10");
  assert.equal(steps[1].uses, "actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38");
  assert.doesNotMatch(workflow, /uses:\s+[^\s]+@v\d/);
  assert.equal(config.on.pull_request, undefined);
  assert.deepEqual(steps.at(-1).env, {
    NETLIFY_AUTH_TOKEN: "${{ secrets.NETLIFY_AUTH_TOKEN }}",
    NETLIFY_SITE_ID: "${{ vars.NETLIFY_SITE_ID }}",
  });
  assert.deepEqual(steps.slice(2, -1).map(({ run }) => run), [
    "npm ci",
    "npm test",
    "npm run check",
    "npm run website:build",
    "npx playwright install --with-deps chromium",
    "npm run website:test",
    "npm install --global netlify-cli@24.11.1",
  ]);
  assert.match(steps.at(-1).run, /^netlify deploy/);
  assert.match(steps.at(-1).run, /--prod/);
  assert.match(steps.at(-1).run, /--dir website\/dist/);
  assert.match(steps.at(-1).run, /--site "\$\{NETLIFY_SITE_ID\}"/);
});
