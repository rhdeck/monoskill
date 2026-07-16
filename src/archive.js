import { constants, createWriteStream, existsSync } from "node:fs";
import { copyFile, link, lstat, mkdir, mkdtemp, readFile, readdir, readlink, realpath, rename, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { pipeline } from "node:stream/promises";
import yazl from "yazl";

// yazl intentionally encodes DOS timestamps from local calendar fields. A local
// 1980 epoch plus forceDosTimestamp produces the same fields in every timezone;
// Date.UTC would become December 1979 in negative-offset zones.
const ARCHIVE_MTIME = new Date(1980, 0, 1, 0, 0, 0);
const ZIP_OPTIONS = { mtime: ARCHIVE_MTIME, forceDosTimestamp: true };

/**
 * Validate and package a generated skill as a deterministic ZIP-format .skill.
 * Existing output is preserved unless force is true. Returns artifact metadata.
 */
export async function packageSkill(skillDir, options = {}) {
  const root = await resolveExistingDirectory(skillDir);
  const manifest = await validateGeneratedSkill(root);
  const output = resolve(options.output ?? `${manifest.skill.name}.skill`);
  assertSkillArchivePath(output);
  if (!options.force && existsSync(output)) throw new Error(`archive already exists: ${output} (pass --force to replace it)`);

  assertOutputOutsideSkill(root, await plannedPhysicalOutput(output));
  await mkdir(dirname(output), { recursive: true });
  const physicalParent = await realpath(dirname(output));
  const physicalOutput = join(physicalParent, basename(output));
  assertOutputOutsideSkill(root, physicalOutput);
  const tempDir = await mkdtemp(join(physicalParent, ".monoskill-package-"));
  const staged = join(tempDir, basename(output));
  try {
    const entries = await collectEntries(root);
    await writeZip(staged, entries);
    await publishArchive(staged, physicalOutput, options.force);
    return { output, skillName: manifest.skill.name, skillCount: manifest.skills.length, entryCount: entries.length };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

/**
 * Assert the generated root contract and return its parsed provenance manifest.
 * Required entrypoints must be real files/directories, not redirecting symlinks.
 */
export async function validateGeneratedSkill(skillDir) {
  const root = resolve(skillDir);
  let info;
  try {
    info = await stat(root);
  } catch {
    throw new Error(`skill directory does not exist: ${root}`);
  }
  if (!info.isDirectory()) throw new Error(`skill path is not a directory: ${root}`);

  await assertEntryType(root, "SKILL.md", "file");
  await assertEntryType(root, "agents/openai.yaml", "file");
  await assertEntryType(root, "provenance.json", "file");
  await assertEntryType(root, "references", "directory");

  let manifest;
  try {
    manifest = JSON.parse(await readFile(join(root, "provenance.json"), "utf8"));
  } catch (error) {
    throw new Error(`invalid generated skill: cannot parse provenance.json: ${error.message}`);
  }
  if (!manifest?.skill?.name || !Array.isArray(manifest.skills)) {
    throw new Error("invalid generated skill: provenance.json must contain skill.name and skills[]");
  }
  if (!/^[a-z0-9-]{1,63}$/.test(manifest.skill.name)) {
    throw new Error(`invalid generated skill: unsafe skill name in provenance.json: ${manifest.skill.name}`);
  }
  for (const skill of manifest.skills) {
    if (!skill?.name || !/^[a-z0-9-]{1,63}$/.test(skill.name)) {
      throw new Error("invalid generated skill: every provenance skill must have a safe name");
    }
    await assertEntryType(root, `references/${skill.name}/SKILL.md`, "file");
  }
  return manifest;
}

async function collectEntries(root) {
  const entries = [];
  async function walk(dir) {
    const children = (await readdir(dir, { withFileTypes: true })).sort((a, b) => compareNames(a.name, b.name));
    for (const child of children) {
      const path = join(dir, child.name);
      const info = await lstat(path);
      const name = archiveName(root, path, child.isDirectory());
      if (child.isDirectory()) {
        entries.push({ type: "directory", path, name, info });
        await walk(path);
      }
      else if (child.isFile()) entries.push({ type: "file", path, name, info });
      else if (child.isSymbolicLink()) entries.push({ type: "symlink", path, name, info });
      else throw new Error(`cannot package unsupported filesystem entry: ${relative(root, path)}`);
    }
  }
  await walk(root);
  const sorted = entries.sort((a, b) => compareNames(a.name, b.name));
  assertPortableNames(sorted);
  return sorted;
}

async function writeZip(output, entries) {
  const zip = new yazl.ZipFile();
  for (const entry of entries) {
    const options = { ...ZIP_OPTIONS, mode: entry.info.mode };
    if (entry.type === "directory") zip.addEmptyDirectory(entry.name, options);
    else if (entry.type === "file") zip.addFile(entry.path, entry.name, options);
    else zip.addBuffer(Buffer.from(await readlink(entry.path)), entry.name, options);
  }
  const destination = createWriteStream(output, { flags: "wx" });
  zip.end();
  await pipeline(zip.outputStream, destination);
}

async function publishArchive(staged, output, force) {
  if (force) {
    try {
      await rename(staged, output);
    } catch (error) {
      if (!["EEXIST", "EPERM"].includes(error.code) || !existsSync(output)) throw error;
      await replaceArchiveOnRenameLimitedPlatform(staged, output);
    }
    return;
  }
  try {
    await link(staged, output);
  } catch (error) {
    if (error.code === "EEXIST") throw new Error(`archive already exists: ${output} (pass --force to replace it)`);
    if (!["EXDEV", "EPERM", "EOPNOTSUPP", "ENOTSUP"].includes(error.code)) throw error;
    await copyArchiveExclusively(staged, output);
  }
}

function assertSkillArchivePath(output) {
  if (extname(output) !== ".skill") throw new Error(`archive output must end in .skill: ${output}`);
}

function assertOutputOutsideSkill(root, output) {
  const rel = relative(root, output);
  if (rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel))) {
    throw new Error("archive output must be outside the skill directory");
  }
}

function archiveName(root, path, directory = false) {
  const relativePath = relative(root, path);
  if (sep !== "\\" && relativePath.includes("\\")) {
    throw new Error(`cannot package path containing a backslash: ${relativePath}`);
  }
  const name = relativePath.split(sep).join("/");
  return directory ? `${name}/` : name;
}

async function resolveExistingDirectory(path) {
  try {
    return await realpath(resolve(path));
  } catch {
    throw new Error(`skill directory does not exist: ${resolve(path)}`);
  }
}

async function plannedPhysicalOutput(output) {
  let ancestor = dirname(output);
  const suffix = [basename(output)];
  while (!existsSync(ancestor)) {
    suffix.unshift(basename(ancestor));
    const parent = dirname(ancestor);
    if (parent === ancestor) break;
    ancestor = parent;
  }
  return join(await realpath(ancestor), ...suffix);
}

async function assertEntryType(root, relativePath, type) {
  let info;
  try {
    info = await lstat(join(root, relativePath));
  } catch {
    throw new Error(`invalid generated skill: missing ${relativePath}`);
  }
  const matches = type === "file" ? info.isFile() : info.isDirectory();
  if (!matches) throw new Error(`invalid generated skill: ${relativePath} must be a ${type}`);
}

function compareNames(left, right) {
  return Buffer.compare(Buffer.from(left), Buffer.from(right));
}

function assertPortableNames(entries) {
  const names = new Map();
  for (const entry of entries) {
    const key = entry.name.replace(/\/$/, "").normalize("NFC").toLowerCase();
    const existing = names.get(key);
    if (existing && existing !== entry.name) {
      throw new Error(`archive paths collide on portable filesystems: ${existing} and ${entry.name}`);
    }
    names.set(key, entry.name);
  }
}

async function replaceArchiveOnRenameLimitedPlatform(staged, output) {
  const backup = `${output}.backup-${process.pid}-${Date.now()}`;
  await rename(output, backup);
  try {
    await rename(staged, output);
  } catch (error) {
    await rename(backup, output);
    throw error;
  }
  await rm(backup, { force: true });
}

async function copyArchiveExclusively(staged, output) {
  try {
    await copyFile(staged, output, constants.COPYFILE_EXCL);
  } catch (error) {
    if (error.code === "EEXIST") throw new Error(`archive already exists: ${output} (pass --force to replace it)`);
    await rm(output, { force: true });
    throw error;
  }
}
