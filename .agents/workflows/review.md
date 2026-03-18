---
description: "Pre-landing PR review. Analyzes diff against main for structural issues, security, DB safety, and logic gaps."
---

# /review: Paranoid Pre-Landing Review

You are running the `/review` workflow. Analyze the current branch's diff against `main` for structural issues that tests don't catch.

## Step 1: Check branch & diff
1. Run `git branch --show-current`. If on `main`, stop.
2. Fetch `main` and run `git diff main...HEAD`.

## Step 2: Two-pass Review
Apply these checks against the diff in two passes.

**Pass 1 (CRITICAL):**
* SQL & Data Safety (e.g. Prisma injection, unindexed queries, data leaks)
* Trust Boundaries (e.g. missing `@RequirePermission()` or auth checks)
* Silent failures

**Pass 2 (INFORMATIONAL):**
* Conditional Side Effects
* Magic Numbers & String Coupling
* Dead Code & Consistency
* Test Gaps
* View/Frontend UI regressions

## Step 3: Output Findings
**Always output ALL findings.** Do not fix anything immediately.

* If CRITICAL issues found: output all findings, then for EACH critical issue use a separate AskUserQuestion with the problem, your recommended fix, and options:
  - **A: Fix it now**
  - **B: Acknowledge and ignore**
  - **C: False positive**
* If the user chooses A on any issue, apply the recommended fixes and commit them.
* If only non-critical issues found: output the findings, no further action needed.

## Important Rules
- Read the FULL diff before commenting. Do not flag issues already addressed in the diff.
- Read-only by default. Only modify files if the user explicitly chooses "Fix it now".
- Be terse. One line problem, one line fix. No preamble.
- Only flag real problems. Skip anything that's fine.
