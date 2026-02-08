# Codex Code Review Skill for Claude Code

Claude orchestrates, Codex reviews. Five perspectives: security, correctness, compliance, performance, maintainability.

## Prerequisites

- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed and authenticated
- [Node.js](https://nodejs.org/) 18+
- A Claude Max subscription (no OpenAI key needed)

## Install

### Option A: From GitHub

```bash
# 1. Install the skill
mkdir -p ~/.claude/skills/codex-review
curl -sL https://raw.githubusercontent.com/pauhu/claude-codex-review/main/skills/codex-review/SKILL.md \
  -o ~/.claude/skills/codex-review/SKILL.md

# 2. Install Codex CLI
npm install -g @openai/codex

# 3. Add Codex as MCP server
claude mcp add codex -s user -- codex mcp-server
```

### Option B: From your repo

Copy the `.claude/skills/codex-review/` folder into your project. Everyone who clones gets it.

```
your-project/
└── .claude/
    └── skills/
        └── codex-review/
            ├── SKILL.md
            └── proxy/
                ├── responses-adapter.js
                ├── setup.sh
                └── start.sh
```

Then add Codex as an MCP server in your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "codex": {
      "command": "codex",
      "args": ["mcp-server"],
      "env": {
        "CODEX_API_KEY": "sk-claude-max"
      }
    }
  }
}
```

## Using Codex with Claude Max

Codex needs an LLM backend. This proxy chain lets you use your Claude Max subscription instead of an OpenAI API key.

```
Codex → responses-adapter.js (localhost:4000) → claude-max-api-proxy (localhost:3456) → Claude Max
```

### Setup (one time)

```bash
# 1. Install the proxy
npm install -g claude-max-api-proxy

# 2. Install Codex CLI
npm install -g @openai/codex

# 3. Configure Codex to use Claude Max
bash .claude/skills/codex-review/proxy/setup.sh
```

This writes `~/.codex/config.toml` pointing Codex at the local proxy. No API keys needed — it uses your Claude Code CLI OAuth token.

### Start the proxy

```bash
bash .claude/skills/codex-review/proxy/start.sh
```

Keep this running in a separate terminal. It starts two processes:

- **Port 3456** — `claude-max-api-proxy` (translates Chat Completions → Claude Max via CLI OAuth)
- **Port 4000** — `responses-adapter.js` (translates Responses API → Chat Completions)

Verify with:

```bash
curl http://localhost:4000/health
```

### Restart Claude Code

After setup, restart Claude Code so it picks up the Codex MCP server.

## Use

```
/codex-review
```

Reviews uncommitted changes. Also accepts:

- `/codex-review src/auth.ts` — review a specific file
- `/codex-review branch` — review all changes vs main
- `/codex-review commit` — review the last commit

The skill tries Codex MCP first, falls back to `codex` CLI, then to adversarial self-review if Codex is unavailable.

## How it works

The SKILL.md file defines a four-step review process:

1. **Scope** — determines what code to review
2. **Second opinion** — sends code to Codex via MCP for independent review
3. **Five perspectives** — security, correctness, compliance, performance, maintainability
4. **Output** — severity table with actionable findings

## Proxy architecture

```
Claude Code (your session)
    │ MCP protocol (stdio)
    ▼
codex mcp-server
    │ POST /v1/responses (SSE streaming)
    ▼
responses-adapter.js (localhost:4000)
    │ translates Responses API → Chat Completions
    │ POST /v1/chat/completions
    ▼
claude-max-api-proxy (localhost:3456)
    │ wraps Claude Code CLI subprocess
    │ uses Claude Max OAuth token
    ▼
Claude (via Max subscription)
```

- `responses-adapter.js` — zero-dependency Node.js proxy (~270 lines)
- `claude-max-api-proxy` — npm package that spawns Claude Code CLI for inference

No OpenAI key. No Anthropic API key. No Python. No LiteLLM.

## Uninstall

```bash
# Remove the skill
rm -rf ~/.claude/skills/codex-review

# Remove Codex MCP server
claude mcp remove codex -s user

# Remove Codex config
rm -rf ~/.codex
```

## License

MIT — [Pauhu](https://pauhu.ai)
