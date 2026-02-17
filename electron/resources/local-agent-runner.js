#!/usr/bin/env node
/**
 * Local Agent Runner — Dorothy
 *
 * Standalone Node.js script (no npm dependencies) that provides an interactive
 * chat REPL against Tasmania's OpenAI-compatible /v1/chat/completions endpoint.
 *
 * Spawned in a PTY exactly like the `claude` CLI so the existing xterm.js
 * infrastructure captures all output.
 *
 * Usage:
 *   node local-agent-runner.js --endpoint http://127.0.0.1:8080/v1 \
 *       --model my-model --project /path/to/project --prompt 'initial task'
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// ── ANSI helpers ──────────────────────────────────────────────────────────

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const MAGENTA = '\x1b[35m';

function colorize(color, text) {
  return `${color}${text}${RESET}`;
}

// ── Arg parsing ───────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { endpoint: '', model: '', project: '', prompt: '' };
  for (let i = 2; i < argv.length; i++) {
    switch (argv[i]) {
      case '--endpoint': args.endpoint = argv[++i] || ''; break;
      case '--model':    args.model = argv[++i] || '';    break;
      case '--project':  args.project = argv[++i] || '';  break;
      case '--prompt':   args.prompt = argv[++i] || '';   break;
    }
  }
  return args;
}

// ── Project context ───────────────────────────────────────────────────────

function buildSystemPrompt(projectPath) {
  const parts = [
    'You are a helpful AI assistant running locally via Tasmania.',
    'You are part of Dorothy, an agent management platform.',
    'Provide clear, concise answers. When discussing code, be specific about file paths and line numbers.',
  ];

  if (projectPath) {
    parts.push(`\nThe user is working in the project at: ${projectPath}`);

    // Try reading CLAUDE.md
    const claudeMd = path.join(projectPath, 'CLAUDE.md');
    try {
      if (fs.existsSync(claudeMd)) {
        const content = fs.readFileSync(claudeMd, 'utf-8').slice(0, 4000);
        parts.push(`\nProject instructions (CLAUDE.md):\n${content}`);
      }
    } catch { /* ignore */ }

    // Try reading README.md
    const readmeMd = path.join(projectPath, 'README.md');
    try {
      if (fs.existsSync(readmeMd)) {
        const content = fs.readFileSync(readmeMd, 'utf-8').slice(0, 3000);
        parts.push(`\nProject README:\n${content}`);
      }
    } catch { /* ignore */ }
  }

  return parts.join('\n');
}

// ── SSE streaming request ─────────────────────────────────────────────────

