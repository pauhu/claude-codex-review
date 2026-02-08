# Codex Code Review Skill for Claude Code

Two-agent code review: Claude reads (logic/security), Codex runs (tsc/lint/tests). Five perspectives: security, correctness, compliance, performance, maintainability.

## Install

```bash
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

The SKILL.md defines a five-step review:

1. **Scope** – determines what code to review
2. **Claude reads** – adversarial review from 5 perspectives (security, correctness, compliance, performance, maintainability)
3. **Codex runs** – mechanical checks: `tsc --noEmit`, `eslint`, secret scan, TODO/FIXME grep
4. **Merge** – combine logical findings with mechanical findings, deduplicate
5. **Output** – severity table with source attribution (Claude vs Codex)

### With Codex CLI (recommended)

If you have [Codex CLI](https://github.com/openai/codex) installed, the skill uses it as a mechanical verifier – running type checks, linters, and secret scans in a sandboxed environment.

```bash
npm install -g @openai/codex
```

Without Codex, the skill falls back to running `tsc` and `eslint` directly.

### With Codex MCP (alternative)

You can also register Codex as an MCP server:

```bash
claude mcp add codex -s user -- codex mcp-server
```

### Experimental: Codex with Claude Max

The `proxy/` folder contains an experimental adapter that routes Codex through your Claude Max subscription instead of an OpenAI key. Codex's agentic tools (`exec_shell`, `apply_patch`) don't fully work with Claude as the backend model yet. The proxy infrastructure is ready for when Codex improves its model-agnostic support.

## Uninstall

```bash
rm -rf ~/.claude/skills/codex-review
```

## License

MIT – [Pauhu AI Ltd](https://pauhu.ai)
