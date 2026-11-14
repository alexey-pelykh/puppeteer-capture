---
type: scope-brief
date: 2026-11-14
workflow: /scope
status: final
---

# Scope Brief: TypeScript 7 adoption is blocked on a wrong diagnosis

## Problem

Dependabot PR #266 (`typescript` 6.0.3 → 7.0.2) cannot merge. The triage records say it becomes mergeable once `ts-jest` widens its peer range, but that is wrong: `typescript@7.0.2` exports only `"."` (`./lib/version.cjs`, which holds `version` and `versionMajorMinor`), `"./package.json"`, and `./unstable/*`. The JavaScript compiler API that `ts-jest` and `typescript-eslint` need is not there, so no peer-range change will unblock the PR. The project stays one TypeScript major behind until the build and the tools use separate TypeScript packages, and the records keep pointing future triage at an event that cannot help.

Source: council gap `gap-typescript-7-blocked`, owner-confirmed as a corrective route (Audit findings) on 2026-11-14.

## What's In Scope

Must:

1. #336 — (docs) Correct the TypeScript 7 diagnosis: ts-jest's peer range is not what blocks #266. Rewrites the #266 paragraph of `.claude/memory/dependabot-triage-stale-base.md` and its `MEMORY.md` index line, and names a run-based decision check. A corrective comment on #266 is posted only if the owner confirms it.

Should:

2. #335 — (imp) Build with TypeScript 7 while ts-jest and ts-standard keep the TypeScript 6 API. Aliases `typescript` to `npm:@typescript/typescript6@6.0.2`, installs `typescript7: npm:typescript@7.0.2`, routes every compile through a guard that refuses any compiler but major 7, and adds a TypeScript 7 type-check step to CI.

Could:

3. #337 — (chore) Verify Dependabot updates the aliased TypeScript packages, else document a manual bump. A time-boxed spike after #335 merges; blocked by #335.

### Requirement-to-item map

| Requirement (PRD) | Work item | Acceptance criterion |
|---|---|---|
| REQ-REC-001 — records no longer state the peer-range diagnosis | #336 | absence and presence greps, diff against the PR base |
| REQ-REC-002 — the record names a run-based decision check | #336 | decision-check outputs for 7.0.2 and the 6.0.3 control |
| REQ-REC-003 — #266 carries a superseding comment, if the owner confirms (Q3) | #336 | comment, or the recorded deferral plus a tracked follow-up |
| REQ-TC-001 — `lib/` is built only by TypeScript 7 | #335 | AC1, AC9 |
| REQ-TC-002 — the build refuses a compiler that is not TypeScript 7 | #335 | AC2, AC9 |
| REQ-TC-003 — install, lint and tests pass with no force flags | #335 | AC3 |
| REQ-TC-004 — the published output does not change | #335 | AC4, tarball regression |
| REQ-TC-005 — sources and tests type-check under TypeScript 7 | #335 | AC5 |
| REQ-DEP-001 — both TypeScript packages keep an update route | #335, #337 | #335 AC6; #337 questions 1–4 |
| REQ-DEP-002 — #266 is closed as superseded | #335 | AC8 |
| REQ-DOC-001 — the two-package layout is documented | #335 | AC7 |

## Key Decisions

