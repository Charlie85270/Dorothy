import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const STATUSLINE_SCRIPT = `#!/usr/bin/env bash
# Dev Bar statusline for Claude Code
# Style: ◆ Model │ ctx: NN% ▰▰▰▱▱ (Nk/Nk) │ branch │ NNm │ +N -N │ ↑Nk ↓Nk
# Based on https://github.com/LLRHook/claude-statusline

set -euo pipefail

INPUT=$(cat)

# Autocompact buffer size (tokens). Adjust if Claude Code changes this.
AUTOCOMPACT_BUFFER=33000

# --- Parse fields with jq ---
MODEL=$(echo "$INPUT" | jq -r '.model.display_name // "..."')
RAW_PCT=$(echo "$INPUT" | jq -r '.context_window.used_percentage // 0' | awk '{printf "%d", $1}')
CTX_MAX=$(echo "$INPUT" | jq -r '.context_window.context_window_size // 200000')
CTX_USED=$(awk -v pct="$RAW_PCT" -v max="$CTX_MAX" 'BEGIN {printf "%d", (pct * max) / 100}')
DURATION_MS=$(echo "$INPUT" | jq -r '.cost.total_duration_ms // 0')
LINES_ADDED=$(echo "$INPUT" | jq -r '.cost.total_lines_added // 0')
LINES_REMOVED=$(echo "$INPUT" | jq -r '.cost.total_lines_removed // 0')
INPUT_TOKENS=$(echo "$INPUT" | jq -r '.context_window.total_input_tokens // 0')
OUTPUT_TOKENS=$(echo "$INPUT" | jq -r '.context_window.total_output_tokens // 0')

# Usable space = total - autocompact buffer
CTX_USABLE=$((CTX_MAX - AUTOCOMPACT_BUFFER))
# Percentage relative to usable space (can exceed 100%)
CTX_PCT=$(awk -v used="$CTX_USED" -v usable="$CTX_USABLE" 'BEGIN {printf "%d", (used * 100) / usable}')

# --- Git branch (cached for performance) ---
GIT_CACHE="/tmp/claude-statusline-git-cache"
GIT_CACHE_TTL=5  # seconds
BRANCH="?"
if [ -f "$GIT_CACHE" ]; then
  CACHE_AGE=$(( $(date +%s) - $(stat -f%m "$GIT_CACHE" 2>/dev/null || echo 0) ))
  if [ "$CACHE_AGE" -lt "$GIT_CACHE_TTL" ]; then
    BRANCH=$(cat "$GIT_CACHE")
  fi
fi
if [ "$BRANCH" = "?" ]; then
  BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "?")
  echo "$BRANCH" > "$GIT_CACHE" 2>/dev/null || true
fi

# --- Session duration ---
format_duration() {
  local ms=$1
  local total_sec=$((ms / 1000))
  local hours=$((total_sec / 3600))
  local mins=$(( (total_sec % 3600) / 60 ))
  if [ "$hours" -gt 0 ]; then
    printf "%dh%dm" "$hours" "$mins"
  elif [ "$mins" -gt 0 ]; then
    printf "%dm" "$mins"
  else
    printf "%ds" "$total_sec"
  fi
}
DURATION_FMT=$(format_duration "$DURATION_MS")

# --- Format token counts as human-readable ---
format_tokens() {
  local tokens=$1
  if [ "$tokens" -ge 1000000 ]; then
    echo "$(awk -v t="$tokens" 'BEGIN {printf "%.1f", t/1000000}')M"
  elif [ "$tokens" -ge 1000 ]; then
    echo "$(awk -v t="$tokens" 'BEGIN {printf "%.0f", t/1000}')k"
  else
    echo "$tokens"
  fi
}

CTX_USED_FMT=$(format_tokens "$CTX_USED")
CTX_USABLE_FMT=$(format_tokens "$CTX_USABLE")
IN_FMT=$(format_tokens "$INPUT_TOKENS")
OUT_FMT=$(format_tokens "$OUTPUT_TOKENS")

# --- Colors ---
RESET='\\033[0m'
DIM='\\033[2m'
BOLD='\\033[1m'
GREEN='\\033[32m'
YELLOW='\\033[33m'
RED='\\033[31m'
CYAN='\\033[36m'
MAGENTA='\\033[35m'
WHITE='\\033[37m'
BLUE='\\033[34m'

# Context color based on usage of usable space
if [ "$CTX_PCT" -ge 80 ]; then
  CTX_COLOR="$RED"
elif [ "$CTX_PCT" -ge 50 ]; then
  CTX_COLOR="$YELLOW"
else
  CTX_COLOR="$GREEN"
fi

# Build progress bar (10 segments, capped at 10 filled)
FILLED=$((CTX_PCT / 10))
if [ "$FILLED" -gt 10 ]; then FILLED=10; fi
EMPTY=$((10 - FILLED))
BAR=""
for ((i = 0; i < FILLED; i++)); do BAR+="▰"; done
for ((i = 0; i < EMPTY; i++)); do BAR+="▱"; done

# --- Separator ---
SEP="\${DIM} │ \${RESET}"

# --- Build the line ---
# Model
printf "\${CYAN}\${BOLD}◆\${RESET} \${WHITE}\${BOLD}%s\${RESET}" "$MODEL"
printf "%b" "$SEP"
# Context usage (relative to usable space)
printf "\${CTX_COLOR}ctx: %d%% %s\${RESET} \${DIM}(%s/%s)\${RESET}" "$CTX_PCT" "$BAR" "$CTX_USED_FMT" "$CTX_USABLE_FMT"
printf "%b" "$SEP"
# Git branch
printf "\${MAGENTA}%s\${RESET}" "$BRANCH"
printf "%b" "$SEP"
# Session duration
printf "\${DIM}%s\${RESET}" "$DURATION_FMT"
printf "%b" "$SEP"
# Lines changed
printf "\${GREEN}+%s\${RESET} \${RED}-%s\${RESET}" "$LINES_ADDED" "$LINES_REMOVED"
printf "%b" "$SEP"
# Token throughput (input/output)
printf "\${DIM}↑%s ↓%s\${RESET}" "$IN_FMT" "$OUT_FMT"
printf "\\n"
`;

