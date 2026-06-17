#!/bin/bash
# Exit immediately if a command exits with a non-zero status
set -e

# Ensure we are on the v2-refactor branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "v2-refactor" ]; then
    echo "⚠️ Warning: You are not on the 'v2-refactor' branch (current: $CURRENT_BRANCH)."
    read -p "Do you want to switch to 'v2-refactor' first? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git checkout v2-refactor
    else
        echo "❌ Aborting."
        exit 1
    fi
fi

echo "🚀 Pushing local changes to remote 'v2-refactor'..."
git push origin v2-refactor

echo "🔄 Switching to 'main' branch..."
git checkout main

echo "📥 Pulling latest changes from remote 'main'..."
git pull origin main

echo "🔀 Merging 'v2-refactor' into 'main'..."
git merge v2-refactor -m "Merge branch 'v2-refactor' into main"

echo "📤 Pushing 'main' to origin to trigger Vercel deployment..."
git push origin main

echo "↩️ Switching back to 'v2-refactor'..."
git checkout v2-refactor

echo "✅ Vercel deployment update pushed successfully!"
