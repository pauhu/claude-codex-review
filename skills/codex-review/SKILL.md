---
name: codex-review
description: Multi-perspective code review using Codex as second opinion. Use when the user asks for a code review or quality check.
argument-hint: [scope]
allowed-tools: Bash(codex *), Bash(git *), Read, Grep, Glob
---

# Code Review

Review $ARGUMENTS from five perspectives.

## Step 1: Scope

- Empty → `git diff` + `git diff --cached`
- File path → that file
- "branch" → `git diff main...HEAD`
- "commit" → `git show HEAD`

Read the code now.

## Step 2: Second opinion

Try in order, use first that works:

**A)** Call the codex MCP tool: "Review these changes for bugs, security issues, and logic errors. Be specific with file names and line numbers."

**B)** `codex review --uncommitted`

**C)** Review the code yourself from an adversarial perspective. Assume it is broken.

## Step 3: Five perspectives

Review from each:

1. **Security** — injection, auth bypass, secrets, XSS
2. **Correctness** — logic errors, off-by-one, null checks, wrong types
3. **Compliance** — data handling, logging, consent
4. **Performance** — unnecessary loops, missing caching, large payloads
5. **Maintainability** — dead code, unclear naming, missing error handling

## Step 4: Output

```
## Code Review Results

| # | Perspective | Severity | File | Issue | Action |
|---|-------------|----------|------|-------|--------|
| 1 | Security | CRITICAL | ... | ... | Fixed |
| 2 | Correctness | HIGH | ... | ... | Fixed |
| 3 | Performance | MEDIUM | ... | ... | Noted |

### Summary
- Files reviewed: X
- Issues found: X
- Issues fixed: X
```

Fix CRITICAL and HIGH immediately. Note MEDIUM. Skip LOW.
