# Codebase Structure

## Top-Level Directories

```
docs-mcp-server/
├── .claude/           # Claude Code configuration
├── .github/           # GitHub workflows and CI/CD
├── .husky/            # Git hooks
├── db/                # Database migrations
├── docs/              # Feature-specific documentation
├── public/            # Static assets for web UI
├── src/               # Source code (main codebase)
├── test/              # Test files
└── node_modules/      # Dependencies
```

## Source Code Structure (`src/`)

### Entry Point
- `src/index.ts`: Main entry point with CLI parsing and protocol auto-detection

### Core Directories

#### Application Layer
- `src/app/`: Application server implementation
  - `AppServer.ts`: Unified server with modular service composition

#### Access Layer (Interfaces)
- `src/cli/`: Command-line interface and commands
- `src/mcp/`: MCP (Model Context Protocol) server implementation
- `src/web/`: Web UI routes and components

#### Business Logic Layer
- `src/tools/`: Business logic implementations
  - Tools used by all interfaces (ScrapeTool, SearchTool, ListLibrariesTool, etc.)
  - Accept `IPipeline` interface for worker abstraction

#### Pipeline & Processing
- `src/pipeline/`: Asynchronous job processing system
  - `PipelineFactory`: Selects between local or remote worker
  - `PipelineManager`: Job queue with SQLite persistence
  - `PipelineWorker`: Executes scraping jobs
  - `trpc/`: tRPC router for distributed worker communication

#### Content Processing
- `src/scraper/`: Content acquisition and processing
  - `strategies/`: Source-specific scrapers (Web, GitHub, npm, PyPI, LocalFile)
  - `pipelines/`: Content-type processors (HTML, Markdown, JSON, SourceCode, Text)
  - `middleware/`: HTML transformation chain
  - `fetcher/`: HTTP and file fetching with charset detection

- `src/splitter/`: Document chunking strategies
  - `SemanticMarkdownSplitter`: Structure-aware markdown splitting
  - `TreesitterSourceCodeSplitter`: Language-aware code splitting
  - `JsonDocumentSplitter`: Hierarchical JSON splitting
  - `GreedySplitter`: Universal size optimization

#### Data Layer
- `src/store/`: Data persistence and retrieval
  - `DocumentStore`: SQLite operations with vector search
  - `DocumentManagementService`: Document and version management
  - `DocumentRetrieverService`: Hybrid search implementation
  - `assembly/`: Content reassembly strategies

#### Supporting Services
- `src/auth/`: OAuth2/OIDC authentication (optional)
- `src/services/`: Shared services
- `src/telemetry/`: Privacy-first analytics
- `src/types/`: TypeScript type definitions
- `src/utils/`: Utility functions

## Database Schema (`db/migrations/`)

8 normalized tables:
- `libraries`: Top-level documentation libraries
- `versions`: Version-specific library instances
- `pages`: Scraped pages with ETags
- `documents`: Processed document chunks (hierarchical)
- `vectors`: Vector embeddings
- `documents_fts`: Full-text search index
- `jobs`: Pipeline job tracking
- `scraper_options`: Scraper configuration

## Key Configuration Files

- `package.json`: Dependencies and scripts
- `tsconfig.json`: TypeScript configuration
- `vite.config.ts`: Server build configuration
- `vite.config.web.ts`: Web UI build configuration
- `biome.json`: Code quality configuration
- `.env.example`: Environment variable template

## Documentation Files

- `README.md`: User-focused (installation, setup, troubleshooting)
- `CLAUDE.md`: AI assistant guidance
- `ARCHITECTURE.md`: Developer-focused system design
- `AGENTS.md`: Development guidelines
- `docs/`: Feature-specific documentation
