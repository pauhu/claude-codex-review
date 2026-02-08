---
name: codex-review
description: "Two-agent code review: Claude reads (logic/security), Codex runs (tsc/lint/tests). Use when the user asks for a code review or quality check."
argument-hint: [scope]
allowed-tools: Bash(codex *), Bash(git *), Bash(npx tsc*), Bash(npx eslint*), Read, Grep, Glob
---

# Code Review – One Reads, One Runs

Review $ARGUMENTS using two complementary agents.

**Claude** reads diffs and finds logic/security/compliance bugs.
**Codex** runs mechanical checks the reader can't: type checker, linter, tests.

Same model, different jobs. Don't use Codex as a second opinion – use it as a verifier.

## Step 1: Determine scope

- Empty or "all" → `git diff` + `git diff --cached`
- File path → review that file
- "branch" → `git diff main...HEAD`
- "commit" → `git show HEAD`

Read the relevant code now. Understand intent before judging.

## Step 2: Claude reads (5 perspectives)

Review from each perspective. Be adversarial – assume the code is broken until proven otherwise.

1. **Security** – injection, auth bypass, timing attacks, secrets in code, XSS, CSRF
2. **Correctness** – logic errors, off-by-one, null/undefined, wrong types, unreachable code, broken control flow
3. **Compliance** – data handling, consent flows, logging gaps, retention violations
4. **Performance** – unnecessary loops, missing caching, unbounded payloads, N+1 queries
5. **Maintainability** – dead code, unclear naming, missing error handling, unused imports

## Step 3: Codex runs (mechanical checks)

Run these in order. Use the first Codex method that works:

**A) Codex CLI** (preferred – has sandbox, can execute):
```bash
codex --approval-policy on-failure --sandbox read-only "Run these checks on the codebase and report failures only:
1. npx tsc --noEmit (type errors)
2. npx eslint --no-warn . (lint errors only)
3. grep -r 'TODO\|FIXME\|HACK\|XXX' in changed files
4. Check for hardcoded secrets: API keys, tokens, passwords in source
Report file names, line numbers, and error messages. No commentary."
```

**B) Codex MCP tool** (if CLI unavailable):
Call the codex MCP tool with: "Run tsc --noEmit and eslint on this project. Report only errors with file names and line numbers. Do not review code logic – only report tool output."

**C) Manual fallback** (if both unavailable):
Run directly:
```bash
npx tsc --noEmit 2>&1 | head -50
npx eslint --no-warn . 2>&1 | head -50
```

## Step 4: Merge findings

Combine Claude's logical findings with Codex's mechanical findings. Deduplicate – if both found the same issue, keep the more specific one.

For each finding:
- **CRITICAL** / **HIGH** → fix immediately
- **MEDIUM** → note in report
- **LOW** → skip unless trivial

## Step 5: Output

```
## Code Review Results

### Findings
| # | Source | Perspective | Severity | File | Issue | Action |
|---|--------|-------------|----------|------|-------|--------|
| 1 | Claude | Security | CRITICAL | ... | ... | Fixed |
| 2 | Codex  | Correctness | HIGH | ... | tsc: Type 'X' not assignable... | Fixed |
| 3 | Claude | Compliance | MEDIUM | ... | ... | Noted |

### Summary
- Files reviewed: X
- Claude findings: X (logic/security/compliance)
- Codex findings: X (type errors/lint/secrets)
- Issues fixed: X

### Fixes Applied
- [list of changes made]
```

---
Copyright (c) 2026 Pauhu AI Ltd – MIT License – github.com/pauhu/claude-codex-review
