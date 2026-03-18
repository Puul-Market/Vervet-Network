---
description: "Ship workflow: merge main, run tests, review diff, bump version, update changelog, commit, push, create PR."
---

# /ship: Fully Automated Ship Workflow

You are running the `/ship` workflow. This is a **non-interactive, fully automated** workflow. Do NOT ask for confirmation at any step unless a test fails or a CRITICAL pre-landing issue requires a decision.

// turbo-all

## Step 1: Pre-flight
- Check the current branch. If on `main`, abort: "You're on main. Ship from a feature branch."
- Run `git status` to include all uncommitted changes.
- Run `git diff main...HEAD --stat` and `git log main..HEAD --oneline`.

## Step 2: Merge origin/main
```bash
git fetch origin main && git merge origin/main --no-edit
```
If merge conflicts are complex, STOP and show them.

## Step 3: Run tests & Pre-Landing Review
Run the Vervet network test suites:
```bash
npm run test:backend 2>&1 | tee /tmp/ship_backend_tests.txt &
npm run test:dashboard 2>&1 | tee /tmp/ship_dashboard_tests.txt &
wait
```
If any test fails, show the output and **STOP**.

Run **Pre-Landing Review** (`/review` pass on the diff).
If critical issues are found, AskUserQuestion A/B/C to fix.

## Step 4: Version bump
Auto-decide bumping strategy (MICRO, PATCH, MINOR) based on lines changed, and update package.json versions if needed.

## Step 5: CHANGELOG
Auto-generate a CHANGELOG.md entry from all commits on the branch, categorizing into `Added`, `Changed`, `Fixed`, `Removed`. Do not ask the user.

## Step 6: Commit and Push
Create small, logical, bisectable commits.
First commit: Infrastructure / Config.
Second: Backend Modules.
Third: Frontend React code.
Final commit: VERSION + CHANGELOG.

Push to branch:
```bash
git push -u origin HEAD
```

## Step 7: Create PR
Use `gh pr create` with a structured PR body containing: Summary, Pre-Landing Review results, and Test Plan completion. Output the PR URL at the end.
