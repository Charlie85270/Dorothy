#!/bin/bash
# UserPromptSubmit hook for dorothy (Gemini CLI)
# Sets agent status back to "running" when user submits a new prompt mid-session

INPUT=$(cat)

SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')

API_URL="http://127.0.0.1:31415"

AGENT_ID="${DOROTHY_AGENT_ID:-$SESSION_ID}"

echo "[$(date)] GEMINI USER_PROMPT_SUBMIT hook. AGENT_ID=${DOROTHY_AGENT_ID:-unset} SESSION_ID=$SESSION_ID" >> /tmp/dorothy-hooks.log

if ! curl -s --connect-timeout 1 "$API_URL/api/health" > /dev/null 2>&1; then
  echo '{"continue":true,"suppressOutput":true}'
  exit 0
fi

curl -s --max-time 3 -X POST "$API_URL/api/hooks/status" \
  -H "Content-Type: application/json" \
  -d "{\"agent_id\": \"$AGENT_ID\", \"session_id\": \"$SESSION_ID\", \"status\": \"running\"}" \
  > /dev/null 2>&1

echo '{"continue":true,"suppressOutput":true}'
exit 0
