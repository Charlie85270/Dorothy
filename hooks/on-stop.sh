#!/bin/bash
# Stop hook for dorothy
# Sets agent status to "waiting" and captures clean output from transcript

# Read JSON input from stdin
INPUT=$(cat)

# Extract info
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')
TRANSCRIPT_PATH=$(echo "$INPUT" | jq -r '.transcript_path // empty')
STOP_HOOK_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false')
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')

echo "[$(date)] STOP hook. AGENT_ID=${CLAUDE_AGENT_ID:-unset} SESSION_ID=$SESSION_ID STOP_ACTIVE=$STOP_HOOK_ACTIVE" >> /tmp/dorothy-hooks.log

# Don't process if stop hook is already active (prevents loops)
if [ "$STOP_HOOK_ACTIVE" = "true" ]; then
  echo '{"continue":true,"suppressOutput":true}'
  exit 0
fi

# API endpoint
API_URL="http://127.0.0.1:31415"

# Get agent ID from environment or use session ID
AGENT_ID="${CLAUDE_AGENT_ID:-$SESSION_ID}"

# Check if API is available
if ! curl -s --connect-timeout 1 "$API_URL/api/health" > /dev/null 2>&1; then
  echo '{"continue":true,"suppressOutput":true}'
  exit 0
fi

# Update agent status to "idle" (Claude finished responding, ready for next prompt)
# "waiting" is reserved for permission prompts / idle prompts that need immediate attention
RESULT=$(curl -s --max-time 3 -X POST "$API_URL/api/hooks/status" \
  -H "Content-Type: application/json" \
  -d "{\"agent_id\": \"$AGENT_ID\", \"session_id\": \"$SESSION_ID\", \"status\": \"idle\"}" 2>&1)
echo "[$(date)] STOP curl result: $RESULT" >> /tmp/dorothy-hooks.log

# Send notification that agent finished a response (respects user settings)
curl -s --max-time 3 -X POST "$API_URL/api/hooks/agent-stopped" \
  -H "Content-Type: application/json" \
  -d "{\"agent_id\": \"$AGENT_ID\", \"session_id\": \"$SESSION_ID\"}" \
  > /dev/null 2>&1

# Capture clean output from transcript for MCP tools
if [ -n "$TRANSCRIPT_PATH" ] && [ -f "$TRANSCRIPT_PATH" ]; then
  # Extract the last assistant message from transcript (JSONL format)
  LAST_ASSISTANT_MSG=$(tail -100 "$TRANSCRIPT_PATH" 2>/dev/null | \
    grep '"type":"assistant"' | \
    tail -1 | \
    jq -r '.message.content[] | select(.type=="text") | .text // empty' 2>/dev/null | \
    head -c 4000)

  if [ -n "$LAST_ASSISTANT_MSG" ]; then
    curl -s --max-time 3 -X POST "$API_URL/api/hooks/output" \
      -H "Content-Type: application/json" \
      -d "{\"agent_id\": \"$AGENT_ID\", \"session_id\": \"$SESSION_ID\", \"output\": $(echo "$LAST_ASSISTANT_MSG" | jq -Rs .)}" \
      > /dev/null 2>&1
  fi
fi

# Output hook response
echo '{"continue":true,"suppressOutput":true}'
exit 0
