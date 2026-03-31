#!/bin/bash
# Shared preparation steps for all Electron build/pack scripts.
# Builds Next.js (with API route backup), compiles TypeScript, and builds all MCP sub-packages.
set -e

# Backup API routes and icon that are incompatible with static export
mv src/app/api src/app/_api_backup
mv src/app/icon.tsx src/app/_icon_backup.tsx 2>/dev/null || true
trap "mv src/app/_api_backup src/app/api 2>/dev/null; mv src/app/_icon_backup.tsx src/app/icon.tsx 2>/dev/null" EXIT

# Build Next.js static export
ELECTRON_BUILD=1 next build

# Compile Electron TypeScript
tsc -p electron/tsconfig.json

# Build all MCP sub-packages
for pkg in mcp-orchestrator mcp-telegram mcp-kanban mcp-vault mcp-socialdata mcp-x mcp-world; do
  cd "$pkg" && npm install && npm run build && cd ..
done
