# Codex Code Review Skill for Claude Code

Five-perspective code review as a Claude Code skill. Security, correctness, compliance, performance, maintainability.

## Install

```bash
# 1. Install the skill
mkdir -p ~/.claude/skills/codex-review
curl -sL https://raw.githubusercontent.com/pauhu/claude-codex-review/main/skills/codex-review/SKILL.md \
  -o ~/.claude/skills/codex-review/SKILL.md
```

Restart Claude Code. That's it.

### Share with your team

Drop the skill into your repo. Everyone who clones gets it:

```
your-project/
└── .claude/
    └── skills/
        └── codex-review/
            └── SKILL.md
```

## Use

```
/codex-review
```

Reviews uncommitted changes. Also accepts:

- `/codex-review src/auth.ts` – review a specific file
- `/codex-review branch` – review all changes vs main
- `/codex-review commit` – review the last commit

## How it works

The SKILL.md defines a four-step review:

1. **Scope** – determines what code to review
2. **Second opinion** – tries Codex MCP, then Codex CLI, then adversarial self-review
3. **Five perspectives** – security, correctness, compliance, performance, maintainability
4. **Output** – severity table with actionable findings

### With Codex (optional)

If you have an OpenAI API key and [Codex CLI](https://github.com/openai/codex), the skill uses it as a genuine second opinion – a different model reviewing your code independently.

```bash
npm install -g @openai/codex
claude mcp add codex -s user -- codex mcp-server
```

Without Codex, the skill still works. It falls back to adversarial self-review where Claude re-examines the code assuming it's broken.

### Experimental: Codex with Claude Max

The `proxy/` folder contains an experimental adapter that routes Codex through your Claude Max subscription instead of an OpenAI key. This is work in progress – Codex's agentic tools (`exec_shell`, `apply_patch`) don't fully work with Claude as the backend model yet. The proxy infrastructure is ready for when Codex improves its model-agnostic support.

## Uninstall

```bash
rm -rf ~/.claude/skills/codex-review
```

## License

MIT – [Pauhu](https://pauhu.ai)
