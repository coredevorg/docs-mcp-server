#!/usr/bin/env bash
set -e

# Save current branch
CURRENT_BRANCH=$(git branch --show-current)

echo "📥 Fetching from upstream..."
git fetch upstream

echo "🔄 Switching to main..."
git checkout main

echo "⬇️  Pulling latest from upstream/main..."
git pull upstream main

echo "🔄 Switching back to $CURRENT_BRANCH..."
git checkout "$CURRENT_BRANCH"

echo "🔁 Rebasing $CURRENT_BRANCH on main..."
git rebase main

echo "✅ Done! $CURRENT_BRANCH is now up to date with upstream/main"
