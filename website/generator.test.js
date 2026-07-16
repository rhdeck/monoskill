import assert from "node:assert/strict";
import test from "node:test";
import { inferSkillName, makeCommand, makePrompt, normalizeSkillName, shellQuote, validateSkillName, validateSource } from "./generator.js";

test("accepts every source form supported by the website", () => {
  for (const source of [
    "coreyhaines31/marketingskills",
    "https://github.com/coreyhaines31/marketingskills.git",
    "git@github.com:coreyhaines31/marketingskills.git",
    "ssh://git@github.com/coreyhaines31/marketingskills.git",
    "./local-skills",
    "../local-skills",
    "~/skills/local",
    "/Users/example/skills"
  ]) assert.equal(validateSource(source).valid, true, source);
});

test("rejects ambiguous and unsafe source text", () => {
  for (const source of ["", "local-skills", "javascript:alert(1)", "owner/repo\n--output /tmp/oops", "https://"]) {
    assert.equal(validateSource(source).valid, false, JSON.stringify(source));
  }
});

test("infers and normalizes CLI-compatible names", () => {
  assert.equal(inferSkillName("https://github.com/coreyhaines31/marketingskills.git"), "marketingskills");
  assert.equal(inferSkillName("git@github.com:coreyhaines31/Marketing Skills.git"), "marketing-skills");
  assert.equal(normalizeSkillName("  Corey_Marketing!!! "), "corey-marketing");
  assert.equal(validateSkillName("corey-marketing"), true);
  assert.equal(validateSkillName("Corey Marketing"), false);
  assert.equal(validateSkillName("a".repeat(64)), false);
});

test("shell quotes source and name as separate literal arguments", () => {
  assert.equal(shellQuote("repo's skills"), "'repo'\\''s skills'");
  assert.equal(
    makeCommand("./repo's skills", "marketing-skills"),
    "npx monoskill build './repo'\\''s skills' --name 'marketing-skills'"
  );
});

test("AI prompt embeds the exact live build command and honest deployment boundary", () => {
  const command = makeCommand("coreyhaines31/marketingskills", "corey-marketing");
  const prompt = makePrompt("coreyhaines31/marketingskills", "corey-marketing");
  assert.match(command, /^npx monoskill build /);
  assert.ok(prompt.includes(command));
  assert.match(prompt, /cannot install local skills/);
  assert.match(prompt, /provenance\.json/);
});
