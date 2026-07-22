# Codex Code Review Skill for Claude Code

Two-agent code review: Claude reads diffs for logic, security, and compliance bugs; Codex runs
the mechanical checks a reader can't (type checker, linter, tests). Same model, different jobs.

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
/codex-review --base develop
/codex-review --wait src/auth.ts
/codex-review --background
```

`--wait` runs in the foreground with no prompts. `--background` dispatches the review as a
background agent and writes results to `.claude/reviews/`. `--base <ref>` diffs against a ref
other than `main`. With neither flag, the skill sizes the change and asks whether to wait or run
in the background.

## How it works

1. **Scope**: determine what changed
2. **Claude reads**: adversarial review from 5 perspectives (security, correctness, compliance, performance, maintainability)
3. **Codex runs**: type checker, linter, secret scan, TODO grep
4. **Merge**: deduplicate findings from both agents, assign severity and confidence
5. **Report**: a structured findings table plus a machine-readable JSON block

### Running checks

The skill tries three methods in order: the [Codex CLI](https://github.com/openai/codex) (sandboxed execution, preferred), the Codex MCP tool, then a direct `npx tsc` / `npx eslint` fallback if neither is available.

```bash
npm install -g @openai/codex
```

### Keeping secrets out of Codex prompts

If your repo has a `.codexignore` file (same syntax as `.gitignore`), the skill honors it before
composing any Codex prompt, and always scrubs API keys, tokens, and `.env` contents from the
scope regardless.

## Uninstall

```bash
rm -rf .claude/skills/codex-review
```

## License

MIT. [Pauhu AI Ltd](https://pauhu.ai)
