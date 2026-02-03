# Remember Skill

You have access to a persistent memory system that allows you to store and recall information across sessions.

## How to Save Memories

Use bash to call the memory API. The API runs on `http://127.0.0.1:31415`.

### Store a memory:
```bash
curl -s -X POST http://127.0.0.1:31415/api/memory/remember \
  -H "Content-Type: application/json" \
  -d '{"agent_id": "YOUR_AGENT_ID", "content": "What you want to remember", "type": "TYPE"}'
```

**Types:**
- `preference` - User preferences (name, coding style, etc.)
- `learning` - Something you learned about the codebase
- `decision` - An important decision that was made
- `context` - Background information about the project

### Search memories:
```bash
curl -s "http://127.0.0.1:31415/api/memory/search?q=SEARCH_TERM"
```

### Get memory stats:
```bash
curl -s http://127.0.0.1:31415/api/memory/stats
```

## When to Use Memory

**ALWAYS save memories when:**
- User tells you their name or preferences
- You learn something important about the codebase architecture
- An important decision is made about implementation approach
- User corrects you or provides context you should remember

**Example - User says "My name is Charlie":**
```bash
curl -s -X POST http://127.0.0.1:31415/api/memory/remember \
  -H "Content-Type: application/json" \
  -d '{"agent_id": "{{AGENT_ID}}", "content": "User name is Charlie", "type": "preference"}'
```

**Example - You discover project uses a specific pattern:**
```bash
curl -s -X POST http://127.0.0.1:31415/api/memory/remember \
  -H "Content-Type: application/json" \
  -d '{"agent_id": "{{AGENT_ID}}", "content": "Project uses repository pattern for data access", "type": "learning"}'
```

## Important

- Replace `{{AGENT_ID}}` with your actual agent ID
- Keep memory content concise but informative
- Search memories at the start of sessions to recall context
- The memory persists across restarts and sessions
