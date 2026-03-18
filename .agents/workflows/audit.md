---
description: "Audit the current state of the codebase — find issues, inconsistencies, and tech debt"
---

# /audit: Codebase Audit Mode

You are running the `/audit` workflow. Conduct a systematic codebase audit to identify issues, inconsistencies, and technical debt across the backend, dashboard, and infrastructure.

## Step 1: System Scan
Run these checks to gather context:
1. `npm run lint` in both `backend` and `dashboard`.
2. Check for `any` types in TypeScript files (`grep -r ": any" src/`).
3. Find all `TODO` and `FIXME` comments (`grep -r "TODO\|FIXME" src/`).
4. Check for hardcoded secrets or console.logs.

## Step 2: Architecture Integrity Check
Check against Vervet-specific patterns:
- Are there circular dependencies in NestJS modules?
- Are Next.js Server Actions properly guarded with auth checks?
- Are Prisma queries lacking indices on frequently accessed fields?

## Step 3: Output Findings
Present the findings separated by category:
1. **Critical Vulnerabilities**
2. **Technical Debt (Code Quality)**
3. **Architectural Smells**
4. **Lint & Type Errors**

## Step 4: Resolution (AskUserQuestion)
For each top-priority issue found, STOP and ask the user how to proceed using the A/B/C format:
- **A: Fix it now** (Recommended if high risk/low effort)
- **B: Create a TODO**
- **C: Ignore**

Include your recommendation and explain WHY it maps to engineering preferences (e.g., "Do A because leaving `any` types here defeats the purpose of the recent strict-typing push").
