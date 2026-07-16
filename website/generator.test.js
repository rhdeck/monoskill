import assert from "node:assert/strict";
import test from "node:test";
import { inferSkillName, makeCommand, makePrompt, normalizeSkillName, shellQuote, shellQuoteSource, validateSkillName, validateSource } from "./generator.js";

test("accepts every source form supported by the website", () => {
  for (const source of [
    "coreyhaines31/marketingskills",
    "https://github.com/coreyhaines31/marketingskills.git",
    "git@github.com:coreyhaines31/marketingskills.git",
    "ssh://git@github.com/coreyhaines31/marketingskills.git",
    "file:///tmp/local-skills",
    "local-skills",
    "local skills/with apostrophe's",
    "./local-skills",
    "../local-skills",
    "~/skills/local",
    "/Users/example/skills"
  ]) assert.equal(validateSource(source).valid, true, source);
});

test("rejects ambiguous and unsafe source text", () => {
  for (const source of ["", "javascript:alert(1)", "-starts-like-an-option", "owner/repo\n--output /tmp/oops", "https://"]) {
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
  assert.equal(shellQuoteSource("~/repo's skills"), "\"${HOME}\"/'repo'\\''s skills'");
  assert.equal(
    makeCommand("./repo's skills", "marketing-skills"),
    "npx --yes monoskill@0.3.1 add './repo'\\''s skills' --name 'marketing-skills'"
  );
  assert.equal(
    makeCommand("~/skills/local", "local-skills"),
    "npx --yes monoskill@0.3.1 add \"${HOME}\"/'skills/local' --name 'local-skills'"
  );
});

test("project and global commands match the exact registry add contract", () => {
  const project = makeCommand("coreyhaines31/marketingskills", "corey-marketing");
  const global = makeCommand("coreyhaines31/marketingskills", "corey-marketing", "global");
  assert.equal(project, "npx --yes monoskill@0.3.1 add 'coreyhaines31/marketingskills' --name 'corey-marketing'");
  assert.equal(global, `${project} --agent codex --agent claude-code --global --yes`);
  assert.throws(() => makeCommand("owner/repo", "repo", "system"), /invalid scope/);
});

test("AI prompt installs the skill, previews, and embeds the selected add command", () => {
  const command = makeCommand("coreyhaines31/marketingskills", "corey-marketing");
  const prompt = makePrompt("coreyhaines31/marketingskills", "corey-marketing");
  assert.match(command, /^npx --yes monoskill@0\.3\.1 add /);
  assert.ok(prompt.includes(command));
  assert.match(prompt, /npx skills add rhdeck\/monoskill --skill monoskill/);
  assert.match(prompt, /--dry-run --json/);
  assert.match(prompt, /Use \$monoskill/);
  assert.match(prompt, /provenance\.json/);
});

test("global AI prompt previews without confirmation and installs with explicit confirmation", () => {
  const prompt = makePrompt("owner/repo", "repo", "global");
  assert.match(prompt, /--global --dry-run --json/);
  assert.match(prompt, /--global --yes/);
  assert.doesNotMatch(prompt, /--global --yes --dry-run/);
});
