# Suggested Commands

## Development

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

## Testing

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

## Code Quality

```bash
# Lint and format
npm run lint              # Check code with Biome
npm run lint:fix          # Auto-fix linting issues
npm run format            # Format code with Biome
```

## Running the Server

```bash
# Standalone server (recommended for development)
npm start

# Specific modes
npm run cli -- mcp        # MCP server only
npm run cli -- web        # Web interface only
npm run cli -- worker     # Worker process only
```

## CLI Operations

```bash
# List indexed libraries
npm run cli -- list

# Search documentation
npm run cli -- search <library> <query>

# Scrape documentation
npm run cli -- scrape <library> <url>
```

## Git Operations (macOS/Darwin)

```bash
# Standard git commands work on macOS
git status
git add <files>
git commit -m "feat: description"
git push
git pull
git log
```

## File Operations (macOS/Darwin)

```bash
# List files
ls -la

# Find files
find . -name "*.ts"

# Search in files (prefer ripgrep if available)
grep -r "pattern" src/
rg "pattern" src/

# Change directory
cd <directory>

# View file
cat <file>
head -n 20 <file>
tail -n 20 <file>
```

## macOS-Specific Notes

- macOS uses BSD versions of some commands (different from GNU Linux)
- Some commands may have different flags (e.g., `sed -i` requires backup extension)
- Standard Unix commands work but may have subtle differences
