#!/bin/bash
# Stop hook for dorothy (Gemini CLI)
# Sets agent status to "waiting"

INPUT=$(cat)

SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')
STOP_HOOK_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false')

if [ "$STOP_HOOK_ACTIVE" = "true" ]; then
  echo '{"continue":true,"suppressOutput":true}'
  exit 0
fi

API_URL="http://127.0.0.1:31415"

AGENT_ID="${DOROTHY_AGENT_ID:-$SESSION_ID}"

if ! curl -s --connect-timeout 1 "$API_URL/api/memory/stats" > /dev/null 2>&1; then
  echo '{"continue":true,"suppressOutput":true}'
  exit 0
fi

curl -s -X POST "$API_URL/api/hooks/status" \
  -H "Content-Type: application/json" \
  -d "{\"agent_id\": \"$AGENT_ID\", \"session_id\": \"$SESSION_ID\", \"status\": \"waiting\"}" \
  > /dev/null 2>&1 &

echo '{"continue":true,"suppressOutput":true}'
exit 0
