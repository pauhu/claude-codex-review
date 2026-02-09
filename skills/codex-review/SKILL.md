---
name: codex-review
description: "Code review: read diffs, run checks, report findings."
argument-hint: [scope]
allowed-tools: Bash(codex *), Bash(git *), Bash(npx tsc*), Bash(npx eslint*), Read, Grep, Glob
---

# Code Review

Review $ARGUMENTS.

Read the diffs. Run the checks. Report what's broken. One pass.

## Step 1: Determine scope

- Empty or "all" → `git diff` + `git diff --cached`
- File path → review that file
- "branch" → `git diff main...HEAD`
- "commit" → `git show HEAD`

Read the code first. Understand intent before judging.

## Step 2: Read (5 perspectives)

Assume the code is broken until proven otherwise.

1. **Security** — injection, auth bypass, timing attacks, secrets in code, XSS, CSRF
2. **Correctness** — logic errors, off-by-one, null/undefined, wrong types, unreachable code
3. **Compliance** — data handling, consent flows, logging gaps, retention violations
4. **Performance** — unnecessary loops, missing caching, unbounded payloads, N+1 queries
5. **Maintainability** — dead code, unclear naming, missing error handling, unused imports

## Step 3: Run checks

Run these on the changed files and report failures only:

```bash
npx tsc --noEmit 2>&1 | head -50
npx eslint --no-warn . 2>&1 | head -50
```

Also check:
- `grep -r 'TODO\|FIXME\|HACK\|XXX'` in changed files
- Hardcoded secrets: API keys, tokens, passwords in source

If you have Codex CLI available, you can run checks in its sandbox:
```bash
codex exec -s read-only "npx tsc --noEmit && npx eslint --no-warn ."
```

This is optional. Direct execution works fine for trusted repos.

## Step 4: Merge findings

Combine reading findings with check output. Deduplicate — keep the more specific version.

- **CRITICAL** / **HIGH** → fix immediately
- **MEDIUM** → note in report
- **LOW** → skip unless trivial

## Step 5: Output

```
## Code Review Results

### Findings
| # | Perspective | Severity | File | Issue | Action |
|---|-------------|----------|------|-------|--------|
| 1 | Security | CRITICAL | ... | ... | Fixed |
| 2 | Correctness | HIGH | ... | tsc: Type 'X' not assignable... | Fixed |
| 3 | Compliance | MEDIUM | ... | ... | Noted |

### Summary
- Files reviewed: X
- Findings: X
- Issues fixed: X

### Fixes Applied
- [list of changes made]
```

---
Copyright (c) 2026 Pauhu AI Ltd — MIT License — github.com/pauhu/claude-codex-review
