# Codex Code Review Skill for Claude Code

Claude orchestrates, Codex reviews. Five perspectives: security, correctness, compliance, performance, maintainability.

## Install

```bash
# 1. Install the skill
mkdir -p ~/.claude/skills/codex-review
curl -sL https://raw.githubusercontent.com/pauhu/claude-codex-review/main/skills/codex-review/SKILL.md \
  -o ~/.claude/skills/codex-review/SKILL.md

# 2. Add Codex as MCP server
npm install -g @openai/codex
claude mcp add codex -s user -- codex mcp-server
```

Restart Claude Code.

## Using Codex with Claude Max

Codex needs an LLM backend. To use your Claude Max subscription instead of an OpenAI key:

```bash
# 1. Install the proxy
npm install -g claude-max-api-proxy

# 2. Configure Codex to use Claude Max
bash proxy/setup.sh

# 3. Start the proxy (keep running)
bash proxy/start.sh
```

The proxy translates between Codex (Responses API) and Claude Max (via CLI OAuth). No API keys needed.

```
Codex → responses-adapter.js (localhost:4000) → claude-max-api-proxy (localhost:3456) → Claude Max
```

## Use

```
/codex-review
```

Reviews uncommitted changes. Also accepts a file path or `branch` as argument.

## Share with your team

Add the skill to your project repo. Everyone who clones gets it:

```
your-project/
└── .claude/
    └── skills/
        └── codex-review/
            └── SKILL.md
```

Works on Windows, Mac, and Linux.

## Uninstall

```bash
rm -rf ~/.claude/skills/codex-review
```

## License

MIT – [Pauhu](https://pauhu.ai)
