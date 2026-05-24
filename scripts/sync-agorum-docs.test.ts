import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { extractUuid, normalizeFrontmatter, resolveSource } from "./sync-agorum-docs";

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
