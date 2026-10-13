import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  extractUuid,
  loadSources,
  normalizeFrontmatter,
  resolveSource,
} from "./sync-agorum-docs";

describe("normalizeFrontmatter", () => {
  it("drops `date` and `topic` while keeping other fields and body", () => {
    const input = Buffer.from(
      [
        "---",
        "name: Example Doc",
        "uuid: a750a450-1ba1-11f0-be2e-005056aa0ecc",
        "date: 2026-04-12T09:01:45.331Z",
        "link: https://example.com/a",
        'path: ["Cat","Sub"]',
        "topic: Documentation Tree Rev. 11.13.0",
        "---",
        "",
        "# Heading",
        "",
        "Body text.",
        "",
      ].join("\n"),
    );
    const out = normalizeFrontmatter(input).toString("utf8");
    expect(out).toBe(
      [
        "---",
        "name: Example Doc",
        "uuid: a750a450-1ba1-11f0-be2e-005056aa0ecc",
        "link: https://example.com/a",
        'path: ["Cat","Sub"]',
        "---",
        "",
        "# Heading",
        "",
        "Body text.",
        "",
      ].join("\n"),
    );
  });

  it("preserves order of kept fields exactly as in the source", () => {
    const input = Buffer.from(
      [
        "---",
        "uuid: 1",
        "name: X",
        "topic: drop-me",
        "link: https://a",
        "date: drop-me",
        "---",
        "Body",
      ].join("\n"),
    );
    const out = normalizeFrontmatter(input).toString("utf8");
    expect(out).toBe(
      [
        "---",
        "uuid: 1",
        "name: X",
        "link: https://a",
        "---",
        "Body",
      ].join("\n"),
    );
  });

  it("is idempotent: applying twice yields the same bytes", () => {
    const input = Buffer.from(
      [
        "---",
        "name: Doc",
        "uuid: abc",
        "date: 2026-04-12T09:01:45.331Z",
        "topic: foo",
        "link: https://x",
        "---",
        "body",
      ].join("\n"),
    );
    const once = normalizeFrontmatter(input);
    const twice = normalizeFrontmatter(once);
    expect(once.equals(twice)).toBe(true);
  });

  it("preserves umlauts and special characters byte-for-byte", () => {
    const input = Buffer.from(
      [
        "---",
        "name: Dokumentation Einstieg - Öffentlich",
        "uuid: x",
        "date: 2026-04-12T09:01:45.331Z",
        "topic: foo",
        "---",
        "Grüße, Äpfel und Öl.",
      ].join("\n"),
      "utf8",
    );
    const out = normalizeFrontmatter(input).toString("utf8");
    expect(out).toContain("Dokumentation Einstieg - Öffentlich");
    expect(out).toContain("Grüße, Äpfel und Öl.");
    expect(out).not.toContain("date:");
    expect(out).not.toContain("topic:");
  });

  it("throws when the file has no frontmatter", () => {
    const input = Buffer.from("# Just a heading\n");
    expect(() => normalizeFrontmatter(input)).toThrow(/frontmatter delimiter/);
  });

  it("throws when the closing frontmatter delimiter is missing", () => {
    const input = Buffer.from("---\nname: x\nuuid: y\nbody without close\n");
    expect(() => normalizeFrontmatter(input)).toThrow(/closing/);
  });

  it("does not drop a field whose name merely starts with 'date' or 'topic'", () => {
    const input = Buffer.from(
      [
        "---",
        "name: X",
        "uuid: 1",
        "dateCreated: keep-me",
        "topicList: keep-me-too",
        "---",
        "",
      ].join("\n"),
    );
    const out = normalizeFrontmatter(input).toString("utf8");
    expect(out).toContain("dateCreated: keep-me");
    expect(out).toContain("topicList: keep-me-too");
  });
});

