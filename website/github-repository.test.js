import assert from "node:assert/strict";
import test from "node:test";
import { inspectGitHubSkills } from "./github-repository.js";

test("reports the skills the CLI would discover from a GitHub repository", async () => {
  const requests = [];
  const fetch = async (url) => {
    requests.push(url);
    if (url.endsWith("/repos/mattpocock/skills")) {
      return response({ default_branch: "main", full_name: "mattpocock/skills" });
    }
    return response({
      truncated: false,
      tree: [
        { type: "blob", path: "skills/engineering/tdd/SKILL.md" },
        { type: "blob", path: "skills/productivity/grill-me/SKILL.md" },
        { type: "blob", path: "node_modules/example/SKILL.md" },
        { type: "blob", path: "README.md" }
      ]
    });
  };

  const result = await inspectGitHubSkills("https://github.com/mattpocock/skills", { fetch });
  assert.deepEqual(result, {
    fullName: "mattpocock/skills",
    defaultBranch: "main",
    skillCount: 2
  });
  assert.equal(requests.length, 2);
});

function response(body, ok = true) {
  return { ok, status: ok ? 200 : 404, json: async () => body };
}