function streamChatCompletion(endpoint, model, messages) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${endpoint}/chat/completions`);
    const isHttps = url.protocol === 'https:';
    const transport = isHttps ? https : http;

    const body = JSON.stringify({
      model: model || 'default',
      messages,
      stream: true,
      temperature: 0.7,
    });

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = transport.request(options, (res) => {
      if (res.statusCode !== 200) {
        let errBody = '';
        res.on('data', (chunk) => { errBody += chunk; });
        res.on('end', () => {
          reject(new Error(`HTTP ${res.statusCode}: ${errBody.slice(0, 300)}`));
        });
        return;
      }

      let fullContent = '';
      let buffer = '';

      res.setEncoding('utf-8');
      res.on('data', (chunk) => {
        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // keep incomplete line in buffer

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const data = trimmed.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta;
            if (delta?.content) {
              process.stdout.write(delta.content);
              fullContent += delta.content;
            }
          } catch {
            // Skip malformed JSON chunks
          }
        }
      });

      res.on('end', () => {
        // Process remaining buffer
        if (buffer.trim()) {
          const trimmed = buffer.trim();
          if (trimmed.startsWith('data: ') && trimmed.slice(6) !== '[DONE]') {
            try {
              const parsed = JSON.parse(trimmed.slice(6));
              const delta = parsed.choices?.[0]?.delta;
              if (delta?.content) {
                process.stdout.write(delta.content);
                fullContent += delta.content;
              }
            } catch { /* ignore */ }
          }
        }
        resolve(fullContent);
      });

      res.on('error', reject);
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Non-streaming fallback ────────────────────────────────────────────────

function chatCompletion(endpoint, model, messages) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${endpoint}/chat/completions`);
    const isHttps = url.protocol === 'https:';
    const transport = isHttps ? https : http;

    const body = JSON.stringify({
      model: model || 'default',
      messages,
      stream: false,
      temperature: 0.7,
    });

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = transport.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 300)}`));
          return;
        }
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.message?.content || '';
          process.stdout.write(content);
          resolve(content);
        } catch (err) {
          reject(new Error(`Failed to parse response: ${err.message}`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv);

  if (!args.endpoint) {
    console.error(colorize(RED, 'Error: --endpoint is required'));
    process.exit(1);
  }

  // Banner
  console.log('');
  console.log(colorize(CYAN + BOLD, '  Dorothy Local Agent'));
  console.log(colorize(DIM, `  Model: ${args.model || 'default'}`));
  console.log(colorize(DIM, `  Endpoint: ${args.endpoint}`));
  if (args.project) {
    console.log(colorize(DIM, `  Project: ${args.project}`));
  }
  console.log(colorize(DIM, '  Type /exit to quit, /clear to reset conversation'));
  console.log('');

  // Build system prompt with project context
  const systemPrompt = buildSystemPrompt(args.project);
  const messages = [{ role: 'system', content: systemPrompt }];

  // Process initial prompt if provided
  if (args.prompt) {
    console.log(colorize(GREEN + BOLD, '> ') + colorize(DIM, args.prompt));
    console.log('');

    messages.push({ role: 'user', content: args.prompt });

    try {
      const response = await streamChatCompletion(args.endpoint, args.model, messages).catch(async (streamErr) => {
        // Fallback to non-streaming if streaming fails
        console.error(colorize(YELLOW, '\n(Streaming not supported, falling back to standard request...)'));
        return chatCompletion(args.endpoint, args.model, messages);
      });
      messages.push({ role: 'assistant', content: response });
      console.log('\n');
    } catch (err) {
      console.error(colorize(RED, `\nError: ${err.message}`));
      console.log('');
    }
  }

  // Interactive REPL
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: colorize(GREEN + BOLD, '> '),
    terminal: true,
  });

  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();

    if (!input) {
      rl.prompt();
      return;
    }

    // Handle commands
    if (input === '/exit' || input === '/quit') {
      console.log(colorize(DIM, '\nGoodbye!'));
      process.exit(0);
    }

    if (input === '/clear') {
      // Keep system prompt, clear conversation history
      messages.length = 1;
      console.log(colorize(MAGENTA, '\nConversation cleared.\n'));
      rl.prompt();
      return;
    }

    if (input === '/help') {
      console.log('');
      console.log(colorize(CYAN, '  Commands:'));
      console.log(colorize(DIM, '    /exit    - Exit the agent'));
      console.log(colorize(DIM, '    /clear   - Clear conversation history'));
      console.log(colorize(DIM, '    /help    - Show this help'));
      console.log('');
      rl.prompt();
      return;
    }

    // Send message to LLM
    messages.push({ role: 'user', content: input });
    console.log('');

    try {
      const response = await streamChatCompletion(args.endpoint, args.model, messages).catch(async () => {
        return chatCompletion(args.endpoint, args.model, messages);
      });
      messages.push({ role: 'assistant', content: response });
      console.log('\n');
    } catch (err) {
      console.error(colorize(RED, `\nError: ${err.message}`));
      // Remove the failed user message to keep conversation consistent
      messages.pop();
      console.log('');
    }

    rl.prompt();
  });

  rl.on('close', () => {
    console.log(colorize(DIM, '\nGoodbye!'));
    process.exit(0);
  });

  // Handle Ctrl+C gracefully
  process.on('SIGINT', () => {
    console.log(colorize(DIM, '\nGoodbye!'));
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(colorize(RED, `Fatal error: ${err.message}`));
  process.exit(1);
});
