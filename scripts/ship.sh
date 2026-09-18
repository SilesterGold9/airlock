#!/usr/bin/env bash
# Sync dev into main and come back to dev.
# Tagging a release stays a deliberate manual step:
#   git tag vX.Y.Z && git push origin main vX.Y.Z
set -euo pipefail

BRANCH=$(git branch --show-current)
if [ "$BRANCH" != "dev" ]; then
  echo "run npm run ship from dev (on $BRANCH)"
  exit 1
fi
if [ -n "$(git status --porcelain)" ]; then
  echo "dirty tree — commit first:"
  git status --short
  exit 1
fi

git pull --ff-only origin dev
git push origin dev
git checkout main
git pull --ff-only origin main
git merge --ff-only dev
git push origin main
git checkout dev
echo "main is now $(git rev-parse --short main). Tag a release when ready."
