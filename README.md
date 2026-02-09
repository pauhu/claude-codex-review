# Codex Code Review Skill for Claude Code

Adversarial code review: read diffs, run checks, report findings. One pass, five perspectives.

## Install

```bash
mkdir -p .claude/skills/codex-review
curl -sL https://raw.githubusercontent.com/pauhu/claude-codex-review/main/skills/codex-review/SKILL.md \
  -o .claude/skills/codex-review/SKILL.md
```

### Share with your team

Drop the skill into your repo:

```
your-project/
└── .claude/
    └── skills/
        └── codex-review/
            └── SKILL.md
```

Everyone who clones the skill will be able to use it.

## Use

```
/codex-review
/codex-review src/auth.ts
/codex-review branch
/codex-review commit
```

## How it works

1. **Scope** — determine what changed
2. **Read** — adversarial review from 5 perspectives (security, correctness, compliance, performance, maintainability)
3. **Run checks** — `tsc --noEmit`, `eslint`, secret scan, TODO grep
4. **Merge** — deduplicate findings
5. **Report** — severity table

### Running checks

If [Codex CLI](https://github.com/openai/codex) is installed, the skill uses it for sandboxed execution. Otherwise it runs `tsc` and `eslint` directly.

```bash
npm install -g @openai/codex
```

## Uninstall

```bash
rm -rf .claude/skills/codex-review
```

## License

MIT — [Pauhu AI Ltd](https://pauhu.ai)

