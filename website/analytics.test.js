import assert from "node:assert/strict";
import test from "node:test";
import { collectAnalytics, makeAnalyticsPayload } from "./analytics.js";

test("analytics payload excludes source, inferred name, query, and hash values", () => {
  const privateValue = "private-owner/private-repo";
  const payload = makeAnalyticsPayload("source_input_completed", {
    source_type: "git-url",
    source: privateValue,
    name: "private-skill",
    arbitrary: "not-allowed"
  }, {
    pathname: "/generator",
    search: `?source=${privateValue}`,
    hash: "#private-skill"
  });
  assert.deepEqual(payload, {
    domain: "monoskill.dev",
    name: "source_input_completed",
    url: "https://monoskill.dev/generator",
    props: { source_type: "git-url" }
  });
  assert.equal(JSON.stringify(payload).includes("private"), false);
});

test("collector is silent off production and posts the allowlisted payload on production", async () => {
  const calls = [];
  const beacon = (endpoint, body) => { calls.push({ endpoint, body }); return true; };
  assert.equal(collectAnalytics("copy_cli", {}, { hostname: "localhost", pathname: "/" }, beacon), false);
  assert.equal(calls.length, 0);
  assert.equal(collectAnalytics("copy_cli", { source: "secret" }, { hostname: "monoskill.dev", pathname: "/" }, beacon), true);
  assert.equal(calls[0].endpoint, "https://plausible.io/api/event");
  assert.deepEqual(JSON.parse(await calls[0].body.text()), {
    domain: "monoskill.dev",
    name: "copy_cli",
    url: "https://monoskill.dev/"
  });
});

test("analytics event names are allowlisted", () => {
  assert.throws(
    () => makeAnalyticsPayload("private-owner/private-repo", {}, { pathname: "/" }),
    /Unsupported analytics event/
  );
});
