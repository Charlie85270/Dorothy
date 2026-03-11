#!/bin/bash
# Session start hook for dorothy
# Registers session ID and injects memory context (does NOT set running — that's UserPromptSubmit's job)

# Read JSON input from stdin
INPUT=$(cat)

# Extract info
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')
SOURCE=$(echo "$INPUT" | jq -r '.source // "startup"')

echo "[$(date)] SESSION_START hook. AGENT_ID=${CLAUDE_AGENT_ID:-unset} SESSION_ID=$SESSION_ID" >> /tmp/dorothy-hooks.log

# API endpoint
API_URL="http://127.0.0.1:31415"

# Get agent ID from environment or use session ID
AGENT_ID="${CLAUDE_AGENT_ID:-$SESSION_ID}"
PROJECT_PATH="${CLAUDE_PROJECT_PATH:-$CWD}"

# Check if API is available
if ! curl -s --connect-timeout 1 "$API_URL/api/health" > /dev/null 2>&1; then
  # API not running, just continue
  echo '{"continue":true,"suppressOutput":true}'
  exit 0
fi

# Register session ID with the agent (keep idle — only UserPromptSubmit sets running)
RESULT=$(curl -s --max-time 3 -X POST "$API_URL/api/hooks/status" \
  -H "Content-Type: application/json" \
  -d "{\"agent_id\": \"$AGENT_ID\", \"session_id\": \"$SESSION_ID\", \"status\": \"idle\", \"source\": \"$SOURCE\"}" 2>&1)
echo "[$(date)] SESSION_START curl result: $RESULT" >> /tmp/dorothy-hooks.log

# Get memory context for this agent/project
CONTEXT=$(curl -s --connect-timeout 2 "$API_URL/api/memory/context?agent_id=$AGENT_ID&project_path=$PROJECT_PATH" 2>/dev/null)

# Check if we got valid context
if [ -n "$CONTEXT" ] && [ "$CONTEXT" != "null" ] && [ "$CONTEXT" != "{}" ]; then
  HAS_CONTENT=$(echo "$CONTEXT" | jq -r '.context // empty' 2>/dev/null)

  if [ -n "$HAS_CONTENT" ] && [ "$HAS_CONTENT" != "No previous context found for this agent/project." ]; then
    # Escape the content for JSON
    ESCAPED_CONTENT=$(echo "$HAS_CONTENT" | jq -Rs .)
    # Output the context as hookSpecificOutput so it gets injected into the session
    echo "{\"continue\":true,\"suppressOutput\":false,\"hookSpecificOutput\":{\"hookEventName\":\"SessionStart\",\"additionalContext\":$ESCAPED_CONTENT}}"
    exit 0
  fi
fi

# No context to inject
echo '{"continue":true,"suppressOutput":true}'
exit 0
