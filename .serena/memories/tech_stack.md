# Technology Stack

## Runtime & Language

- **Runtime**: Node.js 22.x
- **Language**: TypeScript
- **Build System**: Vite
- **Package Manager**: npm

## Testing

- **Framework**: Vitest (unit + e2e tests)
- **E2E Testing**: Playwright

## Database & Storage

- **Database**: SQLite
- **Vector Search**: sqlite-vec extension
- **Schema**: 8 normalized tables (libraries, versions, pages, documents, vectors, documents_fts, jobs, scraper_options)

## Web Scraping

- **JavaScript-enabled sites**: Playwright
- **Static HTML**: Cheerio
- **Code Parsing**: TreeSitter for semantic code analysis

## Embeddings & AI

- **Framework**: LangChain.js
- **Providers**: OpenAI, Google Gemini, Azure OpenAI, AWS Bedrock, Ollama, LM Studio

## Web UI

- **Rendering**: Server-rendered with kitajs TSX
- **Interactivity**: AlpineJS
- **Styling**: TailwindCSS
- **Server Interactions**: HTMX
- **CSS Processing**: PostCSS

## API & Communication

- **RPC**: tRPC for type-safe communication between services
- **Web Server**: Fastify

## Code Quality Tools

- **Linter & Formatter**: Biome
- **Git Hooks**: Husky
- **Commit Linting**: commitlint (Conventional Commits)
- **Release Management**: semantic-release

## Authentication (Optional)

- OAuth2/OIDC with dynamic client registration
- JWT validation
