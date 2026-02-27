#!/bin/bash
# Post-tool-use hook for dorothy memory system (Gemini CLI)

INPUT=$(cat)

TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')

if [ -z "$TOOL_NAME" ]; then
  echo '{"continue":true,"suppressOutput":true}'
  exit 0
fi

API_URL="http://127.0.0.1:31415/api/memory/remember"

AGENT_ID="${DOROTHY_AGENT_ID:-$SESSION_ID}"
PROJECT_PATH="${DOROTHY_PROJECT_PATH:-$CWD}"

store_observation() {
  local content="$1"
  local type="$2"

  curl -s -X POST "$API_URL" \
    -H "Content-Type: application/json" \
    -d "{\"agent_id\": \"$AGENT_ID\", \"project_path\": \"$PROJECT_PATH\", \"content\": \"$content\", \"type\": \"$type\"}" \
    > /dev/null 2>&1 &
}

case "$TOOL_NAME" in
  "Write")
    FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
    [ -n "$FILE_PATH" ] && store_observation "Created/wrote file: $FILE_PATH" "file_edit"
    ;;
  "Edit")
    FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
    [ -n "$FILE_PATH" ] && store_observation "Edited file: $FILE_PATH" "file_edit"
    ;;
  "Bash"|"Shell")
    COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' | head -c 200)
    [ -n "$COMMAND" ] && store_observation "Ran command: $COMMAND" "command"
    ;;
  *)
    if [[ "$TOOL_NAME" == mcp__* ]]; then
      store_observation "Used MCP tool: $TOOL_NAME" "tool_use"
    fi
    ;;
esac

echo '{"continue":true,"suppressOutput":true}'
exit 0
