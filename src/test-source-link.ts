/**
 * Test script to verify source_link functionality from front-matter to database
 * This test runs independently of Docker to isolate the functionality
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import type { RawContent } from "./scraper/fetcher/types.js";
import { MarkdownPipeline } from "./scraper/pipelines/MarkdownPipeline.js";
import type { ScrapeResult, ScraperOptions } from "./scraper/types.js";
import { DocumentRetrieverService } from "./store/DocumentRetrieverService.js";
import { DocumentStore } from "./store/DocumentStore.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");

const TEST_DB_PATH = path.join(PROJECT_ROOT, ".store-test-source-link", "test.db");

// Test markdown content with front-matter
const TEST_MARKDOWN = `---
name: Test Document
uuid: test-uuid-123
link: https://example.com/original/document
path: ["Test", "Category", "Document"]
topic: testing
---

# Test Document

This is a test document to verify source_link functionality.

The front-matter above contains a \`link\` field that should be stored
in the database as \`source_link\` and returned in search results as \`sourceLink\`.
`;

async function runTest() {
  console.log("🧪 Starting source_link functionality test\n");

  // Clean up previous test database
  const dbDir = path.dirname(TEST_DB_PATH);
  if (fs.existsSync(dbDir)) {
    fs.rmSync(dbDir, { recursive: true });
  }
  fs.mkdirSync(dbDir, { recursive: true });

  try {
    // Step 1: Initialize database
    console.log("1️⃣  Initializing test database...");
    const store = new DocumentStore(TEST_DB_PATH);
    await store.initialize();
    console.log("   ✅ Database initialized\n");

    // Step 2: Process markdown through pipeline
    console.log("2️⃣  Processing markdown through MarkdownPipeline...");
    const pipeline = new MarkdownPipeline();

    const rawContent: RawContent = {
      content: Buffer.from(TEST_MARKDOWN, "utf-8"),
      mimeType: "text/markdown",
      source: "file:///test/document.md",
      charset: "utf-8",
    };

    const options: ScraperOptions = {
      url: "file:///test",
      library: "test-lib",
      version: "1.0",
    };

    const result = await pipeline.process(rawContent, options);

    console.log("   📄 Pipeline result:");
    console.log(`      - title: ${result.title}`);
    console.log(`      - originalLink: ${result.originalLink}`);
    console.log(`      - chunks: ${result.chunks?.length || 0}`);

    if (!result.originalLink) {
      console.error("   ❌ ERROR: originalLink is missing from pipeline result!");
      console.error("      Expected: https://example.com/original/document");
      process.exit(1);
    }
    console.log("   ✅ Pipeline extracted originalLink correctly\n");

    // Step 3: Store in database
    console.log("3️⃣  Storing document in database...");

    // Convert PipelineResult to ScrapeResult
    const scrapeResult: ScrapeResult = {
      url: "file:///test/document.md",
      title: result.title || "Test Document",
      contentType: result.contentType || "text/markdown",
      textContent: result.textContent || "",
      links: result.links || [],
      errors: result.errors || [],
      chunks: result.chunks || [],
      originalLink: result.originalLink,
    };

    await store.addDocuments(
      "test-lib",
      "1.0",
      "file:///test/document.md",
      scrapeResult,
      0, // depth
    );
    console.log("   ✅ Document stored\n");

    // Step 4: Query database directly to verify source_link
    console.log("4️⃣  Querying database for source_link...");
    // Access internal db for testing purposes
    const db = (store as any).db;
    const pageQuery = db.prepare(`
      SELECT p.url, p.source_link, p.title
      FROM pages p
      JOIN libraries l ON p.version_id IN (SELECT id FROM versions WHERE library_id = l.id)
      WHERE l.name = 'test-lib'
    `);

    const pages = pageQuery.all() as Array<{
      url: string;
      source_link: string | null;
      title: string;
    }>;

    console.log(`   📊 Found ${pages.length} page(s):`);
    for (const page of pages) {
      console.log(`      - URL: ${page.url}`);
      console.log(`      - Title: ${page.title}`);
      console.log(`      - source_link: ${page.source_link}`);
    }

    if (pages.length === 0) {
      console.error("   ❌ ERROR: No pages found in database!");
      process.exit(1);
    }

    const testPage = pages[0];
    if (!testPage.source_link) {
      console.error("   ❌ ERROR: source_link is NULL in database!");
      console.error("      Expected: https://example.com/original/document");
      process.exit(1);
    }

    if (testPage.source_link !== "https://example.com/original/document") {
      console.error(`   ❌ ERROR: source_link has wrong value: ${testPage.source_link}`);
      console.error("      Expected: https://example.com/original/document");
      process.exit(1);
    }

    console.log("   ✅ source_link stored correctly in database\n");

    // Step 5: Test search retrieval
    console.log("5️⃣  Testing search with DocumentRetrieverService...");
    const retriever = new DocumentRetrieverService(store);
    const searchResults = await retriever.search("test-lib", "1.0", "test document", 10);

    console.log(`   🔍 Search returned ${searchResults.length} result(s):`);
    for (const result of searchResults) {
      console.log(`      - URL: ${result.url}`);
      console.log(`      - Score: ${result.score}`);
      console.log(`      - mimeType: ${result.mimeType}`);
      console.log(`      - sourceLink: ${result.sourceLink}`);
    }

    if (searchResults.length === 0) {
      console.error("   ❌ ERROR: No search results found!");
      process.exit(1);
    }

    const searchResult = searchResults[0];
    if (!searchResult.sourceLink) {
      console.error("   ❌ ERROR: sourceLink is missing from search result!");
      console.error("      Expected: https://example.com/original/document");
      process.exit(1);
    }

    if (searchResult.sourceLink !== "https://example.com/original/document") {
      console.error(
        `   ❌ ERROR: sourceLink has wrong value: ${searchResult.sourceLink}`,
      );
      console.error("      Expected: https://example.com/original/document");
      process.exit(1);
    }

    console.log("   ✅ sourceLink returned correctly in search results\n");

    // Success!
    console.log("✅ All tests passed! source_link functionality works correctly.\n");
    console.log("📊 Test Summary:");
    console.log("   ✓ MarkdownPipeline extracts originalLink from front-matter");
    console.log("   ✓ DocumentStore stores originalLink as source_link in database");
    console.log(
      "   ✓ DocumentRetrieverService returns source_link as sourceLink in search results",
    );
    console.log("");
  } catch (error) {
    console.error("\n❌ Test failed with error:");
    console.error(error);
    process.exit(1);
  }
}

// Run the test
runTest().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
