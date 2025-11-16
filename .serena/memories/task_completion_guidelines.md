# Task Completion Guidelines

## When a Task is Completed

### 1. Code Quality Checks

Always run these commands before considering a task complete:

```bash
# Format code
npm run format

# Check linting
npm run lint

# Auto-fix linting issues if possible
npm run lint:fix
```

### 2. Testing

Run appropriate tests based on the changes:

```bash
# Run all unit tests
npm test

# Run specific test file (if applicable)
npm test -- <test-file-path>

# Run e2e tests (if UI changes were made)
npm run test:e2e

# Check coverage (for significant changes)
npm run test:coverage
```

### 3. Build Verification

Ensure the project builds successfully:

```bash
# Build the project
npm run build
```

### 4. Documentation Updates

Update documentation if needed:
- **Source files**: Add/update comment blocks explaining purpose
- **README.md**: Update if user-facing features changed
- **ARCHITECTURE.md**: Update if system design changed
- **docs/**: Update feature-specific documentation

Write in present tense, describing current behavior.

### 5. Git Workflow

Follow conventional commits:

```bash
# Stage changes
git add <files>

# Commit with conventional format
git commit -m "feat: add new feature description"
git commit -m "fix: resolve issue description"
git commit -m "chore: update dependencies"
git commit -m "docs: update documentation"

# Push to branch
git push
```

### Commit Message Format
- Type: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`
- Subject: Imperative mood, ≤72 characters
- Body: Explain what and why (optional)

### 6. Security Review

Verify no security vulnerabilities were introduced:
- No command injection
- No XSS vulnerabilities
- No SQL injection
- Follow OWASP top 10 guidelines

### 7. Testing Philosophy Checklist

- ✓ Tests focus on intended behavior, not implementation
- ✓ High-value, low-effort tests created
- ✓ Test files created alongside source (`.test.ts`)
- ✓ No timing-sensitive tests unless necessary
- ✓ Complex mocking deferred unless requested

## Summary Checklist

Before marking a task as complete:

- [ ] Code formatted (`npm run format`)
- [ ] Linting passed (`npm run lint` or `npm run lint:fix`)
- [ ] Tests pass (`npm test`)
- [ ] Build succeeds (`npm run build`)
- [ ] Documentation updated (if applicable)
- [ ] Security review completed
- [ ] Git commit follows conventions
- [ ] No regressions introduced
