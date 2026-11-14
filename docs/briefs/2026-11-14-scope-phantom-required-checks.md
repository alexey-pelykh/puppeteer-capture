---
type: scope-brief
date: 2026-11-14
workflow: /scope
status: final
---

# Scope Brief: one aggregate required CI check (`ci-ok`)

## Problem

Branch protection on `main` requires two `build (… lts/iron)` checks that CI no longer runs. Every pull request is
therefore BLOCKED and is merged with an admin bypass, and the 118 `integration` cells never gate a merge. The
repository's merge instructions teach the bypass as the normal path, so a real red run looks the same as the
phantom block.

## What's In Scope

1. **#333 — (chore) ci: add aggregate `ci-ok` job over build and every integration cell.** A job that reports one
   check, `ci-ok`, concluding `success` only when `build` and every `integration` cell succeeded. Proven by a
   throwaway fault-injection draft PR before it merges.
2. **#334 — (chore) require only `ci-ok` on main and drop the `--admin` merge path.** Blocked by #333. Switch the
   required checks to `ci-ok` alone, rebase the PRs open at the switch, and rewrite the merge instructions
   (`CLAUDE.md` as the one home of the merge rule; the bump command and the memory notes link to it).

## Key Decisions

1. **The gate is build plus every integration cell** — the owner's decision of 2026-11-14. An integration hang then
   blocks a merge until its cells are re-run; the owner accepted that.
2. **One aggregate check, not 120 per-cell contexts** — per-cell contexts are what drifted into the phantom checks;
   one stable name survives every matrix change (design D-1, ratification pending).
3. **`ci-ok` always runs and fails on any non-`success` result** — GitHub reports a job skipped behind a failed
   dependency as not blocking, so the gate must never be skippable (design D-2, ratification pending).
4. **Workflow first, protection second** — switching protection before `ci-ok` exists on `main` would stall every PR
   (REQ-013, ratification pending).
5. **`enforce_admins` stays off** — with admins enforced, a stuck required check would leave no merge path. Reopen
   after 30 days of `ci-ok` as the only required check with no false red.
6. **Deferred**: removing the manual integration-cell count from the bump command (after this work and
   gap-bump-invariants-unchecked both land); fixing the capture hang (gap-capture-hang).

## Stats

- **Work Items**: 2 in GitHub Issues (alexey-pelykh/puppeteer-capture)
- **Ready**: 0/2 — not certified (see Coverage Quality Gate below)
- **Gaps accepted**: 0/2
- **Deferred**: 0/2

## Coverage Quality Gate (Stage 3.7)

**Verdict: FAIL** — one blocking finding, which only the owner can clear: six requirements were written by the
planning pipeline rather than stated by the owner, and await the owner's ratification. Readiness certification
(Stage 4) did not begin, because the gate forbids it on an un-excepted FAIL. Each issue carries a `## Readiness`
section naming what it waits for.

| Requirement | What it says | Origin | Carried by |
|---|---|---|---|
| REQ-005 | re-running failed cells re-evaluates `ci-ok` | inferred by the pipeline | #333 AC-5 |
| REQ-006 | the check name stays `ci-ok` whatever the matrix | added by the council | #333 AC-1, AC-10 |
| REQ-013 | protection switches only after `ci-ok` has reported on `main` | inferred by the pipeline | #333 AC-6, #334 AC-1 |
| REQ-020 | merge instructions prescribe a plain rebase merge, no bypass flag | added by the council | #334 AC-6 |
| REQ-021 | merge instructions say what `ci-ok` covers and what BLOCKED means | inferred by the pipeline | #334 AC-7 |
| REQ-022 | `CLAUDE.md` § Testing names `ci-ok` | inferred by the pipeline | #334 AC-7 |

Fixed during the gate (one remediation round): #333 gained criteria for a cancelled run (AC-9), name stability
under a matrix change (AC-10), the per-job result log (AC-11) and the job's security posture and duration (AC-12);
#334 gained a criterion for recording the rollback payload (AC-10); both gained a validation plan; the PRD's risk R4
now cites REQ-022 (it cited a requirement that does not exist), and its appetite now names the CI runs it needs and
a circuit breaker.

Non-blocking findings: two "not applicable" category calls fall outside the documented patterns — Portability (the
job runs only on GitHub-hosted runners) and Data concerns (nothing is stored). Each needs only the owner's
agreement.

Every other dimension passed or was not applicable: volume fits the appetite, the subtractive pass kept all three
components, granularity 7/8 for both items, forward traceability 13/13 and backward 2/2, every capability owned by
an acceptance criterion, external references verified, dependencies sound with no cycle.

## Artifacts Produced

**Assertion**: 5/5 declared artifacts verified, 0 amended-absent, 0 repaired
**Disposition**: 0 tracked, 5 committed here, 0 ignored, 0 undeterminable, 0 filed — of 5 artifacts (`T+C+G+D` partitions `S`; `F` counts filings and overlaps `G` and `D`)

- **PRD** — `docs/requirements/phantom-required-checks-prd.md` [committed here] — lean profile: 13 EARS requirements;
  the separate object model is omitted by that profile and the three objects are named in § 10. `dor_status: failed`
  on the provenance check only.
- **Solution design** — `docs/design/phantom-required-checks-solution-design.md` [committed here], brief
  `docs/design/phantom-required-checks-brief.md` [committed here] — brief `status: draft` until the owner ratifies
  the pending requirements and defaults D-1, D-2, D-3 and D-6.
- **Feature files** — 1 at `docs/requirements/phantom-required-checks.feature.md` [committed here] — for #333; #334
  takes the typed exception "configuration value change and text change". The repository had no feature-file
  location; this one sits beside the PRD.
- **Scope brief** — `docs/briefs/2026-11-14-scope-phantom-required-checks.md` [committed here]
- **Work items** — 2 in GitHub Issues: #333, #334 (native dependency: #334 blocked by #333)
- _No `user-stories` document_ — requirements are EARS; story-shaped work is tracked items.

## Next Steps

- The owner ratifies, amends or drops REQ-005, REQ-006, REQ-013, REQ-020, REQ-021 and REQ-022, one at a time; then
  Stage 3.7 is re-run and Stage 4 certifies #333 and #334.
- `/do` #333 once certified; #334 after #333 has reported `ci-ok` on `main`.
