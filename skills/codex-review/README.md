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

### Codex with Claude Max (no OpenAI key needed)

The `proxy/` folder contains an adapter that routes Codex through your Claude Max subscription instead of an OpenAI key. It translates the Responses API to Chat Completions, injects tool schemas into the prompt, and parses structured tool calls from Claude's responses – so Codex's sandbox execution works end-to-end.

```bash
# One-time setup
bash proxy/setup.sh

# Start the proxy chain (ports 3456 + 4000)
bash proxy/start.sh

# Codex now uses Claude Max
codex exec -s read-only "Run npx tsc --noEmit and report errors"
```

Requires [claude-max-api-proxy](https://www.npmjs.com/package/claude-max-api-proxy) and an authenticated Claude Code CLI.

## Uninstall

```bash
rm -rf ~/.claude/skills/codex-review
```

## License

MIT – [Pauhu AI Ltd](https://pauhu.ai)
