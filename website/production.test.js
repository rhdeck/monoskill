import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const origin = "https://monoskill.statechange.ai";
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
  assert.match(html, new RegExp(`<meta property="og:image" content="${origin}/og-image.png">`));
  assert.match(html, new RegExp(`<meta name="twitter:image" content="${origin}/og-image.png">`));
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

test("GitHub main is the fail-closed Netlify production path", async () => {
  const workflow = await read("../.github/workflows/deploy-site.yml");
  assert.match(workflow, /push:\s*\n\s*branches:\s*\n\s*- main/);
  assert.match(workflow, /permissions:\s*\n\s*contents: read/);
  assert.match(workflow, /if: github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /node-version: "20"/);
  assert.doesNotMatch(workflow, /pull_request:/);
  assert.deepEqual(
    workflow.match(/^\s*NETLIFY_AUTH_TOKEN:.*$/gm),
    ["          NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}"],
  );
  assert.match(workflow, /netlify-cli@24\.11\.1 deploy/);
  assert.match(workflow, /playwright install --with-deps chromium/);
  assert.match(workflow, /npm run website:test/);
  assert.match(workflow, /--dir website\/dist/);
  assert.match(workflow, /--site f4a7a382-4d6a-4d80-9109-62fb16a7293c/);
});
