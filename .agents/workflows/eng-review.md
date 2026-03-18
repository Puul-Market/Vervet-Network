---
description: "Eng manager-mode plan review. Lock in the execution plan — architecture, data flow, diagrams, edge cases, test coverage, performance."
---

# /eng-review: Engineering Plan Review Mode

## Philosophy
Review the execution plan thoroughly before making any code changes. For every issue or recommendation, explain the concrete tradeoffs, give an opinionated recommendation, and ask for input using A/B/C options before assuming a direction.

## Engineering Preferences
* DRY is important.
* Well-tested code is non-negotiable.
* Bias toward explicit over clever.
* Minimal diff: fewest new abstractions and files touched.
* ASCII diagrams embedded in code comments are highly valued for complex logic.

## Step 0: Scope Challenge
Before reviewing anything, answer:
1. What existing code already solves this?
2. What is the minimum set of changes that achieves this goal?
3. Complexity Check: If it touches >8 files or >2 new modules, challenge it.

Ask the user:
* **SCOPE REDUCTION**: Propose a minimal version.
* **BIG CHANGE**: Work through interactively section by section.
* **SMALL CHANGE**: Compressed review showing the top issue from each section.

## Review Sections (Interactive)

For each section below, analyze the plan. **STOP and ask the user questions** about issues before moving to the next section. One issue per question, using A/B/C options and stating your recommendation first.

### 1. Architecture check
* Overall system design and component boundaries. For Vervet: Check NestJS circular dependencies, Next.js server actions vs API routes.
* Data flow patterns.
* Single points of failure.

### 2. Code Quality check
* DRY violations.
* Technical debt hotspots.
* Over/under engineering relative to preferences.

### 3. Test check
* Make a diagram of all new codepaths and branching outcomes.
* Ensure there is a corresponding NestJS unit test or Next.js QA pathway for each.

### 4. Performance check
* N+1 queries in Prisma.
* Memory usage concerns.
* React client-side rendering bottlenecks vs Server Component advantages.

## Required Outputs
* **NOT in scope section**: List work explicitly deferred.
* **Failure Modes Registry**: A table of `CODEPATH | FAILURE MODE | RESCUED? | TEST? | USER SEES?`
* **Completion Summary**: A quick visual table summarizing the review findings.