const SCRIPT_PATH = path.join(os.homedir(), '.dorothy', 'statusline.sh');
const CLAUDE_SETTINGS_PATH = path.join(os.homedir(), '.claude', 'settings.json');

/**
 * Install the statusline script to ~/.dorothy/statusline.sh
 */
function installScript(): void {
  const dir = path.dirname(SCRIPT_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(SCRIPT_PATH, STATUSLINE_SCRIPT, { mode: 0o755 });
}

/**
 * Remove the statusline script from ~/.dorothy/statusline.sh
 */
function removeScript(): void {
  if (fs.existsSync(SCRIPT_PATH)) {
    fs.unlinkSync(SCRIPT_PATH);
  }
}

/**
 * Read Claude Code's settings.json
 */
function readClaudeSettings(): Record<string, unknown> {
  try {
    if (fs.existsSync(CLAUDE_SETTINGS_PATH)) {
      return JSON.parse(fs.readFileSync(CLAUDE_SETTINGS_PATH, 'utf-8'));
    }
  } catch {
    // ignore parse errors
  }
  return {};
}

/**
 * Write Claude Code's settings.json (preserving existing keys)
 */
function writeClaudeSettings(settings: Record<string, unknown>): void {
  const dir = path.dirname(CLAUDE_SETTINGS_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(CLAUDE_SETTINGS_PATH, JSON.stringify(settings, null, 2) + '\n', 'utf-8');
}

/**
 * Enable the statusline: install script + add config to Claude settings.json
 */
export function enableStatusLine(): void {
  installScript();

  const settings = readClaudeSettings();
  settings.statusLine = {
    type: 'command',
    command: SCRIPT_PATH,
    padding: 1,
  };
  writeClaudeSettings(settings);
}

/**
 * Disable the statusline: remove config from Claude settings.json + remove script
 */
export function disableStatusLine(): void {
  const settings = readClaudeSettings();
  delete settings.statusLine;
  writeClaudeSettings(settings);

  removeScript();
}

/**
 * Check if statusline is currently configured in Claude settings.json
 */
export function isStatusLineConfigured(): boolean {
  const settings = readClaudeSettings();
  return settings.statusLine != null;
}
