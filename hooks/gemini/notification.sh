#!/bin/bash
# Notification hook for dorothy (Gemini CLI)

INPUT=$(cat)

SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')
MESSAGE=$(echo "$INPUT" | jq -r '.message // empty')
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')

API_URL="http://127.0.0.1:31415"

AGENT_ID="${DOROTHY_AGENT_ID:-$SESSION_ID}"
PROJECT_PATH="${DOROTHY_PROJECT_PATH:-$CWD}"

if ! curl -s --connect-timeout 1 "$API_URL/api/memory/stats" > /dev/null 2>&1; then
  echo '{"continue":true,"suppressOutput":true}'
  exit 0
fi

# Forward notification to dorothy
if [ -n "$MESSAGE" ]; then
  SAFE_MSG=$(echo "$MESSAGE" | jq -Rs .)
  curl -s -X POST "$API_URL/api/hooks/notification" \
    -H "Content-Type: application/json" \
    -d "{\"agent_id\": \"$AGENT_ID\", \"session_id\": \"$SESSION_ID\", \"message\": $SAFE_MSG, \"project_path\": \"$PROJECT_PATH\"}" \
    > /dev/null 2>&1 &
fi

echo '{"continue":true,"suppressOutput":true}'
exit 0
