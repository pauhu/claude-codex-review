# Code Review Skill for Claude Code

Structured code review using Claude and OpenAI Codex together. Two models, fewer bugs.

## Install

```bash
# 1. Install the skill
mkdir -p ~/.claude/skills/codex-review
curl -sL https://raw.githubusercontent.com/pauhu/claude-codex-review/main/skills/codex-review/SKILL.md \
  -o ~/.claude/skills/codex-review/SKILL.md

# 2. Install Codex CLI and register as MCP server
npm install -g @openai/codex
claude mcp add codex -s user -- codex mcp-server
```

Restart Claude Code.

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
claude mcp remove codex -s user
```

## License

MIT – [Pauhu](https://pauhu.ai)