describe("normalizeFrontmatter (acdocs-live double-block format)", () => {
  const doubleBlockDoc = [
    "---",
    "name: Example Doc",
    "uuid: abc-123",
    "title: Example| Title",
    "generated_at: 2026-06-28T01:35:40.051Z",
    "last_modify_date: Tue May 26 2026 11:08:22 GMT+0200",
    "---",
    "",
    "---",
    "name: Example Doc",
    "uuid: abc-123",
    "date: 2026-06-28T01:35:19.445Z",
    "link: https://example.com/x",
    'path: ["A","B"]',
    "topic: acdocs-live",
    "---",
    "",
    "# Heading",
    "",
    "Body text.",
    "",
  ].join("\n");

  it("drops generated_at from the outer block and date/topic from the inner block", () => {
    const out = normalizeFrontmatter(Buffer.from(doubleBlockDoc)).toString("utf8");
    expect(out).toBe(
      [
        "---",
        "name: Example Doc",
        "uuid: abc-123",
        "title: Example| Title",
        "last_modify_date: Tue May 26 2026 11:08:22 GMT+0200",
        "---",
        "",
        "---",
        "name: Example Doc",
        "uuid: abc-123",
        "link: https://example.com/x",
        'path: ["A","B"]',
        "---",
        "",
        "# Heading",
        "",
        "Body text.",
        "",
      ].join("\n"),
    );
  });

  it("is idempotent on double-block documents", () => {
    const once = normalizeFrontmatter(Buffer.from(doubleBlockDoc));
    const twice = normalizeFrontmatter(once);
    expect(once.equals(twice)).toBe(true);
  });

  it("leaves a thematic break at the start of the body untouched", () => {
    const input = Buffer.from(
      ["---", "uuid: x", "name: Y", "---", "", "---", "", "# Title", ""].join("\n"),
    );
    const out = normalizeFrontmatter(input).toString("utf8");
    expect(out).toBe(input.toString("utf8"));
  });

  it("does not treat a key-value-like body section without uuid as metadata", () => {
    const input = Buffer.from(
      [
        "---",
        "uuid: x",
        "---",
        "",
        "---",
        "date: not metadata, part of the body",
        "---",
        "text",
      ].join("\n"),
    );
    const out = normalizeFrontmatter(input).toString("utf8");
    expect(out).toContain("date: not metadata, part of the body");
  });
});

describe("loadSources", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "sync-dedup-test-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  const makeDoc = (uuid: string, generatedAt: string, body: string) =>
    [
      "---",
      `name: Doc ${uuid}`,
      `uuid: ${uuid}`,
      `generated_at: ${generatedAt}`,
      "---",
      "",
      body,
      "",
    ].join("\n");

  it("keeps the copy with the newest generated_at when a uuid appears twice", async () => {
    // The newer timestamp sits in the file that sorts FIRST, proving that
    // the timestamp wins over filename order.
    await fs.writeFile(
      path.join(tmpDir, "0001 - a.md"),
      makeDoc("dup-1", "2026-06-28T00:00:00.000Z", "NEWER CONTENT"),
    );
    await fs.writeFile(
      path.join(tmpDir, "0002 - a.md"),
      makeDoc("dup-1", "2026-06-14T00:00:00.000Z", "OLDER CONTENT"),
    );

    const sources = await loadSources(tmpDir);
    expect(sources).toHaveLength(1);
    expect(sources[0].uuid).toBe("dup-1");
    expect(sources[0].normalized.toString("utf8")).toContain("NEWER CONTENT");
  });

  it("returns one entry per uuid across a mix of unique and duplicated docs", async () => {
    await fs.writeFile(
      path.join(tmpDir, "0001 - a.md"),
      makeDoc("dup-1", "2026-06-14T00:00:00.000Z", "old"),
    );
    await fs.writeFile(
      path.join(tmpDir, "0002 - a.md"),
      makeDoc("dup-1", "2026-06-28T00:00:00.000Z", "new"),
    );
    await fs.writeFile(
      path.join(tmpDir, "0003 - b.md"),
      makeDoc("unique-1", "2026-06-28T00:00:00.000Z", "solo"),
    );

    const sources = await loadSources(tmpDir);
    const uuids = sources.map((s) => s.uuid).sort();
    expect(uuids).toEqual(["dup-1", "unique-1"]);
  });
});

describe("extractUuid", () => {
  it("returns the uuid value trimmed", () => {
    const input = Buffer.from(
      ["---", "name: X", "uuid:   abc-def-123  ", "---", ""].join("\n"),
    );
    expect(extractUuid("dummy.md", input)).toBe("abc-def-123");
  });

  it("strips surrounding quotes", () => {
    const input = Buffer.from(
      ["---", 'uuid: "quoted-uuid"', "---", ""].join("\n"),
    );
    expect(extractUuid("dummy.md", input)).toBe("quoted-uuid");
  });

  it("throws when uuid is missing", () => {
    const input = Buffer.from(["---", "name: X", "---", ""].join("\n"));
    expect(() => extractUuid("foo.md", input)).toThrow(/Missing 'uuid'/);
  });

  it("throws when uuid contains a path separator", () => {
    const input = Buffer.from(["---", "uuid: a/b", "---", ""].join("\n"));
    expect(() => extractUuid("foo.md", input)).toThrow(/Unsafe uuid/);
  });
});

describe("resolveSource", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "sync-test-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("resolves an explicit source path that exists", async () => {
    const explicit = path.join(tmpDir, "my-source");
    await fs.mkdir(explicit);
    const resolved = await resolveSource(explicit);
    expect(resolved).toBe(path.resolve(explicit));
  });

  it("throws when explicit source path does not exist", async () => {
    const missing = path.join(tmpDir, "does-not-exist");
    await expect(resolveSource(missing)).rejects.toThrow(/does not exist/);
  });
});
