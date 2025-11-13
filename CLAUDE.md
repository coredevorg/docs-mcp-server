# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

The Docs MCP Server is a documentation indexing and search system that provides AI assistants with up-to-date, version-specific documentation via the Model Context Protocol (MCP). It scrapes documentation from websites, GitHub repositories, package registries (npm, PyPI), and local files, then makes it searchable using semantic vector embeddings and full-text search.

**Repository**: `arabold/docs-mcp-server`

## Essential Commands

### Development
```bash
# Build the project (web UI + server)
npm run build

# Development mode with hot reload
npm run dev              # Runs both server and web in parallel
npm run dev:server       # Server only
npm run dev:web          # Web UI only

# Start built server
npm start
```

### Testing
```bash
# Run all unit tests
npm test

# Watch mode for development
npm run test:watch

# Run end-to-end tests (requires Playwright)
npm run test:e2e
npm run test:e2e:watch

# Coverage report
npm run test:coverage
```

### Code Quality
```bash
# Lint and format
npm run lint              # Check code with Biome
npm run lint:fix          # Auto-fix linting issues
npm run format            # Format code with Biome
```

### Running the Server
```bash
# Standalone server (recommended for development)
npm start

# Specific modes
npm run cli -- mcp        # MCP server only
npm run cli -- web        # Web interface only
npm run cli -- worker     # Worker process only

# CLI operations
npm run cli -- list                           # List indexed libraries
npm run cli -- search <library> <query>       # Search documentation
npm run cli -- scrape <library> <url>         # Scrape documentation
```

## Architecture Overview

### Deployment Modes

The system supports two deployment architectures:

1. **Unified Server** (default): Single process with embedded MCP server, web UI, and worker. Protocol auto-detection based on TTY (stdio for AI tools, HTTP for interactive terminals).

2. **Distributed Mode**: Separate services coordinated via tRPC:
   - Worker process (port 8080): Handles scraping/indexing jobs
   - MCP Server (port 6280): Provides `/sse` and `/mcp` endpoints
   - Web Interface (port 6281): Browser-based management

### System Layers

The codebase follows a strict layered architecture:

```
Access Layer (CLI, MCP, Web)
    ↓
Tools Layer (Business Logic)
    ↓
Pipeline Management (Job Processing)
    ↓
Content Processing (Scraping, Splitting, Embeddings)
    ↓
Data Layer (DocumentStore, SQLite)
```

**Key Principle**: All interfaces (CLI, MCP, Web) delegate to the same Tools layer. No business logic duplication across interfaces.

### Core Components

**`src/index.ts`**: Entry point with CLI parsing and protocol auto-detection. Determines whether to run stdio MCP server, HTTP server, web interface, or worker based on TTY status and arguments.

**`src/app/AppServer.ts`**: Unified server implementation using modular service composition. Registers MCP service, web service, and worker service in a single Fastify instance.

**`src/pipeline/`**: Asynchronous job processing system
- `PipelineFactory`: Selects between `PipelineManager` (local worker) or `PipelineClient` (remote worker via tRPC)
- `PipelineManager`: Job queue with SQLite persistence and recovery
- `PipelineWorker`: Executes individual scraping jobs
- `trpc/router.ts`: tRPC procedures for distributed worker communication

**`src/tools/`**: Business logic implementations used by all interfaces
- `ScrapeTool`, `SearchTool`, `ListLibrariesTool`, `RemoveTool`
- `GetJobInfoTool`, `ListJobsTool`, `CancelJobTool`
- All tools accept `IPipeline` interface for worker abstraction

**`src/scraper/`**: Content acquisition and processing
- `strategies/`: Source-specific scrapers (Web, GitHub, npm, PyPI, LocalFile)
- `pipelines/`: Content-type processors (HTML, Markdown, JSON, SourceCode, Text)
- `middleware/`: HTML transformation chain (Playwright, Cheerio, normalization, sanitization)
- `fetcher/`: HTTP and file fetching with charset detection

