#!/bin/bash
# Notification hook for dorothy
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

echo "[$(date)] NOTIFICATION hook. AGENT_ID=${CLAUDE_AGENT_ID:-unset} TYPE=$NOTIFICATION_TYPE" >> /tmp/dorothy-hooks.log

# Skip if no notification type
if [ -z "$NOTIFICATION_TYPE" ]; then
  echo '{"continue":true,"suppressOutput":true}'
  exit 0
fi

# Check if API is available
if ! curl -s --connect-timeout 1 "$API_URL/api/health" > /dev/null 2>&1; then
  echo '{"continue":true,"suppressOutput":true}'
  exit 0
fi

# Forward notification to our API
curl -s --max-time 3 -X POST "$API_URL/api/hooks/notification" \
  -H "Content-Type: application/json" \
  -d "{\"agent_id\": \"$AGENT_ID\", \"session_id\": \"$SESSION_ID\", \"type\": \"$NOTIFICATION_TYPE\", \"title\": $(echo "$TITLE" | jq -Rs .), \"message\": $(echo "$MESSAGE" | jq -Rs .)}" \
  > /dev/null 2>&1

# Permission prompts are handled by the dedicated PermissionRequest hook.
# Idle prompts still set waiting here since there's no dedicated hook for them.
if [ "$NOTIFICATION_TYPE" = "idle_prompt" ]; then
  curl -s --max-time 3 -X POST "$API_URL/api/hooks/status" \
    -H "Content-Type: application/json" \
    -d "{\"agent_id\": \"$AGENT_ID\", \"session_id\": \"$SESSION_ID\", \"status\": \"waiting\", \"waiting_reason\": \"idle\"}" \
    > /dev/null 2>&1
fi

# Output hook response
echo '{"continue":true,"suppressOutput":true}'
exit 0
