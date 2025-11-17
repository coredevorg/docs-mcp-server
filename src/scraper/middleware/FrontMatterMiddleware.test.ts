import { describe, expect, it, vi } from "vitest";
import type { ScraperOptions } from "../types";
import { FrontMatterMiddleware } from "./FrontMatterMiddleware";
import type { MiddlewareContext } from "./types";

// Helper to create a minimal valid ScraperOptions object
const createMockScraperOptions = (url = "http://example.com"): ScraperOptions => ({
  url,
  library: "test-lib",
  version: "1.0.0",
  maxDepth: 0,
  maxPages: 1,
  maxConcurrency: 1,
  scope: "subpages",
  followRedirects: true,
  excludeSelectors: [],
  ignoreErrors: false,
});

const createMockContext = (
  markdownContent: string,
  source = "http://example.com",
  options?: Partial<ScraperOptions>,
): MiddlewareContext => {
  return {
    content: markdownContent,
    contentType: "text/markdown",
    source,
    links: [],
    errors: [],
    options: { ...createMockScraperOptions(source), ...options },
  };
};

describe("FrontMatterMiddleware", () => {
  it("should extract and parse YAML front-matter correctly", async () => {
    const middleware = new FrontMatterMiddleware();
    const markdown = `---
name: Test Document
uuid: test-uuid-123
link: https://example.com/original
topic: Testing
date: 2025-11-17
---

# Content Heading

Some content here.`;
    const context = createMockContext(markdown);
    const next = vi.fn().mockResolvedValue(undefined);

    await middleware.process(context, next);

    expect(next).toHaveBeenCalledOnce();
    expect(context.frontMatter).toBeDefined();
    expect(context.frontMatter?.name).toBe("Test Document");
    expect(context.frontMatter?.uuid).toBe("test-uuid-123");
    expect(context.frontMatter?.link).toBe("https://example.com/original");
    expect(context.frontMatter?.topic).toBe("Testing");
    // gray-matter parses dates as Date objects
    expect(context.frontMatter?.date).toBeInstanceOf(Date);
    expect(context.errors).toHaveLength(0);
  });

  it("should remove front-matter from content", async () => {
    const middleware = new FrontMatterMiddleware();
    const markdown = `---
name: Test Document
---

# Content Heading

Some content here.`;
    const context = createMockContext(markdown);
    const next = vi.fn().mockResolvedValue(undefined);

    await middleware.process(context, next);

    expect(next).toHaveBeenCalledOnce();
    expect(context.content).not.toContain("---");
    expect(context.content).not.toContain("name: Test Document");
    expect(context.content).toContain("# Content Heading");
    expect(context.content).toContain("Some content here.");
  });

  it("should use front-matter name as title if no title is set", async () => {
    const middleware = new FrontMatterMiddleware();
    const markdown = `---
name: Document Title from Front Matter
---

Content without H1 heading.`;
    const context = createMockContext(markdown);
    const next = vi.fn().mockResolvedValue(undefined);

    await middleware.process(context, next);

    expect(next).toHaveBeenCalledOnce();
    expect(context.title).toBe("Document Title from Front Matter");
  });

  it("should not override existing title", async () => {
    const middleware = new FrontMatterMiddleware();
    const markdown = `---
name: Front Matter Title
---

Content here.`;
    const context = createMockContext(markdown);
    context.title = "Existing Title"; // Pre-set title
    const next = vi.fn().mockResolvedValue(undefined);

    await middleware.process(context, next);

    expect(next).toHaveBeenCalledOnce();
    expect(context.title).toBe("Existing Title"); // Should not be overridden
  });

  it("should store original link from front-matter", async () => {
    const middleware = new FrontMatterMiddleware();
    const markdown = `---
link: https://docs.example.com/page123
---

Content here.`;
    const context = createMockContext(markdown);
    const next = vi.fn().mockResolvedValue(undefined);

    await middleware.process(context, next);

    expect(next).toHaveBeenCalledOnce();
    expect(context.originalLink).toBe("https://docs.example.com/page123");
  });

  it("should store hierarchical path from front-matter", async () => {
    const middleware = new FrontMatterMiddleware();
    const markdown = `---
path: ["Category", "Subcategory", "Topic"]
---

Content here.`;
    const context = createMockContext(markdown);
    const next = vi.fn().mockResolvedValue(undefined);

    await middleware.process(context, next);

    expect(next).toHaveBeenCalledOnce();
    expect(context.hierarchicalPath).toBeDefined();
    expect(context.hierarchicalPath).toEqual(["Category", "Subcategory", "Topic"]);
  });

  it("should work correctly with markdown without front-matter", async () => {
    const middleware = new FrontMatterMiddleware();
    const markdown = `# Regular Markdown

Just regular content without front-matter.`;
    const context = createMockContext(markdown);
    const next = vi.fn().mockResolvedValue(undefined);

    await middleware.process(context, next);

    expect(next).toHaveBeenCalledOnce();
    expect(context.frontMatter).toBeUndefined();
    expect(context.originalLink).toBeUndefined();
    expect(context.hierarchicalPath).toBeUndefined();
    expect(context.content).toBe(markdown); // Content unchanged
    expect(context.errors).toHaveLength(0);
  });

  it("should handle empty front-matter gracefully", async () => {
    const middleware = new FrontMatterMiddleware();
    const markdown = `---
---

Content here.`;
    const context = createMockContext(markdown);
    const next = vi.fn().mockResolvedValue(undefined);

    await middleware.process(context, next);

    expect(next).toHaveBeenCalledOnce();
    expect(context.frontMatter).toBeUndefined();
    expect(context.errors).toHaveLength(0);
  });

  it("should handle invalid YAML and add error", async () => {
    const middleware = new FrontMatterMiddleware();
    const markdown = `---
invalid: yaml: syntax: error
[not valid
---

Content here.`;
    const context = createMockContext(markdown);
    const next = vi.fn().mockResolvedValue(undefined);

    await middleware.process(context, next);

    expect(next).toHaveBeenCalledOnce(); // Should still call next
    expect(context.errors.length).toBeGreaterThan(0);
    expect(context.errors[0].message).toContain("Failed to parse front-matter");
  });

  it("should extract all standard front-matter fields", async () => {
    const middleware = new FrontMatterMiddleware();
    const markdown = `---
name: Complete Document
uuid: abc-def-123
link: https://example.com/doc
path: ["Level1", "Level2", "Level3"]
topic: Documentation
date: 2025-11-17T10:30:00Z
customField: Custom Value
---

Content here.`;
    const context = createMockContext(markdown);
    const next = vi.fn().mockResolvedValue(undefined);

    await middleware.process(context, next);

    expect(next).toHaveBeenCalledOnce();
    expect(context.frontMatter).toBeDefined();
    expect(context.frontMatter?.name).toBe("Complete Document");
    expect(context.frontMatter?.uuid).toBe("abc-def-123");
    expect(context.frontMatter?.link).toBe("https://example.com/doc");
    expect(context.frontMatter?.path).toEqual(["Level1", "Level2", "Level3"]);
    expect(context.frontMatter?.topic).toBe("Documentation");
    // gray-matter parses dates as Date objects
    expect(context.frontMatter?.date).toBeInstanceOf(Date);
    expect(context.frontMatter?.customField).toBe("Custom Value");
  });

  it("should handle front-matter with only some fields", async () => {
    const middleware = new FrontMatterMiddleware();
    const markdown = `---
name: Partial Document
topic: Testing
---

Content here.`;
    const context = createMockContext(markdown);
    const next = vi.fn().mockResolvedValue(undefined);

    await middleware.process(context, next);

    expect(next).toHaveBeenCalledOnce();
    expect(context.frontMatter).toBeDefined();
    expect(context.frontMatter?.name).toBe("Partial Document");
    expect(context.frontMatter?.topic).toBe("Testing");
    expect(context.frontMatter?.uuid).toBeUndefined();
    expect(context.frontMatter?.link).toBeUndefined();
  });

  it("should handle empty markdown content", async () => {
    const middleware = new FrontMatterMiddleware();
    const markdown = "";
    const context = createMockContext(markdown);
    const next = vi.fn().mockResolvedValue(undefined);

    await middleware.process(context, next);

    expect(next).toHaveBeenCalledOnce();
    expect(context.frontMatter).toBeUndefined();
    expect(context.errors).toHaveLength(0);
  });

  it("should preserve content formatting after front-matter removal", async () => {
    const middleware = new FrontMatterMiddleware();
    const markdown = `---
name: Test
---

# Heading 1

Paragraph 1.

## Heading 2

Paragraph 2.`;
    const context = createMockContext(markdown);
    const next = vi.fn().mockResolvedValue(undefined);

    await middleware.process(context, next);

    expect(next).toHaveBeenCalledOnce();
    expect(context.content).toContain("# Heading 1");
    expect(context.content).toContain("## Heading 2");
    expect(context.content).toContain("Paragraph 1.");
    expect(context.content).toContain("Paragraph 2.");
  });
});
