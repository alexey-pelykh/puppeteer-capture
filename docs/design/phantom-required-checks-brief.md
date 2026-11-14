---
type: design-brief
date: 2026-11-14
source: ./phantom-required-checks-solution-design.md
workflow: /design-solution (via /scope)
status: draft
---

# Design Brief: CI Merge Gate (one aggregate required check)

## Problem

Branch protection on `main` requires two `build (… lts/iron)` checks that CI no longer runs, so every pull request
is BLOCKED and is merged with an admin bypass, while the 118 integration cells never gate a merge. Maintainers and
agents have learned to treat BLOCKED as noise, which hides real failures.

## Key Decisions

1. **One aggregate job `ci-ok`** (`needs: [build, integration]`) is the only required check — one stable name
   survives every matrix change, unlike per-cell contexts (D-1, author-chosen, ratification pending).
2. **`if: always()` and fail on any non-`success` result** — GitHub reports a job skipped behind a failed dependency
   as not blocking, so the gate must always run and must treat skipped and cancelled as failure (D-2,
   author-chosen, ratification pending).
3. **Keep classic branch protection**, change only its required checks, still bound to the GitHub Actions app (D-3,
   author-chosen, ratification pending).
4. **Workflow first, protection second** — switching protection before `ci-ok` exists would stall every PR (D-4,
   REQ-013).
5. **Gate = build + integration only**, not `github-pages` (D-5, owner decision of 2026-11-14).
6. **`CLAUDE.md` is the one home of the merge rule** (wait, pending versus red, triage, break-glass); the bump
   command and memory notes link to it (D-6, author-chosen, ratification pending).
7. **Open PRs are rebased right after the switch**, and the switch is rolled back if the first plain merge is not
   `CLEAN` (§ 4.3).

## Design Tracks

| Track | Approach | Key trade-off |
|---|---|---|
| Technical Architecture | one sentinel job reading the `needs` context | ten lines of inline shell instead of a third-party action |
| Infrastructure (CI/CD) | GitHub-hosted `ubuntu-24.04`, no checkout, no secrets; staged rollout | one extra short job per run |
| Security Architecture | single required context bound to app 15368; `enforce_admins` stays off | emergency bypass remains possible, now visible and measured (G1) |
| Testing Architecture | fault-injection draft PR before the switch; protection read-back after | validation runs on the real repository (no staging copy) |

## Open Questions

None load-bearing. The brief stays `draft` for a different reason: the design rests on six pipeline-authored PRD
requirements (REQ-005, REQ-006, REQ-013, REQ-020, REQ-021, REQ-022) and four author-chosen defaults (D-1, D-2, D-3,
D-6) that await the owner's one-at-a-time ratification. Both ratification lenses (product, UX) confirmed the design
on 2026-11-14. Unverified until execution: whether `gh pr checks --watch --required` waits for a required check that
has not yet reported, and whether `gh run rerun --failed` re-runs `ci-ok` (PRD A-3). Recorded and non-blocking: whether `github-pages` should later join the gate (answered "no" for
this design by the owner decision; reopen only on the owner's request) and whether `strict` should change (stays
`false`).

## Full Design

[Solution design document](./phantom-required-checks-solution-design.md)
