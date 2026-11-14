---
type: design-brief
date: 2026-11-14
source: minimatch-alert-solution-design.md
workflow: /scope Stage 2 → /design-solution (autonomous, no person present)
status: draft
---

# Design Brief: Development-Dependency Alert Handling — minimatch (Dependabot #91)

## Problem

Dependabot alert #91 (GHSA-g3hv-75wg-m249, medium, "minimatch has potential denial of service via globparts amplification") flags development-only copies pulled in by jest and its coverage tooling, and Dependabot's own fix failed. The maintainer needs a recorded, checkable decision that keeps the alert honest until upstream releases the fix, without changing any file in the repository.

## Key Decisions

All decisions are proposed and ratification-pending.

1. **No npm override; the alert stays open; one tracking issue holds the decision (ADR-MM-1).** An override would clear the lockfile while `glob@13.0.6` keeps running its own bundled matching code, so the alert would say "fixed" about code that still runs.
2. **The issue is the single record, and every later event is a templated comment on it.** Re-checks, re-decisions, reviews, and closure all land there, so the comment history is the audit trail.
3. **Clauses (a) and (b) pass or fail by an `npm query` count that must be zero (ADR-MM-3).** `npm ls … --all` stays as the quoted evidence the PRD names. On 2026-11-14 the two selectors returned 5 and 4, matching the PRD's inventory exactly, and clause (b) correctly left out the root `glob@7.2.3`.
4. **Checks are fail-closed.** A command that errors or prints something unexpected makes its clause "unknown", which counts as unmet. Every evaluation starts from `npm ci` on `main`.
5. **Clause (c) has a fallback.** If (a) and (b) pass and the alert still reads `open`, closure records "not dismissed and no in-range copy" with both outputs. A dismissal never counts.
6. **The no-override guard works at review time, not in CI (ADR-MM-2).** A CI check or PR-template change would touch workflows or config, which the PRD excludes.
7. **Re-check triggers are noticed by habit plus subscriptions to the four upstream PRs, and misses are caught by a sweep at each 90-day review (ADR-MM-4, ADR-MM-5).** There is no automation; it reopens if the sweep finds two missed re-checks.
8. **Every re-check also runs the three decision-change triggers.** Trigger (a) is `npm query '.prod:is(#minimatch, #glob, #test-exclude)'`, which printed `[]` at baseline. Trigger (c) reads the advisory severity, which was `medium`. Trigger (b) is a reading of `jest.config.js` and the test script.
9. **The issue follows the sibling item #332's shape (ADR-MM-6).** Title: `(chore) Track Dependabot alert 91 (minimatch, GHSA-g3hv-75wg-m249) until upstream ships the fix`. Body: Why / Decision / Evidence / Close condition / Re-check triggers / Decision-change triggers / Review date / Links / Invalidated if.
10. **Labels are `dependencies`, `area: security`, `area: testing`, and `priority: low` (ADR-MM-7).** Priority ranks the maintainer's work, and there is little of it. The advisory's medium severity is stated in the body.
11. **The decision lives in the issue only, not in a `docs/decisions/` record (ADR-MM-8).** It is time-boxed and lapses at closure.
12. **The review date is an absolute date in the body (ADR-MM-9).** It is computed with `date` at filing as filing date + 90 days.
13. **The design ran four tracks: Technical Architecture, Integration, Security, and Testing.** Data, API, UX/IA, UI, Performance, and Infrastructure were left out because nothing is stored, exposed, displayed, or deployed.

## Design Tracks

| Track | Approach | Key trade-off |
|---|---|---|
| Technical Architecture | six small components (issue, evaluator, re-check protocol, trigger monitor plus re-decision record, periodic review, signal guards) anchored on one issue | manual and cheap, but it depends on one person's habit |
| Integration | read-only `npm query` / `npm ls`, `gh api`, `gh pr view`/`list`; links pulled from the live systems | `npm query` needs a fresh `npm ci`; clause (c) needs the maintainer's alert-read access |
| Security | public-safe wording rule, templates with no free-text vulnerability field, two signal guards, exposure check at each re-check | the review-time guard is weaker than a CI block, but stays within scope |
| Testing | ten-section master test plan; 12 capabilities, all acceptance-level command checks or document reads; three quality gates (filing, re-decision before a dependency change, closure) | no test code and no CI gate (TADR-1) |

## Open Questions

1. **Ratification of the PRD requirements and of ADR-MM-1…9 (load-bearing).** Every component rests on requirements the owner has not ratified: the PRD's `dor_status` is `failed` on its provenance check only. Deferring it does not block filing technically, but the issue would carry unratified decisions. To answer: confirm or edit each requirement and decision. The brief stays `draft` until this is done.
2. **Dual-lens ratification of this design (load-bearing).** A product lens and a UX lens must each confirm before the design locks. This run could not dispatch them: it was a delegate told not to hand work to other agents, and no person was present. The author's own reading is not ratification. The author considers the UX lens N/A because there is no interface, task flow, or information architecture, but a party other than the author must confirm that N/A. To answer: run both lenses, or have the owner act as one lens and record it.
3. **Commit of this brief and the design document (load-bearing for the lock).** Both files were untracked and not ignored at the end of the run: for the design document `git ls-files --error-unmatch` exited 1 and `git check-ignore -q` exited 1, and `git status --short --untracked-files=all` listed both files as `??`. This run was not allowed to commit, so the commit obligation passes to the orchestrator. An uncommitted brief cannot be `final`.
4. **Does GitHub auto-mark alert #91 `fixed` once the lockfile clears? (not load-bearing)** The clause (c) fallback covers both answers. It will be observed at closure.
5. **Is the code bundled in `glob@13.0.6` within the vulnerable range? (not load-bearing)** Clause (b) requires glob ≥ 14 either way. At worst it is stricter than needed.

## Full Design

See [minimatch-alert-solution-design.md](minimatch-alert-solution-design.md).
