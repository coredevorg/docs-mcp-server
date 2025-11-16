# Code Style & Conventions

## Core Principles

- **DRY** (Don't Repeat Yourself)
- **KISS** (Keep It Simple, Stupid)
- **YAGNI** (You Aren't Gonna Need It)
- **SOLID** principles

## TypeScript Standards

- Use `unknown` or specific types over `any`
- **No non-null assertions** (`!`); use optional chaining (`?.`) or nullish coalescing (`??`)
- Install dependencies via `npm install`, not manual `package.json` edits
- Follow Biome for formatting and import order

## Architecture Patterns

- **Layered Architecture**:
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

- **Key Principle**: All interfaces (CLI, MCP, Web) delegate to the same Tools layer
- **No business logic duplication** across interfaces
- **Interface abstraction**: Tools accept `IPipeline` interface, not concrete implementations

## File Organization

- **Test files**: Create `.test.ts` files next to source files
- **Source file headers**: Must start with comment block explaining purpose and logic

## TSX/Web UI Conventions

- Avoid `{foo && <Bar />}` in TSX; use ternary expressions instead
- Use AlpineJS for interactivity, TailwindCSS for styling
- HTMX for server interactions

## Logging Conventions

- `console.*`: CLI user output (results, direct feedback)
- `logger.info/warn/error`: Application events with emoji prefix
- `logger.debug`: Developer/tracing logs **without** emoji
- **Prefer** `logger.debug` over `logger.info` for internal steps

## Git Workflow

### Branch Naming
Format: `<type>/<issue>-<description>`  
Example: `feature/123-add-search`, `fix/456-memory-leak`

### Commit Format
Follow **Conventional Commits**:
- `feat:` New features
- `fix:` Bug fixes
- `chore:` Maintenance tasks
- `docs:` Documentation changes
- `refactor:` Code refactoring
- `test:` Test additions/changes

### Commit Guidelines
- **Subject**: Imperative mood, ≤72 characters
- **Body**: Explain what and why, not how
- **Target branch**: `main`

## Naming Conventions

- Use descriptive names
- Follow TypeScript/JavaScript conventions (camelCase for variables/functions, PascalCase for classes)
- Suffix strategy classes with "Strategy" (e.g., `WebScraperStrategy`)
- Suffix service classes with "Service" (e.g., `DocumentManagementService`)
