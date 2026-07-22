---
name: codex-review
description: "Two-agent code review: Claude reads (logic/security), Codex runs (tsc/lint/tests). Use when the user asks for a code review or quality check."
argument-hint: "[--wait|--background] [--base <ref>] [scope]"
allowed-tools: Bash(codex *), Bash(git *), Bash(npx tsc*), Bash(npx eslint*), Read, Grep, Glob, Agent, AskUserQuestion
---

# Code Review: One Reads, One Runs

Review $ARGUMENTS using two complementary agents.

**Claude** reads diffs and finds logic/security/compliance bugs.
**Codex** runs mechanical checks the reader can't: type checker, linter, tests.

Same model, different jobs. Don't use Codex as a second opinion; use it as a verifier.

## Pre-dispatch gate: don't leak secrets to Codex

Before composing any Codex prompt, check for a `.codexignore` file in the repo root (same syntax
as `.gitignore`). If present, honor it.

- **Codex may read** the working repo except secrets, credentials, and any paths your
  `.codexignore` blocks.
- **Codex must not receive** API keys, tokens, passwords, `.env` contents, or other credential
  material. Scrub these from the diff/scope before dispatch.

If a blocked or sensitive path is in scope, remove it or narrow the prompt before dispatch.

## Step 0: Execution mode

- `--wait` in arguments: run in foreground, no questions asked
- `--background` in arguments: run via background Agent, report "Review started. Check
  `/codex-review-status` for progress."
- Neither flag: estimate scope first:
  - Run `git status --short` and `git diff --shortstat` (+ `--cached`)
  - 1-2 files: recommend foreground
  - 3+ files or unclear: recommend background
  - Ask once with AskUserQuestion: "Wait for results (Recommended)" / "Run in background"

For background runs, save results to `.claude/reviews/<timestamp>-<scope>.json`.

## Step 1: Determine scope

- Empty or "all" -> `git diff` + `git diff --cached`
- File path -> review that file
- "branch" -> `git diff main...HEAD`
- "commit" -> `git show HEAD`
- `--base <ref>` -> `git diff <ref>...HEAD`

Read the relevant code now. Understand intent before judging.

## Step 2: Claude reads (5 perspectives)

Review from each perspective. Be adversarial: assume the code is broken until proven otherwise.

1. **Security**: injection, auth bypass, timing attacks, secrets in code, XSS, CSRF
2. **Correctness**: logic errors, off-by-one, null/undefined, wrong types, unreachable code, broken control flow
3. **Compliance**: data handling, consent flows, logging gaps, retention violations
4. **Performance**: unnecessary loops, missing caching, unbounded payloads, N+1 queries
5. **Maintainability**: dead code, unclear naming, missing error handling, unused imports

## Step 3: Codex runs (mechanical checks)

Run these in order. Use the first Codex method that works:

**A) Codex CLI** (preferred, has sandbox, can execute):
```bash
codex exec -s read-only "Run these checks on the codebase and report failures only:
1. npx tsc --noEmit (type errors)
2. npx eslint --no-warn . (lint errors only)
3. grep -r 'TODO\|FIXME\|HACK\|XXX' in changed files
4. Check for hardcoded secrets: API keys, tokens, passwords in source
Report file names, line numbers, and error messages. No commentary."
```

Or use the built-in review command:
```bash
codex review --uncommitted
```

**B) Codex MCP tool** (if CLI unavailable):
Call the codex MCP tool with: "Run tsc --noEmit and eslint on this project. Report only errors
with file names and line numbers. Do not review code logic, only report tool output."

**C) Manual fallback** (if both unavailable):
Run directly:
```bash
npx tsc --noEmit 2>&1 | head -50
npx eslint --no-warn . 2>&1 | head -50
```

## Step 4: Merge findings

Combine Claude's logical findings with Codex's mechanical findings. Deduplicate: if both found
the same issue, keep the more specific one.

For each finding, assign:
- **Severity**: CRITICAL / HIGH / MEDIUM / LOW
- **Confidence**: 0.0 to 1.0 (how certain is this a real issue?)
- **Line range**: `line_start` to `line_end`
- **Recommendation**: concrete fix, not vague advice

Actions:
- CRITICAL / HIGH -> fix immediately
- MEDIUM -> note in report
- LOW -> skip unless trivial

## Step 5: Structured output

Output MUST follow this structure. The JSON block is machine-readable for job tracking.

````
## Code Review Results

**Verdict: `approve` | `needs-attention`**

### Findings

| # | Source | Perspective | Severity | Confidence | File:Lines | Issue | Recommendation |
|---|--------|-------------|----------|------------|------------|-------|----------------|
| 1 | reader | Security | CRITICAL | 0.95 | auth.rs:42-48 | ... | ... |
| 2 | runner | Correctness | HIGH | 1.00 | server.rs:120 | tsc: Type 'X'... | ... |
| 3 | reader | Compliance | MEDIUM | 0.70 | consent.rs:88-92 | ... | ... |

### Summary
- Verdict: approve / needs-attention
- Files reviewed: X
- Reader findings: X (logic/security/compliance)
- Runner findings: X (type errors/lint/secrets)
- Issues fixed: X

### Next Steps
- [ ] [actionable item 1]
- [ ] [actionable item 2]

### Fixes Applied
- [list of changes made]

<details>
<summary>Machine-readable output</summary>

```json
{
  "verdict": "approve|needs-attention",
  "scope": "working-tree|branch|commit|file",
  "base_ref": "main",
  "files_reviewed": 5,
  "findings": [
    {
      "id": 1,
      "source": "reader|runner",
      "perspective": "security|correctness|compliance|performance|maintainability",
      "severity": "critical|high|medium|low",
      "confidence": 0.95,
      "file": "src/auth.rs",
      "line_start": 42,
      "line_end": 48,
      "issue": "Description of the issue",
      "recommendation": "Concrete fix"
    }
  ],
  "next_steps": ["actionable item 1", "actionable item 2"],
  "timestamp": "2026-04-04T12:00:00Z"
}
```

</details>
````

---
Copyright (c) 2026 Pauhu AI Ltd, MIT License, github.com/pauhu/claude-codex-review
