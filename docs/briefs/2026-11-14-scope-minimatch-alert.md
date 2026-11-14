---
type: scope-brief
date: 2026-11-14
workflow: /scope
status: final
---

# Scope Brief: Dependabot alert 91 (minimatch, GHSA-g3hv-75wg-m249)

## Problem

Dependabot alert 91 (GHSA-g3hv-75wg-m249, medium, "minimatch has potential denial of service via globparts amplification") is open on development-only copies of minimatch that jest and its coverage tooling pull in. Dependabot's own security update failed, and nothing recorded why the alert stays open or when it may close. The quick fix, an npm `overrides` entry, would clear the lockfile while jest's `glob@13.0.6` keeps running the matching code it bundles.

## What's In Scope

1. #338 — "(chore) Track Dependabot alert 91 (minimatch, GHSA-g3hv-75wg-m249) until upstream ships the fix". It is the one tracking record: the decision (no override, alert stays open), dated evidence, a three-clause close condition, re-check and decision-change triggers, and a first review on 2027-02-12. Priority Should (`priority: low`). Status: NOT READY until the owner ratifies its decisions.

## Key Decisions

All are ratification-pending. This was an autonomous run, and the owner confirmed only the corrective classification.

1. **No npm override; the alert stays open.** An override clears the lockfile but not the matching code bundled in `glob@13.0.6`. A test-exclude-only override leaves three in-range copies, and changing or disabling coverage leaves the lockfile unchanged.
2. **The close condition has three clauses, each checked on `main` after `npm ci`.**
   - No minimatch in `>=7.0.0 <11.0.1`. Baseline count: 5.
   - No glob below 14 on the jest or test-exclude paths. Baseline count: 4.
   - Alert 91 reads `fixed`. A fallback applies when GitHub does not resolve the alert by itself, and a dismissal never counts.
3. **The tracking issue was filed by this scoping run.** It is the tracking record itself, not a task to file a second issue.
4. **No Gherkin feature files** (typed exception ACCEPTED_GAP). The acceptance criteria are Given/When/Then with exact commands, and there is no code behaviour to bind to a test runner.
5. **A panelist's claim was corrected.** The claim was that "minimatch 11 changed the shape of `set`/`globParts`". It is not supported: 11.0.4 declares both fields with the same types as 10.2.6. Whether an override would break coverage at runtime was never tested, and the decision does not rest on it.

## Stats

- **Work Items**: 1 in GitHub Issues
- **Ready**: 0/1
- **Gaps accepted**: 1/1 (ACCEPTED_GAP: Gherkin formulation only)
- **Deferred**: 0/1 — #338 is NOT READY pending owner ratification

**Coverage gate (Stage 3.7): FAIL after two rounds.**
- The only open blocking finding is that none of the 12 PRD requirements has been ratified by the owner.
- Every other finding from both rounds was fixed.
- Stage 4 (readiness) did not run, because it is gated on Stage 3.7.

## Artifacts Produced

**Assertion**: 5/5 declared artifacts verified, 1 amended-absent, 0 repaired
**Disposition**: 0 tracked, 5 committed here, 0 ignored, 0 undeterminable, 0 left untracked — of 5 artifacts, 0 filed

- **PRD** — `docs/requirements/minimatch-alert-prd.md` [committed here], with requirements brief `docs/requirements/minimatch-alert-requirements-brief.md` [committed here]
- **Solution design** — `docs/design/minimatch-alert-solution-design.md` [committed here], with design brief `docs/design/minimatch-alert-brief.md` [committed here]
- **Feature files** — none. #338 carries the typed exception ACCEPTED_GAP.
- **Scope brief** — `docs/briefs/2026-11-14-scope-minimatch-alert.md` [committed here]
- **Work items** — 1 in GitHub Issues (#338)
- _No `user-stories` document._ Requirements are EARS statements plus an OOUX object model, and story-shaped work is tracked as items typed `story`.

## Next Steps

- **Owner:** ratify or edit decisions D-1 to D-12 on #338, and the 12 PRD requirements. Then re-run the coverage gate and the readiness check for #338.
- After ratification, run `/do 338` to post the first re-check and subscribe to the upstream pull requests.
