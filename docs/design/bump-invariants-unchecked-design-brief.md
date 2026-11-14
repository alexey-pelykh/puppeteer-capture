---
type: design-brief
date: 2026-11-14
source: bump-invariants-unchecked-solution-design.md
workflow: /design-solution (Stage 2 of /scope, autonomous)
status: draft
---

# Design Brief: Puppeteer version-bump invariant checker

## Problem

A puppeteer version bump edits four files (`package.json`, `package-lock.json`, `ci.yml`, `publish.yml`). These files must agree on seven facts, and no gate checks that they do: CI tests each matrix version through `npm install --no-save` and never reads the pinned files. This has gone wrong twice in the repository's history; neither state was tagged as a release, and both were corrected by hand. This design serves the maintainer who merges bump PRs, the agent that runs `/bump-puppeteer`, and the consumers who rely on the published peer range.

## Key Decisions

All decisions are ratification-pending. They were taken in an autonomous run that nobody answered.

1. **One checker script.** It is `scripts/checkBumpInvariants.js`, CommonJS JavaScript using only Node's built-in modules. It must run on a tree where `npm ci` fails, which is exactly the lockfile-mismatch state it reports. TypeScript was rejected because Node 22.12 cannot run `.ts` without a flag, and because the `.ts` probe failed under Node 26 (DD-01).
2. **A small purpose-built YAML reader instead of a library.** It reads only four paths and fails closed on any other shape. A library would need `node_modules`. This answers PRD Q-04 (DD-02).
3. **One command for every caller.** `npm run check:bump` is what CI, the maintainer and `/bump-puppeteer` all run. The output is the same locally and in CI: no annotations, no colour (DD-06, DD-09).
4. **Bump mode takes only `--base <rev>`.** It reads the previous pin from the base revision's `package.json` and adds four change checks (B1–B4) (DD-05).
5. **A separate CI job, `bump-invariants`.** It has no matrix, no `needs`, no `npm ci`, and read-only permissions. Its job ID is the stable name that the sibling's `ci-ok` aggregate adds to its `needs:` list. The sibling owns that addition (DD-10, DD-11).
6. **Black-box tests.** A TypeScript Jest test runs the CLI as a child process against copies of the live files, with one edit per case. Each negative test checks that the reported violation IDs equal exactly the expected set (DD-03, T-1, T-2).
7. **A split into tracker items.** There are two mandatory items, plus two conditional ones waiting on owner answers (DD-14).
   - Item #1 is the minimum state-mode slice, sized for about one day.
   - If item #1 runs over, work is cut in this order: the scale test, the throwaway-PR probes, the mutants, then I7.
   - Bump mode (B1–B4) moves to item #2, beside `/bump-puppeteer`, its only consumer. It is gated on Q-08.
   - Item #1 waits for the owner to ratify the PRD's Must set.
   - The Must set spans items #1 and #2, so it runs past the one-day appetite unless the owner raises it.
   - A follow-up item #5 holds the remaining planned test cases.
8. **Four exit codes** (DD-08), so an agent knows what to do next:

   | Exit code | Meaning |
   |---|---|
   | 0 | Pass |
   | 1 | Fix the named files |
   | 2 | Fix the call or the environment |
   | 3 | Checker bug: stop and report |

   `/bump-puppeteer` stops and reports on exit 3, or on a red check that persists. Its merge gate requires `bump-invariants`. A red Dependabot puppeteer PR is closed as superseded, never hand-fixed.

## Design Tracks

| Track | Approach | Key trade-off |
|---|---|---|
| Technical | One built-ins-only script, with an invariant table and a bump mode | Owning a small YAML reader, in exchange for running where `npm ci` fails |
| API (CLI contract) | Fixed violation-line format, exit codes 0, 1 and 2, byte-identical output on every platform | No GitHub annotations on the PR, in exchange for local output equal to CI output |
| Security | `pull_request` only, `contents: read`, no secrets, `persist-credentials: false`, a constant `run:` line | A PR can still edit the checker. Review of the diff is what catches that. |
| Performance | No install step; parsing measured at 0.11 s locally | The CI job's total time is not measured yet |
| Infrastructure (CI) | An independent ubuntu job; an optional `publish.yml` step (Q-05) | The check stays advisory unless the sibling's `ci-ok` includes it (Q-03) |
| Testing | Full plan: about 104 cases (about 90 CLI, about 14 bump-mode against a git repo), a one-off historical replay, seven manual mutants, two throwaway-PR probes. Item #1's minimum slice is about 30 cases. | The tests also run inside all 118 integration cells: redundant, and an estimated 2–10 s each (not measured) |

## Open Questions

| ID | Question and context | Impact of deferring |
|---|---|---|
| Q-02 (load-bearing) | Add a Dependabot `ignore` entry for `puppeteer` and `puppeteer-core`? Dependabot opens separate PRs for the two packages, and the checker turns both red. Settled at scope time (2026-11-14, #347): GitHub's Dependabot options reference marks `ignore` as also changing security-update PRs, and this repository has security updates on, so option (a) also stops security-update PRs for these two packages. | Item #4 is not built, and two red PRs appear per release |
| Q-03 (load-bearing, sibling-owned) | Does `ci-ok` list `bump-invariants` in its `needs:`? | The check stays advisory, so a violating PR can still merge (risk DR-9) |
| Q-05 (load-bearing) | Should `publish.yml` `validate` run the checker? It is the fallback if Q-03 is answered "exclude". | Item #3 is not built |
| Q-06 (load-bearing) | Is invariant I7 (peer minors equal matrix minors) ratified? | The Must/Should set and the coverage goal (7/7 or 6/6) stay unsettled |
| Q-08 (load-bearing) | Is REQ-CHK-B-006, bump mode, ratified? It is a Should inferred by the requirements run. State mode already catches most of what it adds. | Item #2 wires state mode only, and B1–B4 stay unbuilt |
| Q-01 | Check "latest patch per minor" through the registry? | The rule stays prose-only |
| Q-T1 | Is a prerelease pin an I1 violation? The default is yes. | Matters only if a prerelease is ever pinned |
| Q-T2 | Should the checker enforce the local part of "never skip an intermediate minor"? That is, consecutive minors within each major, and a new major starting at `.0`. It needs no registry, but it would be a new requirement. | A skipped minor passes the checks |
| Q-07 | Does the Windows runner check out files with CRLF line endings? | None. The design tolerates both. |

The brief stays `draft`. Five load-bearing questions are open, and every decision is ratification-pending. The brief was also not committed by this run, so it cannot be a durable lock.

## Full Design

[`bump-invariants-unchecked-solution-design.md`](bump-invariants-unchecked-solution-design.md)
