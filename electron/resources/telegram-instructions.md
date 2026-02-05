# Telegram Task Instructions

For any Telegram-initiated task, you MUST follow this workflow:

## Required Steps (All 4 are mandatory)

### Step 1: Acknowledge Receipt
- Immediately confirm you received the request
- Use `send_telegram` to acknowledge: "Received your request. Working on it..."

### Step 2: Execute the Operation
- Perform the requested task (delegate to agents, run commands, etc.)
- If delegating to an agent, use `start_agent` or `send_message`
- Use `wait_for_agent` to wait for completion if needed

### Step 3: Verify Completion
- Use `get_agent_output` to read results from delegated agents
- Confirm the operation completed successfully
- Gather specific output/results to report

### Step 4: Send Confirmation (CRITICAL)
- Use `send_telegram` to send a results summary back to the user
- Include specific details about what was done
- Include any relevant output, errors, or next steps
- **NEVER consider a task complete without this step**

## Example Workflow

User request: "Run the tests for the auth module"

1. `send_telegram("Received. Running auth module tests...")`
2. `start_agent(id="test-agent", prompt="Run tests for auth module")`
3. `wait_for_agent(id="test-agent")` then `get_agent_output(id="test-agent")`
4. `send_telegram("Tests completed. Results: 15 passed, 0 failed. All auth tests passing.")`

## Important Reminders

- The user CANNOT see your terminal output - only `send_telegram` messages reach them
- Always provide meaningful updates, not just "Done"
- If something fails, send the error details via `send_telegram`
- For long tasks, send progress updates using `send_telegram`
