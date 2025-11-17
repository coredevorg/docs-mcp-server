import matter from "gray-matter";
import type {
  ContentProcessorMiddleware,
  FrontMatterData,
  MiddlewareContext,
} from "./types";

/**
 * Middleware to extract YAML front-matter metadata from Markdown content.
 *
 * This middleware parses YAML front-matter blocks at the beginning of Markdown files
 * and stores the extracted metadata in the processing context for use by subsequent
 * middleware and the chunking process.
 *
 * Front-matter format:
 * ```yaml
 * ---
 * name: Document Title
 * uuid: unique-identifier
 * link: https://original-source.com/doc
 * path: ["Category", "Subcategory", "Topic"]
 * topic: Main Topic
 * date: 2025-11-17
 * ---
 * ```
 *
 * The middleware will:
 * - Remove the front-matter block from the content
 * - Store parsed data in context.frontMatter
 * - Use front-matter name as title if no title is set
 * - Store original link for reference tracking
 * - Store hierarchical path for enhanced chunking
 */
export class FrontMatterMiddleware implements ContentProcessorMiddleware {
  /**
   * Processes the context to extract front-matter from Markdown.
   * @param context The current processing context.
   * @param next Function to call the next middleware.
   */
  async process(context: MiddlewareContext, next: () => Promise<void>): Promise<void> {
    try {
      // Parse front-matter if present
      const parsed = matter(context.content);

      if (parsed.data && Object.keys(parsed.data).length > 0) {
        const frontMatter = parsed.data as FrontMatterData;

        // Remove front-matter from content for further processing
        context.content = parsed.content;

        // Store in context for use by other middleware and chunking
        context.frontMatter = frontMatter;

        // Use front-matter name as title if available and no title is set yet
        if (frontMatter.name && !context.title) {
          context.title = frontMatter.name;
        }

        // Add original link to metadata if available
        if (frontMatter.link) {
          context.originalLink = frontMatter.link;
        }

        // Store hierarchical path for use in chunking
        if (frontMatter.path && Array.isArray(frontMatter.path)) {
          context.hierarchicalPath = frontMatter.path;
        }
      }
    } catch (error) {
      // If parsing fails, just continue with original content
      context.errors.push(
        new Error(
          `Failed to parse front-matter: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }

    await next();
  }
}