**`src/splitter/`**: Document chunking strategies
- `SemanticMarkdownSplitter`: Structure-aware markdown splitting (preserves headings, code blocks)
- `TreesitterSourceCodeSplitter`: Language-aware code splitting for TypeScript/JavaScript/Python
- `JsonDocumentSplitter`: Hierarchical JSON splitting
- `GreedySplitter`: Universal size optimization wrapper
- All splitters create hierarchical chunks with parent-child relationships

**`src/store/`**: Data persistence and retrieval
- `DocumentStore`: SQLite operations with vector search (sqlite-vec extension)
- `DocumentManagementService`: High-level document and version management
- `DocumentRetrieverService`: Search with hybrid vector + FTS scoring
- `assembly/`: Content reassembly strategies for search results

### Technology Stack

- **Runtime**: Node.js 22.x
- **Language**: TypeScript with Vite build system
- **Testing**: Vitest (unit + e2e)
- **Database**: SQLite with sqlite-vec for vector search
- **Web Scraping**: Playwright (JavaScript-enabled sites), Cheerio (static HTML)
- **Embeddings**: LangChain.js with multiple providers (OpenAI, Google, Azure, AWS)
- **Web UI**: HTMX, AlpineJS, TailwindCSS (server-rendered with kitajs TSX)
- **Code Parsing**: TreeSitter for semantic code analysis
- **API**: tRPC for type-safe RPC between services

### Database Schema

SQLite schema with 8 normalized tables (see `db/migrations/`):
- `libraries`: Top-level documentation libraries
- `versions`: Version-specific library instances
- `pages`: Scraped pages with ETags for refresh detection
- `documents`: Processed document chunks with hierarchical relationships
- `vectors`: Vector embeddings (linked to documents)
- `documents_fts`: Full-text search index
- `jobs`: Pipeline job tracking with progress/status
- `scraper_options`: Scraper configuration persistence

**Key Relationships**:
- Libraries → Versions (1:N)
- Versions → Pages → Documents (1:N:N)
- Documents → Documents (parent-child hierarchy)
- Documents → Vectors (1:1)

### Content Processing Pipeline

1. **Scraping**: Strategy pattern selects appropriate scraper based on URL
2. **Pipeline Selection**: Auto-detects content type (HTML, Markdown, JSON, SourceCode, Text)
3. **Middleware**: HTML-specific transformations (JS execution, normalization, sanitization)
4. **Splitting**: Semantic chunking based on document structure
5. **Embedding**: Generate vectors using configured provider
6. **Storage**: Persist documents, vectors, and metadata to SQLite
7. **Assembly**: Reassemble hierarchical chunks for search results

### Search Algorithm

**Hybrid Search** combines vector similarity and full-text search:
1. Vector search with configurable overfetch multiplier
2. FTS search with equal limit
3. Score normalization and combination (configurable weights)
4. Hierarchical reassembly (fetches parent chunks for context)
5. Content-aware assembly strategies (Markdown vs generic)

## Development Guidelines

### Code Organization

- **DRY, KISS, YAGNI, SOLID**: Follow these principles strictly
- **No business logic in interfaces**: All logic goes in Tools layer
- **Interface abstraction**: Tools accept `IPipeline`, not concrete implementations
- **Test alongside source**: Create `.test.ts` files next to source files

### TypeScript Standards

- Use `unknown` or specific types over `any`
- No non-null assertions (`!`); use optional chaining (`?.`) or nullish coalescing (`??`)
- Install dependencies via `npm install`, not manual `package.json` edits
- Follow Biome for formatting and import order

### Documentation Requirements

