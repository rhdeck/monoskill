import { resolve } from "node:path";
import { packageSkill } from "./archive.js";
import { build, buildArchive, check, update } from "./compiler.js";

const HELP = `monoskill — compile many agent skills into one router skill

Usage:
  monoskill build <source> --name <name> [--output <dir>] [--ref <git-ref>]
  monoskill build <source> --name <name> --archive [--output <file.skill>] [--force]
  monoskill package <skill-dir> [--output <file.skill>] [--force]
  monoskill check <skill-dir> [--json]
  monoskill update <skill-dir>

Source may be a local directory, Git URL, or GitHub owner/repo shorthand.

Options:
  -n, --name <name>          Generated skill name (build only)
  -o, --output <path>       Output directory, or .skill file with --archive/package
      --ref <git-ref>       Branch, tag, or commit to compile
      --skills-dir <path>   Skill root inside source (auto-detected by default)
      --description <text>  Override generated skill description
      --archive             Build directly to a portable .skill archive
      --force               Replace an existing archive
      --json                Machine-readable check output
  -h, --help                Show this help
  -v, --version             Show the version`;

export async function run(argv) {
  const [command, positional, ...rest] = argv;
  if (!command || command === "help" || command === "--help" || command === "-h") {
    console.log(HELP);
    return;
  }
  if (command === "--version" || command === "-v") {
    console.log("0.2.0");
    return;
  }

  const options = parseOptions(rest);
  if (!positional) throw new Error(`${command} requires a path or source`);

  if (command === "build") {
    if (!options.name) throw new Error("build requires --name <name>");
    if (options.archive) {
      const output = resolve(options.output ?? `${options.name}.skill`);
      const result = await buildArchive(positional, { ...options, output });
      console.log(`Built ${result.skillCount} skills into ${result.output}`);
      console.log(`Source: ${result.sourceUrl} @ ${result.commit.slice(0, 12)}`);
      return;
    }
    if (options.force) throw new Error("--force requires package or build --archive");
    const output = resolve(options.output ?? options.name);
    const result = await build(positional, { ...options, output });
    console.log(`Built ${result.skillCount} skills into ${result.output}`);
    console.log(`Source: ${result.sourceUrl} @ ${result.commit.slice(0, 12)}`);
    return;
  }
  if (command === "package") {
    if (options.archive) throw new Error("package does not accept --archive");
    const result = await packageSkill(resolve(positional), {
      output: options.output ? resolve(options.output) : undefined,
      force: options.force
    });
    console.log(`Packaged ${result.skillCount} skills into ${result.output}`);
    return;
  }
  if (command === "check") {
    const result = await check(resolve(positional));
    if (options.json) console.log(JSON.stringify(result, null, 2));
    else if (result.current) console.log(`Current: ${result.skillCount} skills at ${result.localCommit.slice(0, 12)}`);
    else {
      console.log(`Drift detected: ${result.localCommit.slice(0, 12)} -> ${result.remoteCommit.slice(0, 12)}`);
      console.log(`Added: ${formatNames(result.added)}; removed: ${formatNames(result.removed)}; changed: ${formatNames(result.changed)}`);
    }
    if (!result.current) process.exitCode = 2;
    return;
  }
  if (command === "update") {
    const result = await update(resolve(positional));
    if (result.current) console.log(`Already current at ${result.commit.slice(0, 12)}`);
    else console.log(`Updated ${result.skillCount} skills: ${result.previousCommit.slice(0, 12)} -> ${result.commit.slice(0, 12)}`);
    return;
  }
  throw new Error(`unknown command: ${command}\n\n${HELP}`);
}

function parseOptions(args) {
  const options = {};
  const aliases = { "-n": "name", "--name": "name", "-o": "output", "--output": "output", "--ref": "ref", "--skills-dir": "skillsDir", "--description": "description" };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (["--json", "--archive", "--force"].includes(arg)) {
      options[arg.slice(2)] = true;
      continue;
    }
    const key = aliases[arg];
    if (!key) throw new Error(`unknown option: ${arg}`);
    const value = args[++index];
    if (!value || value.startsWith("-")) throw new Error(`${arg} requires a value`);
    options[key] = value;
  }
  return options;
}

function formatNames(names) {
  return names.length ? names.join(", ") : "none";
}
