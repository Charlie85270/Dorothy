#!/bin/bash
# Stop hook for dorothy
# Sets agent status to "waiting" and captures summary

# Read JSON input from stdin
INPUT=$(cat)

# Extract info
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')
TRANSCRIPT_PATH=$(echo "$INPUT" | jq -r '.transcript_path // empty')
STOP_HOOK_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false')
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')

# Don't process if stop hook is already active (prevents loops)
if [ "$STOP_HOOK_ACTIVE" = "true" ]; then
  echo '{"continue":true,"suppressOutput":true}'
  exit 0
fi

# API endpoint
API_URL="http://127.0.0.1:31415"

# Get agent ID from environment or use session ID
AGENT_ID="${CLAUDE_AGENT_ID:-$SESSION_ID}"
PROJECT_PATH="${CLAUDE_PROJECT_PATH:-$CWD}"

# Check if API is available
if ! curl -s --connect-timeout 1 "$API_URL/api/memory/stats" > /dev/null 2>&1; then
  echo '{"continue":true,"suppressOutput":true}'
  exit 0
fi

# Update agent status to "waiting" (Claude finished responding, waiting for user input)
curl -s -X POST "$API_URL/api/hooks/status" \
  -H "Content-Type: application/json" \
  -d "{\"agent_id\": \"$AGENT_ID\", \"session_id\": \"$SESSION_ID\", \"status\": \"waiting\"}" \
  > /dev/null 2>&1 &

# Try to capture summary from transcript
if [ -n "$TRANSCRIPT_PATH" ] && [ -f "$TRANSCRIPT_PATH" ]; then
  # Extract the last assistant message from transcript (JSONL format)
  LAST_ASSISTANT_MSG=$(tail -100 "$TRANSCRIPT_PATH" 2>/dev/null | \
    grep '"type":"assistant"' | \
    tail -1 | \
    jq -r '.message.content[] | select(.type=="text") | .text // empty' 2>/dev/null | \
    head -c 2000)

  # If we got a message, check if it looks like a summary
  if [ -n "$LAST_ASSISTANT_MSG" ]; then
    if echo "$LAST_ASSISTANT_MSG" | grep -qiE "(summary|completed|changes made|done|finished|created|updated|implemented|fixed|added|removed|refactored)"; then
      # Clean up the message
      CLEAN_MSG=$(echo "$LAST_ASSISTANT_MSG" | tr '\n' ' ' | sed 's/  */ /g' | head -c 1000)

      # Store as a decision/summary
      curl -s -X POST "$API_URL/api/memory/remember" \
        -H "Content-Type: application/json" \
        -d "{\"agent_id\": \"$AGENT_ID\", \"project_path\": \"$PROJECT_PATH\", \"content\": $(echo "$CLEAN_MSG" | jq -Rs .), \"type\": \"decision\"}" \
        > /dev/null 2>&1 &
    fi
  fi
fi

# Output hook response
echo '{"continue":true,"suppressOutput":true}'
exit 0
