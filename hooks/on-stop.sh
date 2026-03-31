#!/bin/bash
LOG="/tmp/dorothy-hooks-debug.log"
INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')
STOP_HOOK_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false')
if [ "$STOP_HOOK_ACTIVE" = "true" ]; then
  echo '{"continue":true,"suppressOutput":true}'
  exit 0
fi
API_URL="http://127.0.0.1:31415"
AGENT_ID="${CLAUDE_AGENT_ID:-$SESSION_ID}"
echo "========================================" >> "$LOG"
echo "[$(date)] STOP hook — AGENT=$AGENT_ID" >> "$LOG"
LAST_MSG=$(echo "$INPUT" | jq -r '.last_assistant_message // empty')
echo "  last_assistant_message length: ${#LAST_MSG}" >> "$LOG"
if [ -z "$LAST_MSG" ]; then
  TRANSCRIPT_PATH=$(echo "$INPUT" | jq -r '.transcript_path // empty')
  if [ -n "$TRANSCRIPT_PATH" ] && [ -f "$TRANSCRIPT_PATH" ]; then
    LAST_MSG=$(tac "$TRANSCRIPT_PATH" 2>/dev/null | while IFS= read -r line; do
      msg=$(echo "$line" | jq -r 'select(.type=="assistant") | .message.content[] | select(.type=="text") | .text // empty' 2>/dev/null)
      if [ -n "$msg" ]; then echo "$msg"; break; fi
    done | head -c 4000)
  fi
fi
if [ -n "$LAST_MSG" ]; then
  TRIMMED=$(echo "$LAST_MSG" | head -c 4000)
  curl -s --max-time 3 -X POST "$API_URL/api/hooks/output" -H "Content-Type: application/json" -d "{\"agent_id\": \"$AGENT_ID\", \"session_id\": \"$SESSION_ID\", \"output\": $(echo "$TRIMMED" | jq -Rs .)}" >> "$LOG" 2>&1
  echo "  Output sent (${#TRIMMED} chars)" >> "$LOG"
fi
curl -s --max-time 3 -X POST "$API_URL/api/hooks/status" -H "Content-Type: application/json" -d "{\"agent_id\": \"$AGENT_ID\", \"session_id\": \"$SESSION_ID\", \"status\": \"idle\"}" > /dev/null 2>&1
curl -s --max-time 3 -X POST "$API_URL/api/hooks/agent-stopped" -H "Content-Type: application/json" -d "{\"agent_id\": \"$AGENT_ID\", \"session_id\": \"$SESSION_ID\"}" > /dev/null 2>&1
echo '{"continue":true,"suppressOutput":true}'
