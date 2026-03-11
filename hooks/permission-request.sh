#!/bin/bash
# PermissionRequest hook for dorothy
# Fires when Claude Code's permission dialog appears — sets agent to "waiting"

# Read JSON input from stdin
INPUT=$(cat)

# Extract info
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')

echo "[$(date)] PERMISSION_REQUEST hook. AGENT_ID=${CLAUDE_AGENT_ID:-unset} SESSION_ID=$SESSION_ID TOOL=$TOOL_NAME" >> /tmp/dorothy-hooks.log

# API endpoint
API_URL="http://127.0.0.1:31415"

# Get agent ID from environment or use session ID
AGENT_ID="${CLAUDE_AGENT_ID:-$SESSION_ID}"

# Check if API is available
if ! curl -s --connect-timeout 1 "$API_URL/api/health" > /dev/null 2>&1; then
  echo '{"continue":true,"suppressOutput":true}'
  exit 0
fi

# Update agent status to "waiting" — permission dialog is blocking
curl -s --max-time 3 -X POST "$API_URL/api/hooks/status" \
  -H "Content-Type: application/json" \
  -d "{\"agent_id\": \"$AGENT_ID\", \"session_id\": \"$SESSION_ID\", \"status\": \"waiting\", \"waiting_reason\": \"permission\"}" \
  > /dev/null 2>&1

echo '{"continue":true,"suppressOutput":true}'
exit 0
