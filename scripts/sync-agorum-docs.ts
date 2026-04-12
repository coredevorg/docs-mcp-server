#!/usr/bin/env vite-node

/**
 * agorum-Doc-Sync: Transform + Multi-Target-Distribution.
 *
 * Reads the latest agorum export from ~/.acdocs/work/agorum-*, normalizes
 * the YAML frontmatter (drops `date` and `topic`, keeps everything else),
 * writes files as <uuid>.md into the local target, and rsyncs the result
 * to the configured remote host. Prints refresh commands at the end.
 *
 * Stable filenames + stable frontmatter bytes enable docs-mcp-server's
 * refresh_version to skip unchanged files via its mtime ETag (304).
 *
 * Secondary mode: --normalize-inplace <dir> applies the same frontmatter
 * normalization in place, used for the one-time migration of the existing
 * target directory from the pre-normalization format.
 */

import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { Command } from "commander";

const MD_EXTENSION = ".md";
const DROP_KEYS = new Set(["date", "topic"]);
const DEFAULT_LOCAL_TARGET = "data/docs/agorum";
const DEFAULT_REMOTE_TARGET =
  "root@sourcebot.coredev.org:/root/docs-mcp-server/data/docs/agorum";
const SOURCE_GLOB_PREFIX = "agorum-";

function defaultWorkDir(): string {
  return path.join(os.homedir(), ".acdocs", "work");
}
const REFRESH_CMD_LOCAL =
  "docker exec cdev-docs-mcp-worker node /app/dist/index.js refresh agorum";
const REFRESH_CMD_REMOTE = `ssh root@sourcebot.coredev.org '${REFRESH_CMD_LOCAL}'`;

interface SyncReport {
  created: string[];
  updated: string[];
  deleted: string[];
  unchanged: number;
}

interface NormalizeReport {
  modified: string[];
  unchanged: number;
  errored: string[];
}

interface LoadedSource {
  sourcePath: string;
  uuid: string;
  normalized: Buffer;
}

/**
 * Drops `date` and `topic` from a YAML frontmatter block while leaving the
 * rest of the document (including other frontmatter fields and the body)
 * byte-identical.
 *
 * Line-based rewrite instead of parse+serialize to avoid drifting on YAML
 * serializer nuances (quoting, escaping of umlauts). Assumes the agorum
 * exporter writes each top-level key as a single line — verified for the
 * current format by sampling.
 */
export function normalizeFrontmatter(raw: Buffer): Buffer {
  const text = raw.toString("utf8");

  if (!text.startsWith("---\n")) {
    throw new Error("File does not start with YAML frontmatter delimiter (---)");
  }

  const openLen = 4; // "---\n"
  const closeMarker = "\n---\n";
  const closeIdx = text.indexOf(closeMarker, openLen);
  if (closeIdx === -1) {
    throw new Error("No closing YAML frontmatter delimiter (---) found");
  }

  const fmBlock = text.substring(openLen, closeIdx);
  const body = text.substring(closeIdx + closeMarker.length);
  const fmLines = fmBlock.split("\n");

  const kept: string[] = [];
  let skippingContinuation = false;

  for (const line of fmLines) {
    const topKeyMatch = /^([A-Za-z_][\w-]*)\s*:/.exec(line);
    if (topKeyMatch) {
      if (DROP_KEYS.has(topKeyMatch[1])) {
        skippingContinuation = true;
        continue;
      }
      skippingContinuation = false;
      kept.push(line);
      continue;
    }

    if (skippingContinuation && (line.startsWith(" ") || line.startsWith("\t"))) {
      continue;
    }

    skippingContinuation = false;
    kept.push(line);
  }

  const newText = `---\n${kept.join("\n")}\n---\n${body}`;
  return Buffer.from(newText, "utf8");
}

/**
 * Extracts the `uuid` value from a frontmatter block. Uses a narrow regex
 * instead of a full YAML parse to avoid pulling in a parser for what is
 * effectively a single-line lookup.
 */
