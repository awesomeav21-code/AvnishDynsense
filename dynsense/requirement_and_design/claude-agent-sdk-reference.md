# Claude Agent SDK — Comprehensive Reference

> **Source:** [platform.claude.com/docs/en/agent-sdk](https://platform.claude.com/docs/en/agent-sdk/overview)
> **SDK Packages:** `@anthropic-ai/claude-agent-sdk` (TypeScript) | `claude-agent-sdk` (Python)
> **Formerly:** Claude Code SDK (renamed to Claude Agent SDK)

---

## Table of Contents

1. [Overview & Architecture](#1-overview--architecture)
2. [Installation & Setup](#2-installation--setup)
3. [Core API — `query()`](#3-core-api--query)
4. [Built-in Tools](#4-built-in-tools)
5. [Permission System](#5-permission-system)
6. [Hooks — Intercept & Control](#6-hooks--intercept--control)
7. [Sessions — State & Resumption](#7-sessions--state--resumption)
8. [Subagents — Task Delegation](#8-subagents--task-delegation)
9. [MCP — External Tool Integration](#9-mcp--external-tool-integration)
10. [Custom Tools — In-Process MCP](#10-custom-tools--in-process-mcp)
11. [User Input & Approval Flows](#11-user-input--approval-flows)
12. [Streaming vs Single Message Input](#12-streaming-vs-single-message-input)
13. [System Prompts & CLAUDE.md](#13-system-prompts--claudemd)
14. [Plugins](#14-plugins)
15. [File Checkpointing](#15-file-checkpointing)
16. [Cost Tracking](#16-cost-tracking)
17. [Hosting & Deployment](#17-hosting--deployment)
18. [Secure Deployment](#18-secure-deployment)
19. [Configuration Reference](#19-configuration-reference)
20. [Message Types Reference](#20-message-types-reference)

---

## 1. Overview & Architecture

### What It Is

The Claude Agent SDK lets you build AI agents that **autonomously** read files, run commands, search the web, edit code, and more. It exposes the same tools, agent loop, and context management that power Claude Code — programmable in Python and TypeScript.

### Key Differentiator from Client SDK

| Aspect | Anthropic Client SDK | Claude Agent SDK |
|--------|---------------------|------------------|
| Tool execution | You implement the tool loop | Claude handles it autonomously |
| Built-in tools | None — you define everything | Read, Write, Edit, Bash, Glob, Grep, WebSearch, WebFetch, etc. |
| Agent loop | Manual `while stop_reason == "tool_use"` | Automatic via `async for` / `for await` |
| Use case | Direct API access | Production agent automation |

### When to Use What

| Use case | Best choice |
|----------|------------|
| Interactive development | Claude Code CLI |
| CI/CD pipelines | Agent SDK |
| Custom applications | Agent SDK |
| One-off tasks | CLI |
| Production automation | Agent SDK |

### Core Architecture

```
Your Application
    │
    ▼
  query()  ──── async iterator ────┐
    │                               │
    ▼                               ▼
  Claude Model                  Message Stream
    │                          (SDKMessage[])
    ▼
  Tool Calls ──► Built-in Tools (Read, Edit, Bash, ...)
    │          ──► MCP Servers (external tools)
    │          ──► Custom Tools (in-process MCP)
    │          ──► Subagents (delegated tasks)
    ▼
  Tool Results ──► Back to Claude ──► Next iteration
    │
    ▼
  Final Result (ResultMessage)
```

---

## 2. Installation & Setup

### Install

```bash
# TypeScript
npm install @anthropic-ai/claude-agent-sdk

# Python (uv)
uv init && uv add claude-agent-sdk

# Python (pip)
python3 -m venv .venv && source .venv/bin/activate
pip3 install claude-agent-sdk
```

### Prerequisites

- **Node.js 18+** or **Python 3.10+**
- **Anthropic API key** from [platform.claude.com](https://platform.claude.com/)

### Authentication

```bash
# Direct Anthropic API
export ANTHROPIC_API_KEY=your-api-key

# Amazon Bedrock
export CLAUDE_CODE_USE_BEDROCK=1
# + configure AWS credentials

# Google Vertex AI
export CLAUDE_CODE_USE_VERTEX=1
# + configure Google Cloud credentials

# Microsoft Azure
export CLAUDE_CODE_USE_FOUNDRY=1
# + configure Azure credentials
```

---

## 3. Core API — `query()`

The primary entry point. Returns an async iterator that streams messages as Claude works.

### TypeScript

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "Find and fix the bug in auth.py",
  options: {
    allowedTools: ["Read", "Edit", "Bash"],
    permissionMode: "acceptEdits"
  }
})) {
  if (message.type === "assistant") {
    for (const block of message.message.content) {
      if ("text" in block) console.log(block.text);
      else if ("name" in block) console.log(`Tool: ${block.name}`);
    }
  } else if (message.type === "result") {
    console.log(`Done: ${message.subtype}`);
  }
}
```

### Python

```python
import asyncio
from claude_agent_sdk import query, ClaudeAgentOptions, AssistantMessage, ResultMessage

async def main():
    async for message in query(
        prompt="Find and fix the bug in auth.py",
        options=ClaudeAgentOptions(
            allowed_tools=["Read", "Edit", "Bash"],
            permission_mode="acceptEdits"
        )
    ):
        if isinstance(message, AssistantMessage):
            for block in message.content:
                if hasattr(block, "text"):
                    print(block.text)
                elif hasattr(block, "name"):
                    print(f"Tool: {block.name}")
        elif isinstance(message, ResultMessage):
            print(f"Done: {message.subtype}")

asyncio.run(main())
```

### Query Object Methods

The `query()` function returns a `Query` object with these methods:

| Method | Description |
|--------|-------------|
| `interrupt()` | Cancel current operation (streaming mode only) |
| `rewindFiles(uuid)` | Restore files to checkpoint state |
| `setPermissionMode(mode)` | Change permission mode mid-session |
| `setModel(model)` | Switch model mid-session |
| `setMaxThinkingTokens(n)` | Adjust thinking budget |
| `supportedCommands()` | List available slash commands |
| `supportedModels()` | List available models |
| `mcpServerStatus()` | Check MCP server connections |
| `accountInfo()` | Get account details |

---

## 4. Built-in Tools

Claude can use these tools out of the box — no implementation required:

| Tool | What it does | Example use |
|------|--------------|-------------|
| **Read** | Read any file (text, images, PDFs, notebooks) | `allowed_tools=["Read"]` |
| **Write** | Create new files | `allowed_tools=["Write"]` |
| **Edit** | Make precise edits to existing files | `allowed_tools=["Edit"]` |
| **Bash** | Run terminal commands, scripts, git | `allowed_tools=["Bash"]` |
| **Glob** | Find files by pattern (`**/*.ts`) | `allowed_tools=["Glob"]` |
| **Grep** | Search file contents with regex | `allowed_tools=["Grep"]` |
| **WebSearch** | Search the web | `allowed_tools=["WebSearch"]` |
| **WebFetch** | Fetch and parse web pages | `allowed_tools=["WebFetch"]` |
| **AskUserQuestion** | Ask clarifying questions with options | `allowed_tools=["AskUserQuestion"]` |
| **Task** | Spawn subagents | `allowed_tools=["Task"]` |
| **NotebookEdit** | Edit Jupyter notebook cells | `allowed_tools=["NotebookEdit"]` |

### Common Tool Combinations

| Use case | Tools |
|----------|-------|
| Read-only analysis | `Read`, `Glob`, `Grep` |
| Analyze + modify code | `Read`, `Edit`, `Glob` |
| Full automation | `Read`, `Edit`, `Bash`, `Glob`, `Grep` |
| With delegation | Add `Task` to any combination |

---

## 5. Permission System

### Permission Evaluation Order

1. **Hooks** — `PreToolUse` hooks can allow/deny/ask
2. **Permission rules** — Declarative rules in `settings.json` (deny → allow → ask)
3. **Permission mode** — Global mode setting
4. **`canUseTool` callback** — Runtime approval function

### Permission Modes

| Mode | Description | Auto-approves |
|------|-------------|---------------|
| `default` | Standard — calls `canUseTool` for unmatched tools | Nothing |
| `acceptEdits` | Auto-approve file operations | Edit, Write, mkdir, rm, mv, cp |
| `bypassPermissions` | Skip all checks (use with caution) | Everything |
| `plan` | Read-only planning — no tool execution | Nothing (blocks all) |

### Setting Permission Mode

```typescript
// At query time
const response = query({
  prompt: "...",
  options: { permissionMode: "acceptEdits" }
});

// Dynamically mid-session
await response.setPermissionMode("bypassPermissions");
```

```python
# At query time
options = ClaudeAgentOptions(permission_mode="acceptEdits")

# Dynamically mid-session
await q.set_permission_mode("acceptEdits")
```

> **Warning:** `bypassPermissions` propagates to all subagents and cannot be overridden. Use with extreme caution.

---

## 6. Hooks — Intercept & Control

Hooks let you intercept agent execution at key points for validation, logging, security, or transformation.

### Available Hook Events

| Hook Event | Python | TypeScript | Trigger |
|------------|--------|------------|---------|
| `PreToolUse` | Yes | Yes | Before tool executes (can block/modify) |
| `PostToolUse` | Yes | Yes | After tool returns result |
| `PostToolUseFailure` | No | Yes | Tool execution failed |
| `UserPromptSubmit` | Yes | Yes | User prompt submitted |
| `Stop` | Yes | Yes | Agent stopping |
| `SubagentStart` | No | Yes | Subagent spawned |
| `SubagentStop` | Yes | Yes | Subagent completed |
| `PreCompact` | Yes | Yes | Before conversation compaction |
| `PermissionRequest` | No | Yes | Permission dialog triggered |
| `SessionStart` | No | Yes | Session initialized |
| `SessionEnd` | No | Yes | Session terminated |
| `Notification` | No | Yes | Agent status message |

### Hook Structure

A hook has two parts:
1. **Callback function** — your logic
2. **Matcher** — regex pattern filtering which tools trigger the callback

### Example: Block Dangerous Commands

```typescript
import { query, HookCallback, PreToolUseHookInput } from "@anthropic-ai/claude-agent-sdk";

const blockDangerous: HookCallback = async (input, toolUseID, { signal }) => {
  const command = (input as PreToolUseHookInput).tool_input?.command as string;
  if (command?.includes('rm -rf /')) {
    return {
      hookSpecificOutput: {
        hookEventName: input.hook_event_name,
        permissionDecision: 'deny',
        permissionDecisionReason: 'Dangerous command blocked'
      }
    };
  }
  return {};
};

for await (const message of query({
  prompt: "Clean up the project",
  options: {
    hooks: {
      PreToolUse: [{ matcher: 'Bash', hooks: [blockDangerous] }]
    }
  }
})) { /* ... */ }
```

### Example: Audit Log

```python
async def log_file_change(input_data, tool_use_id, context):
    file_path = input_data.get('tool_input', {}).get('file_path', 'unknown')
    with open('./audit.log', 'a') as f:
        f.write(f"{datetime.now()}: modified {file_path}\n")
    return {}

options = ClaudeAgentOptions(
    hooks={
        "PostToolUse": [HookMatcher(matcher="Edit|Write", hooks=[log_file_change])]
    }
)
```

### Callback Inputs

Common fields on all hook inputs:

| Field | Description |
|-------|-------------|
| `hook_event_name` | Hook type (e.g., `PreToolUse`) |
| `session_id` | Current session ID |
| `transcript_path` | Path to conversation transcript |
| `cwd` | Current working directory |

Tool-specific fields: `tool_name`, `tool_input`, `tool_response`, `error`, `prompt`, etc.

### Callback Outputs

| Field | Description |
|-------|-------------|
| `continue` | Whether agent should continue (default: true) |
| `stopReason` | Message when continue=false |
| `suppressOutput` | Hide stdout from transcript |
| `systemMessage` | Inject context into conversation |
| `hookSpecificOutput.permissionDecision` | `allow` / `deny` / `ask` |
| `hookSpecificOutput.updatedInput` | Modified tool input |
| `hookSpecificOutput.additionalContext` | Extra context for Claude |

### Permission Decision Priority

1. **Deny** — any deny = immediate block
2. **Ask** — prompt for approval
3. **Allow** — auto-approve
4. **Default to Ask** — if nothing matches

---

## 7. Sessions — State & Resumption

Sessions maintain conversation context across multiple exchanges.

### Capture Session ID

```typescript
let sessionId: string | undefined;

for await (const message of query({
  prompt: "Read the auth module",
  options: { allowedTools: ["Read", "Glob"] }
})) {
  if (message.type === 'system' && message.subtype === 'init') {
    sessionId = message.session_id;
  }
}
```

### Resume a Session

```typescript
for await (const message of query({
  prompt: "Now find all places that call it",
  options: { resume: sessionId }
})) {
  if ("result" in message) console.log(message.result);
}
```

### Fork a Session

Forking creates a new branch from the resume point without modifying the original:

```typescript
const forkedResponse = query({
  prompt: "Try a different approach",
  options: {
    resume: sessionId,
    forkSession: true  // New session ID, original preserved
  }
});
```

| Behavior | `forkSession: false` (default) | `forkSession: true` |
|----------|-------------------------------|---------------------|
| Session ID | Same as original | New ID generated |
| History | Appends to original | Creates branch |
| Original | Modified | Preserved |

---

## 8. Subagents — Task Delegation

Subagents are separate agent instances spawned to handle focused subtasks. They provide:
- **Context isolation** — don't pollute main conversation
- **Parallelization** — run concurrently
- **Specialized instructions** — tailored system prompts
- **Tool restrictions** — limited capabilities

### Three Ways to Create Subagents

1. **Programmatically** — `agents` parameter in `query()` options
2. **Filesystem** — markdown files in `.claude/agents/`
3. **Built-in** — Claude can use the `general-purpose` subagent via Task tool

### Define Subagents Programmatically

```typescript
for await (const message of query({
  prompt: "Review the auth module for security issues",
  options: {
    allowedTools: ["Read", "Grep", "Glob", "Task"],  // Task required!
    agents: {
      "code-reviewer": {
        description: "Expert code reviewer for quality and security.",
        prompt: "Analyze code quality and suggest improvements.",
        tools: ["Read", "Glob", "Grep"],  // Read-only
        model: "sonnet"  // Cheaper model for this task
      },
      "test-runner": {
        description: "Runs and analyzes test suites.",
        prompt: "Run tests and analyze results.",
        tools: ["Bash", "Read", "Grep"]  // Can execute commands
      }
    }
  }
})) { /* ... */ }
```

### AgentDefinition Fields

| Field | Required | Description |
|-------|----------|-------------|
| `description` | Yes | When to use this agent (Claude reads this) |
| `prompt` | Yes | System prompt for the agent |
| `tools` | No | Allowed tools (inherits all if omitted) |
| `model` | No | `'sonnet'` / `'opus'` / `'haiku'` / `'inherit'` |

### Key Constraints

- Subagents **cannot** spawn their own subagents (no `Task` in subagent tools)
- `Task` must be in `allowedTools` for the main agent to delegate
- Messages from subagents include `parent_tool_use_id` for tracking
- On Windows, keep prompts concise (8191 char command line limit)

### Invocation

- **Automatic:** Claude decides based on `description` matching the task
- **Explicit:** Mention by name: `"Use the code-reviewer agent to..."`
- **Dynamic:** Create AgentDefinition at runtime via factory functions

---

## 9. MCP — External Tool Integration

The Model Context Protocol connects agents to external tools: databases, browsers, APIs, and [hundreds more](https://github.com/modelcontextprotocol/servers).

### Transport Types

| Transport | When to use | Config |
|-----------|-------------|--------|
| **stdio** | Local process (npx, docker) | `command` + `args` |
| **HTTP** | Cloud-hosted, non-streaming | `type: "http"` + `url` |
| **SSE** | Cloud-hosted, streaming | `type: "sse"` + `url` |
| **SDK** | In-process custom tools | `type: "sdk"` + instance |

### Configure MCP Servers

```typescript
// In code
for await (const message of query({
  prompt: "List issues in anthropics/claude-code",
  options: {
    mcpServers: {
      "github": {
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-github"],
        env: { GITHUB_TOKEN: process.env.GITHUB_TOKEN }
      }
    },
    allowedTools: ["mcp__github__list_issues"]
  }
})) { /* ... */ }
```

```json
// .mcp.json (auto-loaded)
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_TOKEN": "${GITHUB_TOKEN}" }
    }
  }
}
```

### Tool Naming Convention

MCP tools follow: `mcp__<server-name>__<tool-name>`

```typescript
allowedTools: [
  "mcp__github__*",            // All tools from github server
  "mcp__db__query",            // Only query tool from db
  "mcp__slack__send_message"   // Only send_message from slack
]
```

### MCP Tool Search

When many MCP tools are configured, tool search dynamically loads tools on-demand instead of preloading all:

```typescript
env: { ENABLE_TOOL_SEARCH: "auto:5" }  // Enable at 5% context threshold
```

| Value | Behavior |
|-------|----------|
| `auto` | Activates at 10% context threshold (default) |
| `auto:5` | Activates at 5% threshold |
| `true` | Always enabled |
| `false` | Disabled |

---

## 10. Custom Tools — In-Process MCP

Define custom tools that run in-process using `createSdkMcpServer` and `tool` helpers.

### TypeScript

```typescript
import { query, tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

const weatherServer = createSdkMcpServer({
  name: "weather",
  version: "1.0.0",
  tools: [
    tool(
      "get_weather",
      "Get current temperature for a location",
      {
        latitude: z.number().describe("Latitude"),
        longitude: z.number().describe("Longitude")
      },
      async (args) => {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${args.latitude}&longitude=${args.longitude}&current=temperature_2m`);
        const data = await res.json();
        return {
          content: [{ type: "text", text: `Temperature: ${data.current.temperature_2m}` }]
        };
      }
    )
  ]
});

// Custom tools require streaming input mode
async function* messages() {
  yield { type: "user" as const, message: { role: "user" as const, content: "What's the weather in SF?" } };
}

for await (const message of query({
  prompt: messages(),
  options: {
    mcpServers: { weather: weatherServer },
    allowedTools: ["mcp__weather__get_weather"]
  }
})) { /* ... */ }
```

### Python

```python
from claude_agent_sdk import tool, create_sdk_mcp_server

@tool("get_weather", "Get temperature", {"latitude": float, "longitude": float})
async def get_weather(args):
    async with aiohttp.ClientSession() as session:
        async with session.get(f"https://api.open-meteo.com/v1/forecast?latitude={args['latitude']}&longitude={args['longitude']}&current=temperature_2m") as resp:
            data = await resp.json()
    return {"content": [{"type": "text", "text": f"Temperature: {data['current']['temperature_2m']}"}]}

server = create_sdk_mcp_server(name="weather", version="1.0.0", tools=[get_weather])
```

> **Important:** Custom MCP tools require **streaming input mode** (async generator for prompt).

---

## 11. User Input & Approval Flows

Claude requests user input in two situations:
1. **Tool approval** — permission needed before executing a tool
2. **Clarifying questions** — via `AskUserQuestion` tool

### `canUseTool` Callback

```typescript
const options = {
  canUseTool: async (toolName, input) => {
    if (toolName === "AskUserQuestion") {
      return handleClarifyingQuestions(input);
    }

    // Show tool request to user
    console.log(`Tool: ${toolName}`, input);
    const approved = await askUser("Allow?");

    if (approved) {
      return { behavior: "allow", updatedInput: input };
    }
    return { behavior: "deny", message: "User denied" };
  }
};
```

### Response Options

| Response | Effect |
|----------|--------|
| **Allow** | Tool executes with original or modified input |
| **Allow + changes** | Tool executes with sanitized/modified input |
| **Deny** | Tool blocked, Claude sees denial message |
| **Deny + suggestion** | Tool blocked with guidance for Claude |

### Handling AskUserQuestion

```typescript
canUseTool: async (toolName, input) => {
  if (toolName === "AskUserQuestion") {
    const answers = {};
    for (const q of input.questions) {
      // Present options to user, collect response
      answers[q.question] = selectedLabel;
    }
    return {
      behavior: "allow",
      updatedInput: { questions: input.questions, answers }
    };
  }
}
```

Question format: 1-4 questions, each with 2-4 options, optional `multiSelect`.

---

## 12. Streaming vs Single Message Input

### Streaming Input (Recommended)

Long-lived interactive session with full capabilities:

```typescript
async function* generateMessages() {
  yield { type: "user", message: { role: "user", content: "Analyze codebase" } };
  await new Promise(resolve => setTimeout(resolve, 2000));
  yield { type: "user", message: { role: "user", content: [
    { type: "text", text: "Review this diagram" },
    { type: "image", source: { type: "base64", media_type: "image/png", data: "..." } }
  ]}};
}

for await (const message of query({ prompt: generateMessages(), options: { maxTurns: 10 } })) {
  // ...
}
```

**Supports:** Image uploads, queued messages, interruption, hooks, MCP, real-time feedback.

### Single Message Input

Simple one-shot query:

```typescript
for await (const message of query({
  prompt: "Explain the auth flow",
  options: { maxTurns: 1, allowedTools: ["Read", "Grep"] }
})) { /* ... */ }
```

**Does NOT support:** Image attachments, dynamic queueing, interruption, hooks.

---

## 13. System Prompts & CLAUDE.md

### Four Approaches (from lightest to heaviest)

| Approach | Persistence | Default tools | When to use |
|----------|-------------|---------------|-------------|
| **CLAUDE.md** | Per-project file | Preserved | Team coding standards, project context |
| **Output styles** | Saved as files | Preserved | Reusable across projects |
| **systemPrompt + append** | Session only | Preserved | Session-specific additions |
| **Custom systemPrompt** | Session only | Lost | Complete control |

### Default Behavior

The SDK uses a **minimal system prompt** by default. To include Claude Code's full system prompt:

```typescript
options: {
  systemPrompt: { type: "preset", preset: "claude_code" }
}
```

### Loading CLAUDE.md

CLAUDE.md files are **not** loaded automatically. You must set `settingSources`:

```typescript
options: {
  systemPrompt: { type: "preset", preset: "claude_code" },
  settingSources: ["project"]  // Required to load CLAUDE.md
}
```

### Append to Claude Code Prompt

```typescript
options: {
  systemPrompt: {
    type: "preset",
    preset: "claude_code",
    append: "Always include docstrings and type hints."
  }
}
```

### Custom System Prompt

```typescript
options: {
  systemPrompt: "You are a Python specialist. Follow PEP 8."
}
```

---

## 14. Plugins

Plugins extend Claude Code with custom commands, agents, skills, hooks, and MCP servers.

### Loading Plugins

```typescript
for await (const message of query({
  prompt: "Hello",
  options: {
    plugins: [
      { type: "local", path: "./my-plugin" },
      { type: "local", path: "/absolute/path/to/plugin" }
    ]
  }
})) { /* ... */ }
```

### Plugin Structure

```
my-plugin/
├── .claude-plugin/
│   └── plugin.json          # Required manifest
├── commands/                 # Slash commands
│   └── custom-cmd.md
├── agents/                   # Subagent definitions
│   └── specialist.md
├── skills/                   # Agent skills
│   └── my-skill/SKILL.md
├── hooks/                    # Event handlers
│   └── hooks.json
└── .mcp.json                # MCP server definitions
```

### Using Plugin Commands

Commands are namespaced: `plugin-name:command-name`

```typescript
query({ prompt: "/my-plugin:greet", options: { plugins: [...] } })
```

---

## 15. File Checkpointing

Track file changes and rewind to any previous state.

### Enable

```typescript
const opts = {
  enableFileCheckpointing: true,
  permissionMode: "acceptEdits",
  extraArgs: { 'replay-user-messages': null },
  env: { ...process.env, CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING: '1' }
};
```

### Capture Checkpoint

```typescript
let checkpointId, sessionId;

for await (const message of query({ prompt: "Refactor auth", options: opts })) {
  if (message.type === 'user' && message.uuid && !checkpointId) {
    checkpointId = message.uuid;  // First user message = restore point
  }
  if ('session_id' in message) sessionId = message.session_id;
}
```

### Rewind Files

```typescript
// Resume session and rewind
const rewindQuery = query({ prompt: "", options: { ...opts, resume: sessionId } });
for await (const msg of rewindQuery) {
  await rewindQuery.rewindFiles(checkpointId);
  break;
}
```

### Limitations

- Only tracks Write, Edit, NotebookEdit tools (not Bash file operations)
- Checkpoints tied to session
- File content only (not directory operations)
- Local files only

---

## 16. Cost Tracking

### Key Rules

1. **Same message ID = same usage** — don't double-count
2. **Charge once per step** — not per message
3. **Result message has cumulative usage** — `total_cost_usd` is authoritative
4. **`modelUsage`** — per-model breakdown for multi-model sessions

### Tracking Example

```typescript
const processedIds = new Set<string>();

for await (const message of query({ prompt: "..." })) {
  if (message.type === 'assistant' && message.usage) {
    if (!processedIds.has(message.id)) {
      processedIds.add(message.id);
      // Record usage for this step
    }
  }
  if (message.type === 'result') {
    console.log(`Total cost: $${message.total_cost_usd}`);
    // modelUsage provides per-model breakdown
    for (const [model, usage] of Object.entries(message.modelUsage)) {
      console.log(`${model}: $${usage.costUSD}`);
    }
  }
}
```

### Usage Fields

| Field | Description |
|-------|-------------|
| `input_tokens` | Base input tokens |
| `output_tokens` | Generated tokens |
| `cache_creation_input_tokens` | Cache creation tokens |
| `cache_read_input_tokens` | Cache read tokens |
| `total_cost_usd` | Total cost (result message only) |

---

## 17. Hosting & Deployment

### System Requirements

- **Runtime:** Node.js 18+ (required) + Python 3.10+ (for Python SDK)
- **Resources:** ~1 GiB RAM, 5 GiB disk, 1 CPU per instance
- **Network:** Outbound HTTPS to `api.anthropic.com`
- **CLI:** `npm install -g @anthropic-ai/claude-code`

### Deployment Patterns

| Pattern | Description | Examples |
|---------|-------------|----------|
| **Ephemeral** | New container per task, destroy when done | Bug fix, invoice processing |
| **Long-running** | Persistent container, multiple agent processes | Email agent, site builder |
| **Hybrid** | Ephemeral with hydrated state/history | Project manager, deep research |
| **Single container** | Multiple agents in one container | Simulations, collaborative agents |

### Sandbox Providers

- [Modal Sandbox](https://modal.com/docs/guide/sandbox)
- [Cloudflare Sandboxes](https://github.com/cloudflare/sandbox-sdk)
- [Daytona](https://www.daytona.io/)
- [E2B](https://e2b.dev/)
- [Fly Machines](https://fly.io/docs/machines/)
- [Vercel Sandbox](https://vercel.com/docs/functions/sandbox)

### Cost

- Dominant cost is tokens, not containers
- Minimum container cost: ~$0.05/hour
- Set `maxTurns` to prevent infinite loops

---

## 18. Secure Deployment

### Security Principles

1. **Security boundaries** — separate agent from sensitive resources
2. **Least privilege** — restrict to required capabilities only
3. **Defense in depth** — layer multiple controls

### Isolation Technologies

| Technology | Isolation | Overhead | Complexity |
|------------|-----------|----------|------------|
| Sandbox runtime | Good | Very low | Low |
| Containers (Docker) | Setup dependent | Low | Medium |
| gVisor | Excellent | Medium/High | Medium |
| VMs (Firecracker) | Excellent | High | Medium/High |

### Docker Security Hardening

```bash
docker run \
  --cap-drop ALL \
  --security-opt no-new-privileges \
  --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=100m \
  --network none \
  --memory 2g --cpus 2 --pids-limit 100 \
  --user 1000:1000 \
  -v /path/to/code:/workspace:ro \
  -v /var/run/proxy.sock:/var/run/proxy.sock:ro \
  agent-image
```

### Credential Management — The Proxy Pattern

Run a proxy **outside** the agent's security boundary that injects credentials:

```
Agent (no credentials) → Unix Socket → Proxy (adds auth) → External API
```

- Agent never sees actual credentials
- Proxy enforces domain allowlists
- All requests logged for auditing

### Sandbox Configuration (Programmatic)

```typescript
options: {
  sandbox: {
    enabled: true,
    autoAllowBashIfSandboxed: true,
    network: { allowLocalBinding: true },
    excludedCommands: ['docker']
  }
}
```

---

## 19. Configuration Reference

### Full Options (`ClaudeAgentOptions` / `Options`)

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `allowedTools` | `string[]` | All tools | Tools Claude can use |
| `disallowedTools` | `string[]` | `[]` | Tools Claude cannot use |
| `permissionMode` | `string` | `'default'` | `default`/`acceptEdits`/`bypassPermissions`/`plan` |
| `canUseTool` | `function` | `undefined` | Runtime permission callback |
| `systemPrompt` | `string \| object` | minimal | System prompt or preset config |
| `model` | `string` | CLI default | Claude model to use |
| `fallbackModel` | `string` | `undefined` | Fallback if primary fails |
| `maxTurns` | `number` | `undefined` | Max conversation turns |
| `maxBudgetUsd` | `number` | `undefined` | Max spend in USD |
| `maxThinkingTokens` | `number` | `undefined` | Max thinking tokens |
| `cwd` | `string` | `process.cwd()` | Working directory |
| `additionalDirectories` | `string[]` | `[]` | Extra accessible directories |
| `env` | `Dict<string>` | `process.env` | Environment variables |
| `mcpServers` | `Record<string, config>` | `{}` | MCP server configurations |
| `agents` | `Record<string, AgentDef>` | `undefined` | Subagent definitions |
| `hooks` | `Record<event, matcher[]>` | `{}` | Hook callbacks |
| `plugins` | `PluginConfig[]` | `[]` | Plugin paths |
| `resume` | `string` | `undefined` | Session ID to resume |
| `forkSession` | `boolean` | `false` | Fork instead of continue |
| `continue` | `boolean` | `false` | Continue most recent session |
| `settingSources` | `string[]` | `[]` | Settings to load: `user`/`project`/`local` |
| `enableFileCheckpointing` | `boolean` | `false` | Track file changes |
| `includePartialMessages` | `boolean` | `false` | Include streaming partials |
| `betas` | `string[]` | `[]` | Beta features (e.g., `context-1m-2025-08-07`) |
| `sandbox` | `object` | `undefined` | Sandbox configuration |
| `outputFormat` | `object` | `undefined` | Structured output schema |
| `tools` | `string[] \| preset` | `undefined` | Tool configuration |
| `extraArgs` | `Record<string, string>` | `{}` | Additional CLI arguments |

### Settings Precedence

When multiple `settingSources` are loaded:
1. Local settings (`.claude/settings.local.json`) — highest
2. Project settings (`.claude/settings.json`)
3. User settings (`~/.claude/settings.json`) — lowest

Programmatic options always override filesystem settings.

---

## 20. Message Types Reference

### SDKMessage (Union)

```
SDKMessage =
  | SDKAssistantMessage    — Claude's response (text, tool calls)
  | SDKUserMessage         — User input or tool results
  | SDKResultMessage       — Final result (success or error)
  | SDKSystemMessage       — Init message with session info
  | SDKPartialAssistant    — Streaming partial (if enabled)
  | SDKCompactBoundary     — Conversation compaction marker
```

### Result Subtypes

| Subtype | Description |
|---------|-------------|
| `success` | Task completed successfully |
| `error_max_turns` | Hit turn limit |
| `error_during_execution` | Runtime error |
| `error_max_budget_usd` | Hit budget limit |
| `error_max_structured_output_retries` | Structured output validation failed |

### Result Message Fields (Success)

| Field | Description |
|-------|-------------|
| `result` | Final text output |
| `session_id` | Session identifier |
| `duration_ms` | Total wall-clock time |
| `duration_api_ms` | Time spent in API calls |
| `num_turns` | Number of conversation turns |
| `total_cost_usd` | Total cost (authoritative) |
| `usage` | Cumulative token usage |
| `modelUsage` | Per-model usage breakdown |
| `structured_output` | Parsed structured output (if configured) |

### System Init Message Fields

| Field | Description |
|-------|-------------|
| `session_id` | New session identifier |
| `tools` | Available tools list |
| `mcp_servers` | MCP connection status |
| `model` | Active model |
| `permissionMode` | Active permission mode |
| `slash_commands` | Available commands |

---

## Quick Reference Card

### Minimal Agent (5 lines)

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";
for await (const msg of query({ prompt: "Fix the bug in auth.py", options: { allowedTools: ["Read", "Edit"], permissionMode: "acceptEdits" } })) {
  if ("result" in msg) console.log(msg.result);
}
```

### Full-Featured Agent

```typescript
import { query, tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "Review and fix security issues",
  options: {
    model: "claude-opus-4-6",
    allowedTools: ["Read", "Edit", "Bash", "Glob", "Grep", "Task", "mcp__db__query"],
    permissionMode: "acceptEdits",
    systemPrompt: { type: "preset", preset: "claude_code", append: "Focus on OWASP Top 10." },
    settingSources: ["project"],
    maxTurns: 20,
    maxBudgetUsd: 5.0,
    agents: {
      "security-scanner": {
        description: "Security vulnerability scanner",
        prompt: "Scan for XSS, SQLi, CSRF, auth bypass...",
        tools: ["Read", "Grep", "Glob"],
        model: "sonnet"
      }
    },
    hooks: {
      PreToolUse: [{ matcher: "Bash", hooks: [blockDangerousCommands] }],
      PostToolUse: [{ matcher: "Edit|Write", hooks: [auditLogger] }]
    },
    mcpServers: {
      db: { command: "npx", args: ["-y", "@modelcontextprotocol/server-postgres", connStr] }
    }
  }
})) {
  // Process messages
}
```

### GitHub Repos

- **TypeScript SDK:** [github.com/anthropics/claude-agent-sdk-typescript](https://github.com/anthropics/claude-agent-sdk-typescript)
- **Python SDK:** [github.com/anthropics/claude-agent-sdk-python](https://github.com/anthropics/claude-agent-sdk-python)
- **Example Agents:** [github.com/anthropics/claude-agent-sdk-demos](https://github.com/anthropics/claude-agent-sdk-demos)
