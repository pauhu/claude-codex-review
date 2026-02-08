---
name: codex-review
description: Run a multi-phase code review. Uses Codex as second opinion if available, otherwise Claude reviews from a separate critical perspective. Use when the user asks for a code review, quality check, or wants a second opinion on code.
argument-hint: [scope]
allowed-tools: Bash(codex *), Bash(git *), Read, Grep, Glob
---

# Code Review

Review $ARGUMENTS using a two-perspective approach.

## Step 1: Determine scope

- Empty or "all" → review all uncommitted changes (`git diff` + `git diff --cached`)
- File path → review that file
- "branch" → review changes vs base branch (`git diff main...HEAD`)
- "commit" → review the latest commit (`git show HEAD`)

Read the relevant code now.

## Step 2: Get second opinion

Try these in order. Use the first one that works:

**A) Codex MCP tool** (if registered):
Call the codex tool with: "Review these code changes. List bugs, security issues, and logic errors. Be specific with file names and line numbers."

**B) Codex CLI** (if installed):
```bash
codex review --uncommitted
```

**C) Self-review from adversarial perspective** (always works):
You are now a hostile code reviewer. Your job is to find problems. Assume the code is broken until proven otherwise. Check for:
- Functions that could throw but aren't wrapped in try/catch
- Variables used before assignment
- Off-by-one errors in loops and slices
- SQL injection, XSS, command injection
- Hardcoded secrets or credentials
- Race conditions in async code
- Missing null/undefined checks
- Imports that don't exist
- Dead code paths
- Wrong return types

Be ruthless. Do not compliment the code.

## Step 3: Compare perspectives

For each finding:
1. **Severity**: CRITICAL / HIGH / MEDIUM / LOW
2. **Agree or disagree** with reasoning
3. **Fix** CRITICAL and HIGH issues you agree with immediately
4. Skip LOW findings unless trivial to fix

## Step 4: Output

```
## Code Review Results

### Findings
| # | Severity | File | Issue | Action |
|---|----------|------|-------|--------|
| 1 | CRITICAL | ... | ... | Fixed |
| 2 | HIGH     | ... | ... | Fixed |
| 3 | MEDIUM   | ... | ... | Noted |

### Summary
- Files reviewed: X
- Issues found: X
- Issues fixed: X

### Fixes Applied
- [list of changes made]
```
