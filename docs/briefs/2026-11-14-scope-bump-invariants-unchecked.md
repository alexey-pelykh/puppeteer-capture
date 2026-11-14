---
type: scope-brief
date: 2026-11-14
workflow: /scope
status: final
---

# Scope Brief: CI-checked invariants for the puppeteer bump procedure

## Problem

A puppeteer bump edits four files (`package.json`, `package-lock.json`, `.github/workflows/ci.yml`, `.github/workflows/publish.yml`) that must agree on the pinned version. CI does not check that they agree. `PUPPETEER_VERSION` is used only as an environment value and a cache key, and the integration job installs each tested version with `npm install --no-save`. So a wrong pin, a wrong workflow value or a missing peer range still passes all 118 integration cells (2 OS × 59 matrix entries). This has happened twice in the repository's history (`8d32d9c` and `7966135`). Neither state was tagged as a release, and both were corrected by hand. Today, at `185a1ad`, all six invariants hold.

## What's In Scope

Must:

1. **#344** — `(chore) ci: bump-invariant checker and its CI gate (state mode)`. A Node-built-ins checker `scripts/checkBumpInvariants.js` (rules I1–I7), the npm script `check:bump`, a minimum test slice, and an independent CI job `bump-invariants`.
2. **#345** — `(imp) wire the bump-invariant checker into /bump-puppeteer, with bump mode`. `/bump-puppeteer` runs the checker before it commits, and `CLAUDE.md` names the command. Bump mode (B1–B4) is built only if the owner ratifies it (Q-08). Blocked by #344.

Could (each waits on an owner decision):

3. **#346** — `(chore) ci: run the bump-invariant checker at release time`. Q-05. Blocked by #344.
4. **#347** — `(chore) dependabot: decide whether to stop separate puppeteer / puppeteer-core PRs`. Q-02. Verified during scoping: an `ignore` entry also stops Dependabot security-update PRs for those packages.

Should:

5. **#348** — `(imp) bump-invariant checker: extend tests to the full test plan`. Blocked by #344.

## Key Decisions

