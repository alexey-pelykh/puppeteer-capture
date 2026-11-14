---
type: scope-brief
date: 2026-11-14
workflow: /scope
status: open-pending
---

# Scope Brief: Disposition of Dependabot alert 89 (deepmerge)

> `status: open-pending` — the coverage gate (Stage 3.7) failed on three requirements that wait for the owner's ratification, so readiness (Stage 4) has not run. This brief records the scope as it stands, not a finished one.

## Problem

Dependabot alert 89 (GHSA-gcqx-w48m-w2h4, `deepmerge`, severity low, development scope) has been open since 2026-10-27 with no recorded reason. Its CVE, CVE-2026-93753, was rejected on 2026-11-02 as not describing a security vulnerability. No fixed `deepmerge` version exists, and the advisory is not withdrawn. Every triage pass has to rediscover why the alert is open.

## What's In Scope

1. GitHub issue #332 — "(chore) Record a disposition for Dependabot alert 89 (deepmerge, rejected CVE-2026-93753)". Re-read four facts, stop if the CVE is no longer rejected, then apply the disposition the owner picks. Priority low.

Out of scope: any change to `package.json`, the lockfile, code or workflows; replacing `jest`; commenting upstream; a general convention for false-positive development alerts (decided once sibling gap `gap-minimatch-alert` is also handled).

## Key Decisions

Every decision below was made by an autonomous run with no person present, and is ratification-pending.

1. **One work item carries evidence, guard and disposition** — the evidence and the guard only matter at the moment of the disposition (design AD-1).
2. **Recommended disposition: dismiss now with reason `inaccurate`** — open owner decision D-1 on #332, with keep-open and dismiss-and-track as the alternatives. The fix is in scope, one API call, and reversible, so the owner's fix-or-track rule does not allow deferring it (design AD-2 open stub, AD-3).
3. **Re-read every fact at execution and stop if the CVE is no longer `REJECTED`** — REQ-DM-003 and REQ-DM-004.
4. **Full evidence on the issue; the alert comment carries the reason and citations within 280 characters** — design AD-4.
5. **No automated close rule** — REQ-DM-005, design AD-5.
6. **Who applies it** — the owner, or an agent run carrying the owner's approval (owner decision D-2 on #332).
7. **Keep or drop three acceptance criteria the run added** — AC-3, AC-4 and AC-5 trace to requirements the run inferred (REQ-DM-002, -004, -005). Owner decision D-3 on #332; recommendation: keep all three.
8. **Lean PRD profile and a small-batch appetite with a circuit breaker** — one alert, one reversible action.

## Coverage Gate (Stage 3.7)

**Verdict: FAIL.** The PRD-to-scope matrix covers all six requirements and traces the one item, but three requirements (REQ-DM-002, REQ-DM-004, REQ-DM-005) were authored by the pipeline and are not owner-ratified. Remediation: owner decision D-3 on #332, then re-run Stage 3.7 and Stage 4.

Fixed during the gate run: the appetite gained a circuit breaker; REQ-DM-001's check now names #332 instead of a text search; AC-5 now requires the reason; #332 gained a validation plan; the advisory and CVE references gained titles and an explicit no-anchor note with the load-bearing values in-band; the leading indicator L-1 is tagged as an implementation criterion.

Non-blocking findings for the owner's review:

- Seven category-coverage rows are marked N/A with the rationale "no code, dependency or runtime change", a context the coverage taxonomy does not document: performance, compatibility, i18n, maintainability, portability, cross-cutting concerns, data concerns.
- The item shows two dust indicators (no dependency edges; one API call). It has no merge target inside this scope, so it stays one item.
- No uncertainty catalog. The one open unknown, whether an advisory withdrawal closes an open alert automatically, matters only if the owner picks keep-open.
- The invariant carry-forward audit took its N/A exit because enrichment did not run on the lean route, a reason outside the audit's documented entry-path list. The one always-hold property is REQ-DM-004, carried as AC-4.

## Stats

- **Work Items**: 1 in GitHub Issues (alexey-pelykh/puppeteer-capture)
- **Ready**: 0/1 — Stage 4 not run; #332 waits on owner decision D-1
- **Gaps accepted**: 0/1
- **Deferred**: 0/1

## Artifacts Produced

**Assertion**: 3/3 declared artifacts verified, 1 amended-absent, 0 repaired
**Disposition**: 0 tracked, 4 committed here, 0 ignored, 0 undeterminable, 0 filed — of 4 artifacts (`T+C+G+D` partitions `S`; `F` counts filings and overlaps `G` and `D`)

- **PRD** — `docs/requirements/deepmerge-alert-prd.md` [committed here]
- **Solution design** — `docs/design/deepmerge-alert-solution-design.md` and its brief `docs/design/deepmerge-alert-brief.md` [committed here] — status draft, not locked: owner decision D-1 is load-bearing and the product and UX ratification lenses were not run
- **Feature files** — none — not written on this route: no item meets the Stage 3.5 trigger (a single alert-state change, priority low, no cross-component invariant)
- **Scope brief** — `docs/briefs/2026-11-14-scope-deepmerge-alert.md` [committed here]
- **Work items** — 1 in GitHub Issues: #332
- _No `user-stories` document_ — requirements are EARS + OOUX in the PRD.

The requirements run report was not written: `/capture-requirements` blocks that report while its readiness check fails, and the provenance check fails until the owner ratifies the requirements.

## Next Steps

- Owner: answer D-1, D-2 and D-3 on #332.
- Then re-enter `/scope .tmp/scopes/deepmerge-alert.md` in this worktree to re-run Stage 3.7 and Stage 4.
- Once #332 is READY: `/do #332`.
