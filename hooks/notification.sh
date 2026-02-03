#!/bin/bash
# Notification hook for claude-manager
# Captures and forwards Claude Code notifications

# Read JSON input from stdin
INPUT=$(cat)

# Extract info
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')
MESSAGE=$(echo "$INPUT" | jq -r '.message // empty')
TITLE=$(echo "$INPUT" | jq -r '.title // empty')
NOTIFICATION_TYPE=$(echo "$INPUT" | jq -r '.notification_type // empty')
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')

# API endpoint
API_URL="http://127.0.0.1:31415"

# Get agent ID from environment or use session ID
AGENT_ID="${CLAUDE_AGENT_ID:-$SESSION_ID}"

# Skip if no notification type
if [ -z "$NOTIFICATION_TYPE" ]; then
  echo '{"continue":true,"suppressOutput":true}'
  exit 0
fi

# Check if API is available
if ! curl -s --connect-timeout 1 "$API_URL/api/memory/stats" > /dev/null 2>&1; then
  echo '{"continue":true,"suppressOutput":true}'
  exit 0
fi

# Forward notification to our API
curl -s -X POST "$API_URL/api/hooks/notification" \
  -H "Content-Type: application/json" \
  -d "{\"agent_id\": \"$AGENT_ID\", \"session_id\": \"$SESSION_ID\", \"type\": \"$NOTIFICATION_TYPE\", \"title\": $(echo "$TITLE" | jq -Rs .), \"message\": $(echo "$MESSAGE" | jq -Rs .)}" \
  > /dev/null 2>&1 &

# If it's a permission prompt, update status to indicate waiting for permission
if [ "$NOTIFICATION_TYPE" = "permission_prompt" ]; then
  curl -s -X POST "$API_URL/api/hooks/status" \
    -H "Content-Type: application/json" \
    -d "{\"agent_id\": \"$AGENT_ID\", \"session_id\": \"$SESSION_ID\", \"status\": \"waiting\", \"waiting_reason\": \"permission\"}" \
    > /dev/null 2>&1 &
fi

# Output hook response
echo '{"continue":true,"suppressOutput":true}'
exit 0
