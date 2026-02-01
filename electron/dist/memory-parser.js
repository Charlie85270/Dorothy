"use strict";
/**
 * Memory Parser for Agent Output
 *
 * Extracts observations from Claude Code terminal output using pattern matching.
 * Identifies tool uses, file edits, commands, decisions, and other meaningful events.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderTerminalOutput = renderTerminalOutput;
exports.parseOutputChunk = parseOutputChunk;
exports.parseAccumulatedOutput = parseAccumulatedOutput;
exports.isSignificantObservation = isSignificantObservation;
exports.filterSignificantObservations = filterSignificantObservations;
exports.summarizeObservations = summarizeObservations;
// ============== Terminal Buffer Simulator ==============
/**
 * Simulates a terminal buffer to reconstruct rendered text from raw terminal output
 * This handles cursor movements, overwrites, and other terminal sequences
 */
class TerminalBuffer {
    lines = [''];
    cursorRow = 0;
    cursorCol = 0;
    maxLines = 1000;
    /**
     * Process raw terminal output and return the rendered text
     */
    process(input) {
        let i = 0;
        while (i < input.length) {
            const char = input[i];
            // Check for escape sequence
            if (char === '\x1b' && input[i + 1] === '[') {
                const seqEnd = this.findSequenceEnd(input, i + 2);
                if (seqEnd > i + 2) {
                    this.handleEscapeSequence(input.substring(i + 2, seqEnd));
                    i = seqEnd;
                    continue;
                }
            }
            // Check for bracket sequences without ESC (sometimes terminals send these)
            if (char === '[' && i + 1 < input.length) {
                const match = input.substring(i).match(/^\[(\d*)(;(\d+))?([A-Za-z])/);
                if (match) {
                    this.handleEscapeSequence(match[0].substring(1));
                    i += match[0].length;
                    continue;
                }
            }
            // Handle control characters
            if (char === '\r') {
                this.cursorCol = 0;
                i++;
                continue;
            }
            if (char === '\n') {
                this.cursorRow++;
                if (this.cursorRow >= this.lines.length) {
                    this.lines.push('');
                }
                if (this.lines.length > this.maxLines) {
                    this.lines.shift();
                    this.cursorRow = Math.max(0, this.cursorRow - 1);
                }
                i++;
                continue;
            }
            if (char === '\t') {
                const spaces = 8 - (this.cursorCol % 8);
                for (let s = 0; s < spaces; s++) {
                    this.writeChar(' ');
                }
                i++;
                continue;
            }
            if (char === '\b') {
                this.cursorCol = Math.max(0, this.cursorCol - 1);
                i++;
                continue;
            }
            // Skip other control characters
            if (char.charCodeAt(0) < 32 && char !== '\n' && char !== '\r' && char !== '\t') {
                i++;
                continue;
            }
            // Write printable character
            this.writeChar(char);
            i++;
        }
        return this.getContent();
    }
    findSequenceEnd(input, start) {
        for (let i = start; i < input.length && i < start + 20; i++) {
            const c = input[i];
            if ((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z')) {
                return i + 1;
            }
        }
        return start;
    }
    handleEscapeSequence(seq) {
        // Parse the sequence: numbers followed by a letter
        const match = seq.match(/^(\d*)(;(\d+))?([A-Za-z])$/);
        if (!match)
            return;
        const n = parseInt(match[1] || '1', 10) || 1;
        const m = parseInt(match[3] || '1', 10) || 1;
        const cmd = match[4];
        switch (cmd) {
            case 'A': // Cursor up
                this.cursorRow = Math.max(0, this.cursorRow - n);
                break;
            case 'B': // Cursor down
                this.cursorRow += n;
                while (this.cursorRow >= this.lines.length) {
                    this.lines.push('');
                }
                break;
            case 'C': // Cursor forward
                this.cursorCol += n;
                break;
            case 'D': // Cursor back
                this.cursorCol = Math.max(0, this.cursorCol - n);
                break;
            case 'H': // Cursor position (row;col)
            case 'f':
                this.cursorRow = Math.max(0, n - 1);
                this.cursorCol = Math.max(0, m - 1);
                while (this.cursorRow >= this.lines.length) {
                    this.lines.push('');
                }
                break;
            case 'J': // Clear screen
                if (n === 2) {
                    this.lines = [''];
                    this.cursorRow = 0;
                    this.cursorCol = 0;
                }
                break;
            case 'K': // Clear line
                if (this.lines[this.cursorRow]) {
                    this.lines[this.cursorRow] = this.lines[this.cursorRow].substring(0, this.cursorCol);
                }
                break;
            case 'm': // SGR (colors/styles) - ignore
                break;
            case 'G': // Cursor horizontal absolute
                this.cursorCol = Math.max(0, n - 1);
                break;
            case 'E': // Cursor next line
                this.cursorRow += n;
                this.cursorCol = 0;
                while (this.cursorRow >= this.lines.length) {
                    this.lines.push('');
                }
                break;
            case 'F': // Cursor previous line
                this.cursorRow = Math.max(0, this.cursorRow - n);
                this.cursorCol = 0;
                break;
            // Ignore other sequences
        }
    }
    writeChar(char) {
        // Ensure we have enough lines
        while (this.cursorRow >= this.lines.length) {
            this.lines.push('');
        }
        // Ensure line is long enough
        const line = this.lines[this.cursorRow];
        if (this.cursorCol > line.length) {
            this.lines[this.cursorRow] = line + ' '.repeat(this.cursorCol - line.length) + char;
        }
        else {
            this.lines[this.cursorRow] =
                line.substring(0, this.cursorCol) + char + line.substring(this.cursorCol + 1);
        }
        this.cursorCol++;
    }
    getContent() {
        return this.lines
            .map(line => line.trimEnd())
            .join('\n')
            .trim();
    }
    reset() {
        this.lines = [''];
        this.cursorRow = 0;
        this.cursorCol = 0;
    }
}
// Global buffer for accumulating output
const terminalBuffer = new TerminalBuffer();
// ============== Patterns ==============
/**
 * Tool use patterns from Claude Code output
 */
const TOOL_PATTERNS = {
    // File operations
    file_read: /(?:Reading|Read) (?:file:?\s*)?['"]?([^'">\n]+)['"]?/i,
    file_edit: /(?:Edited|Editing|Edit(?:ing)?|Updated|Updating)\s+['"]?([^'">\n]+)['"]?/i,
    file_write: /(?:Wrote|Writing|Created|Creating)\s+(?:to\s+)?['"]?([^'">\n]+)['"]?/i,
    file_delete: /(?:Deleted|Deleting|Removed|Removing)\s+['"]?([^'">\n]+)['"]?/i,
    // Search operations
    search: /(?:Searching|Searched|Search(?:ing)?)\s+(?:for:?\s*)?['"]?([^'">\n]+)['"]?/i,
    grep: /(?:Grep(?:ping)?|Grep result)\s*:?\s*['"]?([^'">\n]+)['"]?/i,
    glob: /(?:Glob(?:bing)?|Finding files)\s*:?\s*['"]?([^'">\n]+)['"]?/i,
    // Bash/command operations
    bash_command: /(?:Running|Run|Executing|Exec)\s*:?\s*['"`]([^'"`\n]+)['"`]/i,
    bash_output: /^\$\s*(.+)$/m,
    // Web/API operations
    web_fetch: /(?:Fetching|Fetch(?:ed)?)\s+(?:URL:?\s*)?['"]?(https?:\/\/[^\s'"]+)['"]?/i,
    web_search: /(?:Web search|Searching web)\s*(?:for)?:?\s*['"]?([^'">\n]+)['"]?/i,
};
/**
 * Decision-making patterns (when Claude expresses intent)
 */
const DECISION_PATTERNS = [
    /I'll\s+(.{10,100})/i,
    /I will\s+(.{10,100})/i,
    /I should\s+(.{10,100})/i,
    /I need to\s+(.{10,100})/i,
    /Let me\s+(.{10,100})/i,
    /I'm going to\s+(.{10,100})/i,
    /I think (?:we should|I should)\s+(.{10,100})/i,
    /The best approach (?:is|would be)\s+(.{10,100})/i,
    /We should\s+(.{10,100})/i,
    /The solution is to\s+(.{10,100})/i,
];
/**
 * Message patterns (important communications)
 */
const MESSAGE_PATTERNS = {
    error: /(?:Error|ERROR|Failed|FAILED|Exception):\s*(.+)/i,
    success: /(?:Successfully|Completed|Done|Finished)\s+(.+)/i,
    warning: /(?:Warning|WARN|Caution):\s*(.+)/i,
    task_complete: /(?:Task completed|I've finished|All done|Complete!)/i,
};
// ============== Parsing Functions ==============
/**
 * Clean ANSI escape codes from terminal output using the terminal buffer simulator
 */
function stripAnsi(str) {
    // Use terminal buffer to properly render the output
    const buffer = new TerminalBuffer();
    const rendered = buffer.process(str);
    // Additional cleanup
    return rendered
        // Remove any remaining escape sequences that slipped through
        .replace(/\x1b\[[0-9;]*[A-Za-z]/g, '')
        .replace(/\[\d*[ABCDEFGHJKSTfmnsulh]/g, '')
        // Clean up multiple spaces and blank lines
        .replace(/  +/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}
/**
 * Process accumulated output chunks through terminal buffer for clean text
 */
function renderTerminalOutput(chunks) {
    const buffer = new TerminalBuffer();
    return buffer.process(chunks.join(''));
}
/**
 * Check if text looks like clean readable content (not garbled)
 */
function isCleanText(text) {
    // Reject if still has control sequence remnants
    if (/\[\d+[A-Z]/i.test(text))
        return false;
    // Reject if too fragmented (single chars separated by spaces like "a b c d e")
    if (/^(\S\s){5,}/.test(text))
        return false;
    // Reject if has too many special characters in sequence
    if (/[^\w\s]{5,}/.test(text))
        return false;
    // Reject if mostly non-alphanumeric
    const alphaNum = text.replace(/[^a-zA-Z0-9]/g, '').length;
    const total = text.replace(/\s/g, '').length;
    if (total > 0 && alphaNum < total * 0.4)
        return false;
    return true;
}
/**
 * Extract file path from a match, cleaning up common artifacts
 */
function cleanFilePath(rawPath) {
    return rawPath
        .trim()
        .replace(/^['"`]+|['"`]+$/g, '') // Remove quotes
        .replace(/\.\.\.+$/, '') // Remove trailing ellipsis
        .replace(/\s+$/, ''); // Trim trailing whitespace
}
/**
 * Parse a single output chunk for observations
 */
function parseOutputChunk(output) {
    const observations = [];
    const cleanOutput = stripAnsi(output);
    // Check for tool use patterns
    for (const [toolType, pattern] of Object.entries(TOOL_PATTERNS)) {
        const matches = cleanOutput.match(pattern);
        if (matches && matches[1]) {
            const content = matches[1].trim();
            // Determine observation type based on tool type
            let obsType = 'tool_use';
            if (toolType.startsWith('file_edit') || toolType.startsWith('file_write')) {
                obsType = 'file_edit';
            }
            else if (toolType.startsWith('bash') || toolType === 'bash_command') {
                obsType = 'command';
            }
            observations.push({
                type: obsType,
                content: `${toolType}: ${cleanFilePath(content)}`,
                metadata: { tool: toolType, target: cleanFilePath(content) },
            });
        }
    }
    // Check for decision patterns
    for (const pattern of DECISION_PATTERNS) {
        const matches = cleanOutput.match(pattern);
        if (matches && matches[1]) {
            const decision = matches[1].trim();
            // Only capture meaningful decisions (not just fragments)
            if (decision.length > 15 && !decision.includes('...')) {
                observations.push({
                    type: 'decision',
                    content: decision,
                    metadata: { pattern: pattern.source.slice(0, 30) },
                });
                break; // Only capture one decision per chunk to avoid duplicates
            }
        }
    }
    // Check for message patterns
    for (const [msgType, pattern] of Object.entries(MESSAGE_PATTERNS)) {
        const matches = cleanOutput.match(pattern);
        if (matches) {
            const content = matches[1] || matches[0];
            observations.push({
                type: 'message',
                content: `${msgType}: ${content.trim()}`,
                metadata: { messageType: msgType },
            });
        }
    }
    return observations;
}
/**
 * Parse accumulated output (multiple chunks) for observations
 * This is more thorough and handles multi-line patterns
 */
function parseAccumulatedOutput(outputChunks) {
    const fullOutput = stripAnsi(outputChunks.join(''));
    const observations = [];
    const seenContent = new Set();
    // Split into logical segments (by newlines and common delimiters)
    const segments = fullOutput.split(/\n+/).filter(s => s.trim().length > 0);
    for (const segment of segments) {
        const segmentObs = parseOutputChunk(segment);
        for (const obs of segmentObs) {
            // Deduplicate by content
            const key = `${obs.type}:${obs.content}`;
            if (!seenContent.has(key)) {
                seenContent.add(key);
                observations.push(obs);
            }
        }
    }
    // Also look for multi-line patterns in full output
    // Git commits
    const gitCommitMatch = fullOutput.match(/\[[\w-]+\s+([a-f0-9]+)\]\s+(.+)/);
    if (gitCommitMatch) {
        const key = `command:git commit ${gitCommitMatch[1]}`;
        if (!seenContent.has(key)) {
            seenContent.add(key);
            observations.push({
                type: 'command',
                content: `git commit ${gitCommitMatch[1]}: ${gitCommitMatch[2]}`,
                metadata: { tool: 'git', commitHash: gitCommitMatch[1], message: gitCommitMatch[2] },
            });
        }
    }
    // npm/pnpm install
    const npmInstallMatch = fullOutput.match(/(?:npm|pnpm|yarn)\s+(?:install|add)\s+([^\n]+)/i);
    if (npmInstallMatch) {
        const key = `command:npm install ${npmInstallMatch[1]}`;
        if (!seenContent.has(key)) {
            seenContent.add(key);
            observations.push({
                type: 'command',
                content: `package install: ${npmInstallMatch[1]}`,
                metadata: { tool: 'npm', packages: npmInstallMatch[1] },
            });
        }
    }
    // Test results
    const testMatch = fullOutput.match(/(\d+)\s+(?:tests?\s+)?(?:passed|passing)[,\s]+(\d+)\s+(?:tests?\s+)?(?:failed|failing)/i);
    if (testMatch) {
        const key = `message:tests ${testMatch[1]} passed, ${testMatch[2]} failed`;
        if (!seenContent.has(key)) {
            seenContent.add(key);
            observations.push({
                type: 'message',
                content: `test results: ${testMatch[1]} passed, ${testMatch[2]} failed`,
                metadata: { tool: 'test', passed: parseInt(testMatch[1]), failed: parseInt(testMatch[2]) },
            });
        }
    }
    return observations;
}
/**
 * Determine if an observation is significant enough to store
 * Filters out noise and trivial observations
 */
function isSignificantObservation(obs) {
    // Filter out very short content
    if (obs.content.length < 10) {
        return false;
    }
    // Filter out garbled/corrupted text from terminal rendering
    if (!isCleanText(obs.content)) {
        return false;
    }
    // Filter out common noise patterns
    const noisePatterns = [
        /^file_read:/i, // Reading files is common and not usually significant by itself
        /^\.\.\./,
        /^[\s\-_]+$/,
        /loading/i,
        /spinner/i,
    ];
    for (const pattern of noisePatterns) {
        if (pattern.test(obs.content)) {
            return false;
        }
    }
    // Decisions and file edits are always significant
    if (obs.type === 'decision' || obs.type === 'file_edit') {
        return true;
    }
    // Commands are significant if they're meaningful
    if (obs.type === 'command') {
        const content = obs.content.toLowerCase();
        // Skip trivial commands
        if (content.includes('ls') || content.includes('cd ') || content.includes('pwd')) {
            return false;
        }
        return true;
    }
    // Messages are significant if they're errors or successes
    if (obs.type === 'message') {
        const meta = obs.metadata;
        if (meta?.messageType === 'error' || meta?.messageType === 'success') {
            return true;
        }
    }
    return true;
}
/**
 * Batch filter observations for significance
 */
function filterSignificantObservations(observations) {
    return observations.filter(isSignificantObservation);
}
/**
 * Get a summary of observations (for quick reference)
 */
function summarizeObservations(observations) {
    const grouped = {
        file_edit: [],
        command: [],
        decision: [],
        message: [],
        tool_use: [],
    };
    for (const obs of observations) {
        grouped[obs.type].push(obs.content);
    }
    const parts = [];
    if (grouped.file_edit.length > 0) {
        parts.push(`Files edited: ${grouped.file_edit.length}`);
    }
    if (grouped.command.length > 0) {
        parts.push(`Commands run: ${grouped.command.length}`);
    }
    if (grouped.decision.length > 0) {
        parts.push(`Decisions made: ${grouped.decision.length}`);
    }
    return parts.join(', ') || 'No significant observations';
}
//# sourceMappingURL=memory-parser.js.map