1. **The diagnosis correction stands apart from the adoption decision** — #336 fixes the records whatever the owner decides about TypeScript 7, so the wrong diagnosis cannot outlive a "stay on TypeScript 6" choice.
2. **Adopt TypeScript 7 now through an npm alias (#335)** — the TypeScript team publishes `@typescript/typescript6` for tools that still need the TypeScript 6 API. A spike on revision 185a1ad showed the alias layout installs with no ERESOLVE, the unit suites and lint pass, and TypeScript 6.0.3 and 7.0.2 emit identical `lib/` output. Whether to adopt now or wait is the owner's decision (D1).
3. **Rejected: root `typescript@7` with npm `overrides` for the tools** — the spike showed `npm install` fails with ERESOLVE.
4. **A guard script, not a bare `tsc`** — under the alias layout `node_modules/.bin/tsc` is TypeScript 6, so a bare `tsc` would silently build with the wrong compiler. The guard version-checks and compiles with one resolved path, and CI proves it rejects TypeScript 6.
5. **The decision check is a run, never a peer range** — the tools support a TypeScript release only if the `ts-jest` unit suites and `npm run lint` pass against it installed without an alias. A widened peer range is a signal to re-run the check.
6. **The Dependabot ignore rule is checked after merge (#337)** — GitHub's documentation does not say how `dependency-name` matches an npm alias, so the behaviour is observed on Dependabot's first weekly run rather than assumed.
7. **Deferred**: replacing `ts-standard` / `eslint@8`, switching the Jest transform, and retiring the alias. The retirement trigger is the decision check passing for the then-current TypeScript 7 release.
8. **No execution during scoping** — PR #266 was not commented on and the memory note was not edited; both are #336's work.

## Stats

- **Work Items**: 3 in GitHub Issues (alexey-pelykh/puppeteer-capture)
- **Ready**: 0/3 — #336 is conditional GO (owner ratification of the pipeline-authored requirements); #335 waits on the owner's adoption decision and acceptance of its oracle exception; #337 is blocked by #335
- **Gaps accepted**: 1/3 — #335 carries an ACCEPTED_GAP (oracle), owner acceptance pending
- **Deferred**: 0/3

### Readiness gates

| Gate | Result |
|---|---|
| Stage 3.7 Coverage Quality Gate | Round 1 FAIL, round 2 FAIL, round 3 PASS-WITH-ACTIONS with no blocking finding. The round-3 actions were fixed in the same run and not re-graded. |
| Category coverage sweep | PASS-WITH-FINDINGS — every category is covered or N/A. Five N/A entries fall outside the library preset and await owner review: Performance Efficiency, Usability (i18n / l10n), Reliability (recoverability), Security (auth/authz), Data concerns. |
| #335 ready-gate | NOT READY — owner decision D1; owner acceptance of the ACCEPTED_GAP |
| #336 ready-gate | CONDITIONAL GO — owner ratification of the pipeline-authored requirements |
| #337 ready-gate | NOT READY — blocked by #335 |

### Awaiting owner ratification

This run was autonomous, so each decision below was taken on the default path and waits for the owner:

- D1: adopt TypeScript 7 now through the alias, or stay on TypeScript 6 and close #266 with an ignore rule.
- Acceptance of the #335 ACCEPTED_GAP (no pre-written, executor-uneditable failing check for AC2, AC4, AC5 and AC9).
- Q3: whether a public corrective comment on #266 is still wanted.
- The pipeline-authored requirements REQ-REC-002, REQ-REC-003, REQ-TC-001..005, REQ-DEP-001/002 and REQ-DOC-001 (the PRD's readiness check failed on their provenance only).
- The PRD's reframing of the gap, its appetite (one working day), and its deferrals.
- Author defaults in #335: the alias name `typescript7`, the guard path `scripts/tsc7.mjs`, the override variable `TSC7_GUARD_COMPILER`, exact pins, type-check on both OS cells, and the Dependabot ignore rule.
- MoSCoW priorities: #336 Must, #335 Should, #337 Could.
- The five out-of-preset N/A categories listed above.

## Artifacts Produced

**Assertion**: 5/5 declared artifacts verified, 0 amended-absent, 0 repaired
**Disposition**: 0 tracked, 5 committed here, 0 ignored, 0 undeterminable, 0 filed — of 5 artifacts (`T+C+G+D` partitions `S`; `F` counts filings and overlaps `G` and `D`)

- **PRD** — `docs/requirements/typescript-7-toolchain-prd.md` [committed here]
- **Solution design** — `docs/design/typescript-7-adoption-solution-design.md` [committed here], with its design brief `docs/design/typescript-7-adoption-brief.md` [committed here] (status `draft`: D1 is open)
- **Feature files** — 1 at `docs/requirements/typescript-7-toolchain.feature.md` [committed here] (Tier B, for #335)
- **Scope brief** — `docs/briefs/2026-11-14-scope-typescript-7-blocked.md` [committed here]
- **Work items** — 3 in GitHub Issues: #335, #336, #337
- _No `user-stories` document_ — requirements are EARS + OOUX in the PRD; story-shaped work is tracked items.

## Next Steps

- Owner: decide D1 and Q3 on #335 and #336, and accept or reject the #335 ACCEPTED_GAP.
- `/do 336` once the owner ratifies its requirements.
- `/do 335` after D1; #337 follows the merge of #335.
