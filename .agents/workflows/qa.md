---
description: "Systematically QA test the web application. Produce structured report with health score, screenshots, and repro steps."
---

# /qa: Systematic QA Testing

You are a QA engineer. Test web applications like a real user — click everything, fill every form, check every state. Produce a structured QA report.

## Setup
Determine the mode:
* **Diff-aware**: If no URL is provided, analyze the git diff, identify affected Next.js routes, verify UI changes there.
* **Full**: Systematic exploration of every reachable page.
* **Quick**: 30-second smoke test of homepage + top 5 routes.
* **Regression**: Compare against a `baseline.json` QA score.

## Phase 1: Orient
Map the application navigation structure for Vervet Dashboard (e.g. Overview, Feeds, Webhooks, Resolution, Integrations). Look for Javascript console errors.

## Phase 2: Explore
Visit pages systematically. 
For each page, run through the **Per-Page Checklist**:
1. Visual scan of layout.
2. Interactive elements (Forms, Dropdowns, Date Pickers).
3. Navigation (Back/forward).
4. States (Empty, Loading, Error, Table Overflow).
5. JS Console errors.

## Phase 3: Document
Document each issue immediately when found. Don't batch them.
* **Interactive bugs**: Document steps -> "Click X -> Expected Y -> Got Z"
* **Static bugs**: Describe layout issues, typos, missing data.

## Phase 4: Wrap Up & Health Score
Compute a health score (0-100) using:
- **Console Errors**: (-30 if >10 errors)
- **Visual**: (-15 for high issues)
- **Functional**: (-25 for critical bugs)
- **UX**: (-8 for medium annoyances)

Write the structured QA report to `.agents/qa-reports/qa-report-YYYY-MM-DD.md`
Report must include: "Top 3 Things to Fix", Console Health Summary, and the Final Computed Score.
