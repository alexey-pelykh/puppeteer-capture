---
type: design-brief
date: 2026-11-15
source: corrections-2026-11-15-solution-design.md
workflow: /scope Stage 2 → /design-solution (autonomous, no person present)
status: draft
---

# Design Brief: 2026-11-15 Corrections

## Problem

The capture-hang documents and issues #339–#342 say nothing bounds a frame request, yet puppeteer-core rejects every
CDP call after `protocolTimeout` (180 000 ms by default at 24.3.1 … 25.17.0). The README names the missing-arguments
error by its export while `err.name` holds another name. CI never tests Node 24. And the six scope document sets of
2026-11-14 carry unchecked CI, runtime and tooling claims. Readers making the pending capture-hang decisions, library
users and Node 24 users are misled or exposed.

## Key Decisions

1. **D-1** — the premise correction adds a cited paragraph and a per-call bound table, inventories, by reading, every
   sentence in the five files about how long a call waits after a stall, sorts it into one of five kinds, rewords
   the prose ones and adds a per-call note beside the ones inside requirement or decision text. It changes no requirement, decision, option name, error name or default, so no
   pending owner decision is answered.
2. **D-2** — the error-name fix is documentation plus a test; no public API change (ratification pending; PRD OQ-5).
3. **D-3** — CI adds `lts/krypton` to `build` (+2 cells) and pins `integration` to Node `26` instead of `lts/*`.
4. **D-4** — the audit corrects false claims in place only in phantom-required-checks, the one set no pending item
   freezes, and files one issue per false claim in the other five; capture-hang premise rows point at the premise
   item, the TypeScript 7 line at the owner's hold.
5. **D-5** — the audit runs as six items, one per set, each writing `docs/audits/{set}-claims-audit.md`.

## Design Tracks

| Track | Approach | Key trade-off |
|---|---|---|
| Technical Architecture | four independent pull requests, documents and tests only on the recommended routes | correctness of documents over rewriting them |
| Infrastructure (CI) | two `build` cells for Node 24; explicit Node 26 for `integration` | a pinned line needs a commit when Node 28 arrives |
| Security Architecture | security-relevant audit findings routed privately per `SECURITY.md` | the public record is knowingly incomplete on that axis |
| Testing Architecture | command checks for documents and CI, one unit test for the error name | review stands in for automation on the bound table |

## Open Questions

- **PRD OQ-1 to OQ-4** (watchdog default and off-switch, release type, #341 priority, `waitForTimeout()` on stop):
  the premise item records them as questions in the capture-hang documents. Not load-bearing for this design; they
  are the owner's, and deferring them only delays #339–#341.
- **Q-8**: if Node 24 fails a test today, does C3 land with a red cell or wait for a fix? Decide when observed;
  deferring costs nothing until then.
- **Q-9**: may the premise item add a one-line notice at the top of the #339–#342 bodies? Until the owner answers,
  comments only.

## Ratification

Product lens CONFIRM; UX lens raised one blocking concern (the premise correction left contradicting sentences),
resolved by the inventory in D-1. No person ratified: every decision is pending, and no item is built before the
owner ratifies the PRD rows it cites.

## Full Design

[`corrections-2026-11-15-solution-design.md`](corrections-2026-11-15-solution-design.md)
