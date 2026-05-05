#!/bin/bash
# Shared preparation steps for all Electron build/pack scripts.
# Builds Next.js (with API route backup), compiles TypeScript, and builds all MCP sub-packages.
set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Backup API routes and icon that are incompatible with static export
mv "$REPO_ROOT/src/app/api" "$REPO_ROOT/src/app/_api_backup"
mv "$REPO_ROOT/src/app/icon.tsx" "$REPO_ROOT/src/app/_icon_backup.tsx" 2>/dev/null || true

cleanup() {
  mv "$REPO_ROOT/src/app/_api_backup" "$REPO_ROOT/src/app/api" 2>/dev/null || true
  mv "$REPO_ROOT/src/app/_icon_backup.tsx" "$REPO_ROOT/src/app/icon.tsx" 2>/dev/null || true
}
trap cleanup EXIT

# Build Next.js static export
ELECTRON_BUILD=1 npx next build

# Compile Electron TypeScript
tsc -p electron/tsconfig.json

# Build all MCP sub-packages
for pkg in mcp-orchestrator mcp-telegram mcp-kanban mcp-vault mcp-socialdata mcp-x mcp-world; do
  pushd "$pkg" > /dev/null
  npm install && npm run build
  popd > /dev/null
done