export function extractUuid(filePath: string, raw: Buffer): string {
  const text = raw.toString("utf8");
  if (!text.startsWith("---\n")) {
    throw new Error(`File has no frontmatter: ${filePath}`);
  }
  const closeMarker = "\n---\n";
  const closeIdx = text.indexOf(closeMarker, 4);
  if (closeIdx === -1) {
    throw new Error(`File has no closing frontmatter delimiter: ${filePath}`);
  }
  const fmBlock = text.substring(4, closeIdx);
  const match = /^uuid\s*:\s*(.+)$/m.exec(fmBlock);
  if (!match) {
    throw new Error(`Missing 'uuid' in frontmatter: ${filePath}`);
  }
  const value = match[1].trim().replace(/^["']|["']$/g, "");
  if (value === "") {
    throw new Error(`Empty 'uuid' in frontmatter: ${filePath}`);
  }
  if (value.includes("/") || value.includes("\\") || value.includes("\0")) {
    throw new Error(
      `Unsafe uuid value (contains path separators or NUL): ${filePath} -> ${value}`,
    );
  }
  return value;
}

async function listMarkdownFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.isFile() && entry.name.toLowerCase().endsWith(MD_EXTENSION)) {
      files.push(path.join(dir, entry.name));
    }
  }
  return files.sort();
}

/**
 * Returns the absolute path to the source directory.
 *
 * If `explicit` is given, it is resolved as-is. Otherwise, the most recent
 * sub-directory of `workDir` (default: `~/.acdocs/work/`) whose name starts
 * with `agorum-` is selected — alphabetical sort is chronological for ISO
 * date names. `workDir` is a parameter so tests can override it without
 * touching $HOME.
 */
export async function resolveSource(
  explicit?: string,
  workDir: string = defaultWorkDir(),
): Promise<string> {
  if (explicit) return path.resolve(explicit);

  const entries = await fs.readdir(workDir, { withFileTypes: true });
  const matches = entries
    .filter((e) => e.isDirectory() && e.name.startsWith(SOURCE_GLOB_PREFIX))
    .map((e) => e.name)
    .sort();

  if (matches.length === 0) {
    throw new Error(
      `No ${SOURCE_GLOB_PREFIX}* directory found in ${workDir}. Use --source to specify explicitly.`,
    );
  }

  return path.join(workDir, matches[matches.length - 1]);
}

async function loadSources(sourceDir: string): Promise<LoadedSource[]> {
  const files = await listMarkdownFiles(sourceDir);
  const sources: LoadedSource[] = [];
  const seen = new Map<string, string>();

  for (const sourcePath of files) {
    const raw = await fs.readFile(sourcePath);
    const uuid = extractUuid(sourcePath, raw);
    const existing = seen.get(uuid);
    if (existing) {
      throw new Error(
        `UUID collision: '${uuid}' appears in both '${existing}' and '${sourcePath}'`,
      );
    }
    seen.set(uuid, sourcePath);
    sources.push({ sourcePath, uuid, normalized: normalizeFrontmatter(raw) });
  }

  return sources;
}

function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