- **Source files**: Must start with comment block explaining purpose and logic
- **README.md**: End-user focused (installation, setup, troubleshooting)
- **ARCHITECTURE.md**: Developer focused (system design, component relationships)
- **docs/**: Feature-specific documentation
- Write in present tense, describing current behavior
- Update documentation when architecture changes

### Testing Philosophy

- Focus on high-value, low-effort tests first
- Test intended behavior, not implementation details
- Create unit tests alongside source (`.test.ts` suffix)
- Avoid timing-sensitive tests unless necessary
- Defer complex mocking/state management unless requested

### Logging Conventions

- `console.*`: CLI user output (results, direct feedback)
- `logger.info/warn/error`: Application events with emoji prefix
- `logger.debug`: Developer/tracing logs without emoji
- Prefer `logger.debug` over `logger.info` for internal steps

### Git Workflow

- Branch naming: `<type>/<issue>-<description>` (e.g., `feature/123-add-search`)
- Commit format: Conventional Commits (`feat:`, `fix:`, `chore:`, etc.)
- Commit subject: Imperative mood, ≤72 characters
- Commit body: Explain what and why, not how
- Pull requests target `main` branch

### Web UI Development

- AlpineJS for interactivity, TailwindCSS for styling
- Use TSX with kitajs for server-rendered components
- HTMX for server interactions
- Avoid `{foo && <Bar />}` in TSX; use ternary expressions

### Authentication (Optional)

OAuth2/OIDC support with dynamic client registration:
- Enable via `--auth-enabled` flag
- Configure issuer URL and audience
- See `docs/authentication.md` for details
- Implementation in `src/auth/ProxyAuthManager.ts`

## Common Patterns

### Adding a New Tool

1. Create `src/tools/MyTool.ts` with class extending base
2. Implement business logic accepting `IPipeline` interface
3. Register in `src/mcp/tools.ts` for MCP exposure
4. Create CLI command in `src/cli/commands/myCommand.ts`
5. Add web route in `src/web/routes/` if needed
6. Write unit tests in `src/tools/MyTool.test.ts`

### Adding a New Scraper Strategy

1. Create `src/scraper/strategies/MyStrategy.ts` extending `BaseScraperStrategy`
2. Implement `shouldHandle()`, `scrape()`, `getDefaultIncludes/Excludes()`
3. Register in `src/scraper/ScraperRegistry.ts`
4. Create pipeline if new content type needed
5. Add tests in `src/scraper/strategies/MyStrategy.test.ts`

### Adding a New Content Pipeline

1. Create `src/scraper/pipelines/MyPipeline.ts` extending `BasePipeline`
2. Configure middleware chain for content type
3. Select appropriate splitter for content structure
4. Register in `src/scraper/pipelines/PipelineFactory.ts`
5. Add integration tests in `src/scraper/pipelines/MyPipeline.test.ts`

### Adding Database Migrations

1. Create numbered migration file: `db/migrations/NNN-description.sql`
2. Write idempotent SQL (check existence before creating)
3. Update schema in `src/store/types.ts` if needed
4. Test migration in `src/store/applyMigrations.test.ts`
5. Migrations run automatically on startup

## Important Files

- `ARCHITECTURE.md`: System design and component relationships (read before cross-service changes)
- `AGENTS.md`: Development guidelines and conventions
- `docs/deployment-modes.md`: Server architecture and scaling
- `docs/content-processing.md`: Pipeline and middleware details
- `docs/source-code-splitter.md`: TreeSitter implementation
- `docs/telemetry.md`: Privacy-first analytics
- `docs/authentication.md`: OAuth2/OIDC setup

## Environment Variables

Key configuration via environment variables:

- `OPENAI_API_KEY`: OpenAI API key for embeddings
- `DOCS_MCP_EMBEDDING_MODEL`: Model to use (default: `text-embedding-3-small`)
- `DOCS_MCP_STORE_PATH`: Custom data storage path
- `DOCS_MCP_PROTOCOL`: Force protocol (auto, stdio, http)
- `DOCS_MCP_PORT`: Server port (default: 6280)
- `DOCS_MCP_HOST`: Bind address (default: 127.0.0.1)
- `DOCS_MCP_TELEMETRY`: Disable telemetry (set to `false`)
- `DOCS_MCP_AUTH_ENABLED`: Enable OAuth2 authentication
- `DOCS_MCP_AUTH_ISSUER_URL`: OAuth2 issuer URL
- `DOCS_MCP_AUTH_AUDIENCE`: JWT audience claim

See README.md for provider-specific configurations (Google, Azure, AWS, Ollama, LM Studio).
