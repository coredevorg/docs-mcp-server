import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { RawContent } from "../fetcher/types";
import type { ScraperOptions } from "../types";
import { MarkdownPipeline } from "./MarkdownPipeline";

describe("MarkdownPipeline with Front-Matter Integration", () => {
  it("should process real markdown file with front-matter correctly", async () => {
    // Read a real file with front-matter from the test docs
    const filePath =
      "/Users/bst/Developer/MCP/docs-mcp-server/docs/agorum/agoscript/000 - Übersicht - agorum core agoscript.md";

    let markdown: string;
    try {
      markdown = readFileSync(filePath, "utf-8");
    } catch (error) {
      // Skip test if file doesn't exist
      console.log("Skipping integration test - test file not found");
      return;
    }

    const rawContent: RawContent = {
      content: Buffer.from(markdown),
      mimeType: "text/markdown",
      source: "file:///test.md",
      charset: "utf-8",
    };

    const options: ScraperOptions = {
      url: "file:///test.md",
      library: "test",
      version: "1.0.0",
      maxDepth: 0,
      maxPages: 1,
      maxConcurrency: 1,
      scope: "subpages",
      followRedirects: true,
      excludeSelectors: [],
      ignoreErrors: false,
    };

    const pipeline = new MarkdownPipeline();
    const result = await pipeline.process(rawContent, options);

    // Verify front-matter was extracted
    expect(result.title).toBe("Übersicht - agorum core agoscript");

    // Verify front-matter was removed from content
    expect(result.textContent).not.toContain("uuid: 39df11d0");
    expect(result.textContent).not.toContain("name: Übersicht");

    // Verify hierarchical path was applied to chunks
    expect(result.chunks.length).toBeGreaterThan(0);
    const firstChunk = result.chunks[0];
    expect(firstChunk.section.path).toContain("agorum core für Entwickler");
    expect(firstChunk.section.path).toContain("agorum core agoscript");

    // Verify path depth is correct (front-matter path + heading)
    expect(firstChunk.section.path.length).toBeGreaterThanOrEqual(2);

    // No errors should occur
    expect(result.errors).toHaveLength(0);
  });

  it("should handle markdown without front-matter gracefully", async () => {
    const markdown = `# Simple Heading

This is regular markdown without any front-matter.

## Sub Heading

More content here.`;

    const rawContent: RawContent = {
      content: Buffer.from(markdown),
      mimeType: "text/markdown",
      source: "file:///test2.md",
      charset: "utf-8",
    };

    const options: ScraperOptions = {
      url: "file:///test2.md",
      library: "test",
      version: "1.0.0",
      maxDepth: 0,
      maxPages: 1,
      maxConcurrency: 1,
      scope: "subpages",
      followRedirects: true,
      excludeSelectors: [],
      ignoreErrors: false,
    };

    const pipeline = new MarkdownPipeline();
    const result = await pipeline.process(rawContent, options);

    // Should extract title from H1
    expect(result.title).toBe("Simple Heading");

    // Content should be unchanged
    expect(result.textContent).toContain("regular markdown");

    // Chunks should work normally without front-matter
    expect(result.chunks.length).toBeGreaterThan(0);

    // No errors
    expect(result.errors).toHaveLength(0);
  });
});
