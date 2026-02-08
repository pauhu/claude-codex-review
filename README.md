# Code Review Skill for Claude Code

Five-perspective code review: security, correctness, compliance, performance, maintainability.

## Install

```bash
mkdir -p ~/.claude/skills/codex-review
curl -sL https://raw.githubusercontent.com/pauhu/claude-codex-review/main/skills/codex-review/SKILL.md \
  -o ~/.claude/skills/codex-review/SKILL.md
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
```

## License

MIT – [Pauhu](https://pauhu.ai)
