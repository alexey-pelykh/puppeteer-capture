---
type: requirements-brief
date: 2026-11-15
source: docs/requirements/corrections-2026-11-15-prd.md
workflow: /scope Stage 1 → /capture-requirements (autonomous, no person present)
status: draft
---

# Requirements brief: 2026-11-15 corrections

## Problem being solved

Four things in puppeteer-capture say something the code or CI does not do, or are not checked at all. The
capture-hang documents and issues #339–#342 rest on "nothing bounds a frame request", but puppeteer-core rejects
every CDP call after `protocolTimeout` (180 000 ms by default at 24.3.0, 24.3.1 and 25.17.0). The missing-arguments
error is exported as `MissingRequiredArgs` but reports `err.name` `MissingHeadlessExperimentalRequiredArgs`. CI does
not test Node 24, which `engines.node` admits. And the six scope document sets committed on 2026-11-14 carry CI,
runtime and tooling claims nobody checked against their source.

## Key requirements

1. The five capture-hang documents state the `protocolTimeout` bound (REQ-001) and, for `start()`,
   `waitForTimeout()` and `stop()`, whether a stalled frame leaves each waiting without end, with a citation each
   (REQ-002). Issues #339–#342 get one linking comment each, with no body edits (REQ-003). No pending decision is
   answered (REQ-004).
2. The README, the export and `err.name` of the missing-arguments error agree, held by a test (REQ-010); a change
   to `err.name` or the exports is logged as a public-API change (REQ-011).
3. CI tests every Node LTS line inside `engines.node` (22, 24, 26), each named explicitly, and `CLAUDE.md` lists
   them (REQ-020–REQ-022).
4. An audit record lists every CI, runtime or tooling claim in the six sets with its source and verdict
   (REQ-030); each false claim is corrected or tracked (REQ-031); documents tied to pending decisions are recorded
   and left unchanged (REQ-032); version-dependent claims are checked at the subject's version and its oldest
   supported one (REQ-033); security-relevant findings go through `SECURITY.md` (REQ-034).

## Key decisions

1. **Lean profile** — four small corrective items; ratification pending.
2. **The Stage 0 finding was itself corrected** — "the only endless wait is `start()`" is too narrow: a
   `waitForTimeout()` pending when a stop ends the capture with no recorded failure also waits without end
   (already recorded in the capture-hang design, R6/DD-10). REQ-002 asks for a cited statement per call.
3. **The TypeScript 7 doc line stays held** — the owner holds it behind #335; the audit records it only.
4. **No pending decision is answered** — the bearing of the corrected premise on the watchdog default, release type,
   #341 priority and `waitForTimeout()` on stop is written as open questions OQ-1 to OQ-4.

## Assumptions and risks

- A-1 (🟡): every CDP call the library makes is bounded by the launch `protocolTimeout`; to be traced by the item.
- A-2 (🟡): the two CI stalls were the `start()` deadlock, not an unbounded CDP call.
- R1: the correction read as answering a pending decision — guarded by REQ-004.
- R6: the audit edits a document tied to a pending decision — guarded by REQ-032.

## Stats

- Requirements: 15 (4 features); all pipeline-authored, all ratification-pending.
- Open questions: 7 (four name a pending owner decision).
- `dor_status: failed` — check 6 (provenance) only; every other check passes.

## Full requirements document

`docs/requirements/corrections-2026-11-15-prd.md`
