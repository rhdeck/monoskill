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