async function readIfExists(filePath: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function atomicWrite(targetPath: string, content: Buffer): Promise<void> {
  const dir = path.dirname(targetPath);
  const tmpName = `.${path.basename(targetPath)}.tmp-${process.pid}-${Date.now()}`;
  const tmpPath = path.join(dir, tmpName);
  await fs.writeFile(tmpPath, content);
  await fs.rename(tmpPath, targetPath);
}

async function syncSourceToTarget(
  sourceDir: string,
  targetDir: string,
  dryRun: boolean,
): Promise<SyncReport> {
  const report: SyncReport = {
    created: [],
    updated: [],
    deleted: [],
    unchanged: 0,
  };

  const sources = await loadSources(sourceDir);
  await fs.mkdir(targetDir, { recursive: true });

  const expectedTargetNames = new Set<string>();

  for (const source of sources) {
    const targetName = `${source.uuid}${MD_EXTENSION}`;
    expectedTargetNames.add(targetName);
    const targetPath = path.join(targetDir, targetName);

    const existing = await readIfExists(targetPath);
    if (existing === null) {
      if (!dryRun) await atomicWrite(targetPath, source.normalized);
      report.created.push(targetName);
      continue;
    }

    if (
      existing.length === source.normalized.length &&
      sha256(existing) === sha256(source.normalized)
    ) {
      report.unchanged += 1;
      continue;
    }

    if (!dryRun) await atomicWrite(targetPath, source.normalized);
    report.updated.push(targetName);
  }

  const targetEntries = await listMarkdownFiles(targetDir);
  for (const entry of targetEntries) {
    const base = path.basename(entry);
    if (!expectedTargetNames.has(base)) {
      if (!dryRun) await fs.unlink(entry);
      report.deleted.push(base);
    }
  }

  return report;
}

async function normalizeInPlace(
  dir: string,
  dryRun: boolean,
): Promise<NormalizeReport> {
  const report: NormalizeReport = { modified: [], unchanged: 0, errored: [] };
  const files = await listMarkdownFiles(dir);

  for (const filePath of files) {
    try {
      const raw = await fs.readFile(filePath);
      const normalized = normalizeFrontmatter(raw);
      if (normalized.equals(raw)) {
        report.unchanged += 1;
        continue;
      }
      if (!dryRun) await atomicWrite(filePath, normalized);
      report.modified.push(path.basename(filePath));
    } catch (error) {
      report.errored.push(`${path.basename(filePath)}: ${(error as Error).message}`);
    }
  }

  return report;
}

function runRsync(
  localTarget: string,
  remoteTarget: string,
  dryRun: boolean,
): void {
  const args = [
    "-a",
    "--checksum",
    "--delete",
    "--itemize-changes",
    ...(dryRun ? ["--dry-run"] : []),
    `${localTarget.replace(/\/?$/, "/")}`,
    remoteTarget.replace(/\/?$/, "/"),
  ];

  console.log(`\n=== rsync ${dryRun ? "(dry-run)" : ""} ===`);
  console.log(`  rsync ${args.join(" ")}`);

  const result = spawnSync("rsync", args, { stdio: "inherit" });
  if (result.error) {
    throw new Error(`rsync failed to spawn: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`rsync exited with status ${result.status}`);
  }
}

function printSyncReport(report: SyncReport, dryRun: boolean): void {
  const header = dryRun ? "Local Transform (dry-run)" : "Local Transform";
  console.log(`\n=== ${header} ===`);
  console.log(`  new:       ${report.created.length}`);
  console.log(`  updated:   ${report.updated.length}`);
  console.log(`  deleted:   ${report.deleted.length}`);
  console.log(`  unchanged: ${report.unchanged}`);

  const sample = (label: string, items: string[]) => {
    if (items.length === 0) return;
    const preview = items.slice(0, 5);
    console.log(`\n  ${label} (showing ${preview.length} of ${items.length}):`);
    for (const item of preview) console.log(`    - ${item}`);
  };
  sample("new", report.created);
  sample("updated", report.updated);
  sample("deleted", report.deleted);
}

function printNormalizeReport(report: NormalizeReport, dryRun: boolean): void {
  const header = dryRun ? "Normalize In-Place (dry-run)" : "Normalize In-Place";
  console.log(`\n=== ${header} ===`);
  console.log(`  modified:  ${report.modified.length}`);
  console.log(`  unchanged: ${report.unchanged}`);
  console.log(`  errored:   ${report.errored.length}`);
  if (report.modified.length > 0) {
    const preview = report.modified.slice(0, 5);
    console.log(`\n  modified (showing ${preview.length} of ${report.modified.length}):`);
    for (const item of preview) console.log(`    - ${item}`);
  }
  if (report.errored.length > 0) {
    console.log(`\n  errored:`);
    for (const item of report.errored) console.log(`    - ${item}`);
  }
}

function printRefreshHints(skippedRemote: boolean): void {
  console.log(`\n=== Refresh Hints ===`);
  console.log(`Run one or both commands to update the index:\n`);
  console.log(`  # Local:`);
  console.log(`  ${REFRESH_CMD_LOCAL}\n`);
  if (!skippedRemote) {
    console.log(`  # Sourcebot (via SSH):`);
    console.log(`  ${REFRESH_CMD_REMOTE}\n`);
  }
  console.log(
    `Note: On first rollout (old numbered files still indexed), delete the library in the Web UI and start a fresh scrape instead.\n`,
  );
}

// When the user passes `--no-remote`, commander flips the `remote` option
// itself to the boolean `false` (it does NOT set a separate `noRemote` field).
interface CliOptions {
  source?: string;
  target: string;
  remote: string | false;
  dryRun?: boolean;
  normalizeInplace?: string;
}

async function main(): Promise<void> {
  const program = new Command();
  program
    .name("sync-agorum-docs")
    .description(
      "Sync agorum docs from ~/.acdocs/work/agorum-* to local target and rsync to sourcebot.",
    )
    .option(
      "-s, --source <dir>",
      "source directory (default: newest ~/.acdocs/work/agorum-* )",
    )
    .option(
      "-t, --target <dir>",
      "local target directory",
      DEFAULT_LOCAL_TARGET,
    )
    .option(
      "-r, --remote <user@host:path>",
      "remote rsync target",
      DEFAULT_REMOTE_TARGET,
    )
    .option("--no-remote", "skip the rsync step to the remote host")
    .option("-n, --dry-run", "show planned changes without writing")
    .option(
      "--normalize-inplace <dir>",
      "one-time migration: normalize frontmatter in place in <dir>, then exit",
    )
    .parse(process.argv);

  const opts = program.opts<CliOptions>();

  if (opts.normalizeInplace) {
    const dir = path.resolve(opts.normalizeInplace);
    const stat = await fs.stat(dir).catch(() => null);
    if (!stat || !stat.isDirectory()) {
      throw new Error(`Not a directory: ${dir}`);
    }
    console.log(`Normalize in-place: ${dir}`);
    console.log(`Mode: ${opts.dryRun ? "DRY-RUN" : "LIVE"}`);
    const report = await normalizeInPlace(dir, opts.dryRun ?? false);
    printNormalizeReport(report, opts.dryRun ?? false);
    if (report.errored.length > 0) process.exit(1);
    return;
  }

  const sourceDir = await resolveSource(opts.source);
  const targetDir = path.resolve(opts.target);

  const sourceStat = await fs.stat(sourceDir).catch(() => null);
  if (!sourceStat || !sourceStat.isDirectory()) {
    throw new Error(`Source is not a directory: ${sourceDir}`);
  }

  const skipRemote = opts.remote === false;

  console.log(`Source: ${sourceDir}`);
  console.log(`Local:  ${targetDir}`);
  console.log(`Remote: ${skipRemote ? "(skipped)" : opts.remote}`);
  console.log(`Mode:   ${opts.dryRun ? "DRY-RUN" : "LIVE"}`);

  const report = await syncSourceToTarget(sourceDir, targetDir, opts.dryRun ?? false);
  printSyncReport(report, opts.dryRun ?? false);

  if (!skipRemote) {
    runRsync(targetDir, opts.remote as string, opts.dryRun ?? false);
  }

  printRefreshHints(skipRemote);
}

// Only run CLI when executed as a script, not when imported by tests.
// vite-node strips the script argument from process.argv, so argv[1] cannot
// be used to detect direct entry. Vitest sets process.env.VITEST at test time.
if (!process.env.VITEST) {
  main().catch((error) => {
    console.error(`\n❌ sync-agorum-docs failed: ${(error as Error).message}`);
    process.exit(1);
  });
}
