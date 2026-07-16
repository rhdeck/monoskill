import { mkdtemp, readFile, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import os from "node:os";
import { resolve } from "node:path";
import { promisify } from "node:util";
import YAML from "yaml";

const exec = promisify(execFile);

const root = resolve("skills/monoskill");
const skill = await readFile(resolve(root, "SKILL.md"), "utf8");
const reference = await readFile(resolve(root, "references/cli.md"), "utf8");
const metadata = parseFrontmatter(skill);
const agentMetadata = YAML.parse(await readFile(resolve(root, "agents/openai.yaml"), "utf8"));

if (metadata.name !== "monoskill") throw new Error("skill name must be monoskill");
if (typeof metadata.description !== "string" || metadata.description.length > 240) {
  throw new Error("skill description must be a compact string no longer than 240 characters");
}
if (!metadata.description.includes("Monoskill CLI") || !metadata.description.includes("Do not trigger")) {
  throw new Error("skill description must name the narrow CLI trigger and negative trigger");
}
if (!skill.includes("[references/cli.md](references/cli.md)")) throw new Error("SKILL.md must route command details to references/cli.md");
if (!agentMetadata?.interface?.default_prompt?.includes("$monoskill")) throw new Error("agents/openai.yaml default_prompt must invoke $monoskill");

const publishedVersion = "0.3.0";
const cleanInvocation = `npx --yes monoskill@${publishedVersion}`;
const documentedCommands = reference.split("\n")
  .filter((line) => line.startsWith(`${cleanInvocation} `))
  .map((line) => line.slice(cleanInvocation.length + 1).split(" ")[0]);
const documentedOptions = [...new Set([...reference.matchAll(/(?:^|[\s`])(--[a-z-]+)/gm)].map((match) => match[1]))]
  .filter((option) => !["--help", "--version"].includes(option));
const { stdout: help } = await exec(process.execPath, [resolve("bin/monoskill.js"), "--help"]);
const registryProbe = await mkdtemp(resolve(os.tmpdir(), "monoskill-registry-contract-"));
let publishedHelp;
let registryVersion;
try {
  ({ stdout: publishedHelp } = await exec("npx", ["--yes", `monoskill@${publishedVersion}`, "--help"], { cwd: registryProbe }));
  ({ stdout: registryVersion } = await exec("npx", ["--yes", `monoskill@${publishedVersion}`, "--version"], { cwd: registryProbe }));
} finally {
  await rm(registryProbe, { recursive: true, force: true });
}
if (registryVersion.trim() !== publishedVersion) {
  throw new Error(`registry bootstrap resolved ${registryVersion.trim()}, expected ${publishedVersion}`);
}
if (help.trim() !== publishedHelp.trim()) {
  throw new Error(`working-tree CLI help differs from the published ${publishedVersion} executable used by the skill`);
}
const supportedCommands = [...new Set([...help.matchAll(/^  monoskill ([a-z-]+)/gm)].map((match) => match[1]))];
const supportedOptions = [...new Set([...help.matchAll(/(?:^|\s)(--[a-z-]+)/gm)].map((match) => match[1]))]
  .filter((option) => !["--help", "--version"].includes(option));

if (!reference.includes(`${cleanInvocation} --help`)) {
  throw new Error("skill reference must bootstrap the CLI for a clean machine");
}

const requiredExamples = [
  `${cleanInvocation} add <source> --name <name> --dry-run --json`,
  `${cleanInvocation} add <source> --name <name> --agent codex --agent claude-code --global --yes --json`,
  `${cleanInvocation} build <source> --name <name> --output <dir>`,
  `${cleanInvocation} build <source> --name <name> --archive --output <file.skill>`,
  `${cleanInvocation} package <skill-dir> --output <file.skill>`,
  `${cleanInvocation} check <skill-dir> --json`,
  `${cleanInvocation} update <skill-dir>`
];
for (const example of requiredExamples) {
  if (!reference.includes(example)) throw new Error(`skill reference is missing command contract: ${example}`);
}

for (const command of supportedCommands) {
  if (!documentedCommands.includes(command)) throw new Error(`skill reference does not document CLI command: ${command}`);
}
for (const command of documentedCommands) {
  if (!supportedCommands.includes(command)) throw new Error(`skill reference documents unsupported CLI command: ${command}`);
}
for (const option of supportedOptions) {
  if (!documentedOptions.includes(option)) throw new Error(`skill reference does not document CLI option: ${option}`);
}
for (const option of documentedOptions) {
  if (!supportedOptions.includes(option)) throw new Error(`skill reference documents unsupported CLI option: ${option}`);
}

console.log(`Validated monoskill skill: all ${supportedCommands.length} commands and ${supportedOptions.length} functional options match CLI help`);

function parseFrontmatter(raw) {
  const match = raw.match(/^---\s*\r?\n([\s\S]*?)\r?\n---(?:\s*\r?\n|$)/);
  if (!match) throw new Error("SKILL.md is missing YAML frontmatter");
  const parsed = YAML.parse(match[1]);
  const keys = Object.keys(parsed ?? {});
  if (keys.length !== 2 || !keys.includes("name") || !keys.includes("description")) {
    throw new Error("SKILL.md frontmatter must contain only name and description");
  }
  return parsed;
}
