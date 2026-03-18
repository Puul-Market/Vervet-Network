---
description: "Engineering retrospective — snapshot what was built, what worked, what didn't"
---

# /retro: Weekly Engineering Retrospective

Generates a comprehensive engineering retrospective analyzing commit history, work patterns, and code quality metrics. Team-aware: identifies the user running the command, then analyzes every contributor with per-person praise and growth opportunities.

## Step 1: Gather Raw Data
Run these git commands in parallel to analyze the last 7 days:
```bash
git fetch origin main --quiet
git config user.name
# 1. All commits
git log origin/main --since="7 days ago" --format="%H|%aN|%ae|%ai|%s" --shortstat
# 2. Files most frequently changed (hotspot analysis)
git log origin/main --since="7 days ago" --format="" --name-only | grep -v '^$' | sort | uniq -c | sort -rn
# 3. Per-author commit counts
git shortlog origin/main --since="7 days ago" -sn --no-merges
```

## Step 2: Compute Metrics
Calculate and present a summary table:
- Commits to main
- Contributors
- Total insertions / deletions
- Active days

## Step 3: Work Session & Commit Type Detection
- Detect sessions using a 45-minute gap threshold between consecutive commits.
- Categorize by prefix (feat/fix/refactor/test/chore).
- Flag if fix ratio exceeds 50% (signals a "ship fast, fix fast" pattern indicating review gaps).

## Step 4: Team Member Analysis
For each contributor, compute:
1. **Commits and LOC**
2. **Areas of focus**
3. **Praise**: 1-2 specific things anchored in actual commits.
4. **Opportunity for growth**: 1 specific thing. Frame as a leveling-up suggestion, anchored in data.

## Step 5: Save Retro History
Save a JSON snapshot to `.context/retros/YYYY-MM-DD-N.json`.

```bash
mkdir -p .context/retros
# Determine date and save JSON snapshot
```

## Tone
- Encouraging but candid, no coddling.
- Specific and concrete — always anchor in actual commits/code.
- Praise should feel like something you'd actually say in a 1:1.
