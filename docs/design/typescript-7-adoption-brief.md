---
type: design-brief
date: 2026-11-14
source: typescript-7-adoption-solution-design.md
workflow: /scope Stage 2 (/design-solution, autonomous)
status: draft
---

# Design Brief: TypeScript 7 Toolchain Adoption

## Problem

PR #266 (`typescript` 6.0.3 → 7.0.2) has waited since July 2026 on the belief that `ts-jest` only needs to widen its peer range. In fact TypeScript 7's `typescript` package exposes no compiler API, so `ts-jest` and the linter cannot run on it at all. Maintainers and triage agents need correct records, and the project needs a way to build with TypeScript 7 that keeps its tests and lint working.

## Key Decisions

1. **Give tools the TypeScript 6 API under the name `typescript`** — `typescript: npm:@typescript/typescript6@6.0.2`; the TypeScript team publishes it for this purpose, and the spike ran tests and lint green on it. Ratification-pending (OQ-1).
2. **Install TypeScript 7 as `typescript7: npm:typescript@7.0.2` and build only with it** — the spike showed TS 7 emits a `lib/` identical to TS 6 (0 of 24 files differ).
3. **Never call a bare `tsc`** — in the spike `node_modules/.bin/tsc` was TS 6 (a transitive copy), so a guard script resolves the TS 7 binary and fails the build unless it reports major 7.
4. **Prove the guard can fail** — a CI step points it at the TS 6 compiler and requires a non-zero exit.
5. **Type-check sources and tests with TS 7 in CI** — on both the Ubuntu and Windows build cells.
6. **Stop Dependabot re-proposing TS 7 under `typescript`** — an ignore rule; whether Dependabot updates aliased packages at all is a follow-up, with a manual bump procedure as fallback.
7. **Correct the triage records independently** — the memory note and its index line are fixed whatever the adoption decision; a #266 comment is posted only if the owner confirms it (PRD Q3), otherwise a tracked follow-up item holds it.

## Design Tracks

| Track | Approach | Key trade-off |
|---|---|---|
| Technical Architecture | two aliased TypeScript packages, one guarded build entry point, CI type-check, Dependabot ignore | a temporary second TypeScript package and a `.bin/tsc` trap, in exchange for adopting TS 7 now |
| Testing Architecture | 11 capabilities bound to exit codes, log lines and greps; no Gherkin test layer (a Tier B planning stub exists for #335); negative-path check for the guard | one-time emit diff instead of a standing CI job, so TS 6 can later leave the build path |

## Open Questions

- **OQ-1 (load-bearing)**: Adopt TypeScript 7 now through the alias, or stay on TypeScript 6 and close #266 until `ts-jest` and `typescript-eslint` run on TS 7? Context: both work; adoption costs about one day and leaves deliberate debt (two TypeScript packages) with a named retirement trigger; staying costs nothing now and keeps the build one major behind. Impact of deferring: only the record correction proceeds; #266 stays open or is closed with an ignore rule.
- **OQ-2**: Does Dependabot update npm-aliased devDependencies? Settled by the follow-up item; the ignore rule prevents the harmful case either way.
- **OQ-3**: Is a corrective comment on #266 still wanted when the adoption PR will close it? If skipped, #266 keeps the wrong diagnosis in its thread until closed.

## Full Design

See [typescript-7-adoption-solution-design.md](typescript-7-adoption-solution-design.md).