1. **One repository checker, shared by CI and `/bump-puppeteer`** — every council panelist recommended it. The checker reads the four files directly, so it runs where `npm ci` fails on the very lockfile mismatch it reports.
2. **CommonJS + Node built-ins, with a line-oriented YAML-subset reader that fails closed** — this avoids a new dependency, and the project's minimum Node version (22.12) cannot run `.ts` without a flag. Ratification-pending (DD-01, DD-02).
3. **CI job `bump-invariants` is independent** (no `needs`, no matrix, no `npm ci`). Whether it joins the `ci-ok` aggregate of #333 is the owner's call (Q-03). #344 AC-29 carries the conditional edit.
4. **Split into five items** (design § 14.4). Bump mode ships with its only consumer (#345). The two Could items stay separate because each waits on its own owner decision.
5. **Corrected at scope time**: the PRD and design first claimed release `1.6.0` was cut from a violating commit. `git log --decorate` shows it was not. The documents now say so.

## Stats

- **Work Items**: 5 in GitHub Issues
- **Ready**: 0/5. Stage 3.7 returned FAIL on requirement provenance, so Stage 4 did not run (see below).
- **Gaps accepted**: 0/5
- **Deferred**: 0/5

## Coverage Gate (Stage 3.7)

**Verdict: FAIL.** Two findings were blocking:

- `provenance-unratified` (open): 20 of the PRD's 26 requirements came from the council panel or the requirements run and are not owner-ratified (PRD readiness check 6, `dor_status: failed`). This closes only when the owner ratifies or rejects them. With nobody to answer, no exception was recorded and Stage 4 did not start.
- `ref-no-escape-347` (fixed): #347 pointed at "GitHub's Dependabot alerts documentation" with no link. The text now asks the reader to observe the Security tab instead. The gate was not re-run after this fix.

Non-blocking findings and their state:

- Fixed:
  - Stale "no issue yet" text in #344/#346/#347 now names #333/#334 and #339–#343.
  - Native blocked-by links added: #345, #346 and #348 blocked by #344.
  - #345's label is now `priority: high`.
  - The test-file soft dependency between #345 and #348 is declared in both bodies.
  - The Dependabot security-update finding has been carried back into the PRD, the design and the design brief.
  - Design § 5.2's definition rule now matches #344.
  - AC ids are on the scenarios of `docs/features/bump-puppeteer-precommit-check.feature.md`.
  - The conditional `ci-ok` join is now #344 AC-29.
- Persisted here: the Category Coverage table below.
- Left to the owner:
  - The appetite overflow: the Must set (#344 + #345) exceeds the proposed one day (PRD D-02).
  - The recommended downgrade of the pre-commit wiring requirement from Must to Should.
  - No item owns the PRD § 4 lagging measures (30/60/90 days) or the CI-runtime meter.
  - The proportion reading sits near its boundary (57% Must by design-grounded sizes).
- Resolved by the docs commit itself: the item bodies cite the planning documents on branch `docs/scope-council-gaps`. They become reachable once the orchestrator lands this branch there.

### Category Coverage

| Category | Status |
|---|---|
| Functional (invariants I1–I7, bump mode B1–B4) | Covered — #344, #345 |
| Error handling / fail closed | Covered — #344 (exit codes 0/1/2/3, `absent` / `unparseable`) |
| Testing | Covered — #344 minimum slice, #348 full plan, #345 bump-mode cases |
| CI integration | Covered — #344 job; `ci-ok` join conditional (#344 AC-29, Q-03) |
| Release path | Covered conditionally — #346 (Q-05) |
| Dependency update noise | Covered conditionally — #347 (Q-02) |
| Documentation | Covered — #345 (`CLAUDE.md`, `/bump-puppeteer`) |
| Security / least privilege / supply chain | Covered — #344 (`contents: read`, no secrets, no new dependency, nothing shipped in the npm package) |
| Performance | Covered — #344 (runtime ≤ 10 s target) |
| Observability / measurement | Gap on record — the PRD § 4 lagging measures have no owner |
| Accessibility, i18n, UX | N/A — developer CLI and CI tooling |
| Day-1 operational hygiene | N/A — existing project, not greenfield |

## Artifacts Produced

**Assertion**: 5/5 declared artifacts verified, 0 amended-absent, 0 repaired
**Disposition**: 0 tracked, 6 committed here, 0 ignored, 0 undeterminable, 0 left untracked, 0 filed — of 6 artifacts

- **PRD** — `docs/requirements/bump-invariants-unchecked-prd.md` [committed here]. It has 24 `shall` requirement statements and an Object Model (§ 9). `dor_status: failed` (provenance only).
- **Solution design** — `docs/design/bump-invariants-unchecked-solution-design.md` + `docs/design/bump-invariants-unchecked-design-brief.md` [committed here]. Status: draft, not locked; owner questions are open.
- **Feature files** — 2 pending stubs at `docs/features/` [committed here]: `bump-invariants-checker.feature.md` (#344), `bump-puppeteer-precommit-check.feature.md` (#345). The location is ratification-pending; the project had no feature-file convention.
- **Scope brief** — `docs/briefs/2026-11-14-scope-bump-invariants-unchecked.md` (this file) [committed here].
- **Work items** — 5 in GitHub Issues: #344, #345, #346, #347, #348.
- _No `user-stories` document_ — requirements are EARS `shall` statements plus an object model; story-shaped work is tracked as issues.

## Open owner decisions (ratification-pending)

- **Ratify or reject the 20 pipeline-introduced requirements** (PRD readiness check 6). This blocks every item's readiness.
- **Q-02**: should Dependabot ignore `puppeteer` / `puppeteer-core`? (#347; the scoping recommendation is no change.)
- **Q-03**: should the `bump-invariants` check be in the `ci-ok` aggregate? (#344 AC-29, sibling #333.)
- **Q-05**: should the release workflow run the checker? (#346; the design recommends yes.)
- **Q-06**: is rule I7 ratified? (#344.)
- **Q-08**: is bump mode ratified? (#345.)
- Lower stakes: Q-01 (latest patch per minor), Q-07 (Windows line endings), Q-T1 (prerelease pin), Q-T2 (skipped intermediate minor).
- PRD decisions D-01–D-17, design decisions DD-00–DD-14, test-plan decisions T-1–T-15, the 5-item split, and the appetite overflow.

## Relations

- **gap-phantom-required-checks**: #333 adds `ci-ok`; #334 makes it the only required check and rewrites `/bump-puppeteer` Step 2.5. Both edit the same files as #344/#345, so whichever lands second rebases.
- **gap-capture-hang**: #339–#343. These share the merge path once integration cells are required.

## Next Steps

- Owner: answer the ratification question above. Then re-run the coverage gate (`scope-quality-gate`) and the per-item readiness check (`ready-gate`) over #344–#348, and run `/do 344` once it is READY.
- `/do` with no argument — list ready items to pick from (none are ready yet).
