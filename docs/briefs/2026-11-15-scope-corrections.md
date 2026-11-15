---
type: scope-brief
date: 2026-11-15
workflow: /scope
status: open-pending
---

# Scope Brief: 2026-11-15 corrections (capture-hang premise, error name, Node lines, scope-document claims)

## Problem

Four things in puppeteer-capture say something the code or CI does not do, or were never checked:

- The capture-hang documents and issues #339–#342 rest on "nothing bounds a frame request". In fact puppeteer-core
  rejects every CDP call after `protocolTimeout`, 180 000 ms by default at 24.3.1 and 25.17.0. Only `start()`'s
  deadlock, a `waitForTimeout()` pending when a stop ends the capture with no recorded frame failure, and the wait on
  ffmpeg's exit stay endless.
- The README names the missing-arguments error `MissingRequiredArgs`, while its `err.name` is
  `MissingHeadlessExperimentalRequiredArgs`.
- `engines.node` admits Node 24, but no CI job runs on it.
- The six scope document sets committed on 2026-11-14 state CI, runtime and tooling behaviour that nobody checked
  against its source.

## What's In Scope

1. **#354 — (docs) correct the capture-hang premise: puppeteer-core bounds each CDP call by protocolTimeout.** A
   cited bound table and a shared paragraph in the five capture-hang files. Every sentence about how long a call
   waits after a stall is inventoried by reading and sorted into five kinds; prose is reworded, protected text gets
   a per-call note on its own line. One comment on each of #339–#342 after merge.
2. **#355 — (docs) README: state the runtime err.name of each error class and hold it with a test.** Both README
   error entries state their `err.name`; one unit test asserts the class and the exact string. No API change.
3. **#356 — (chore) ci: test Node 24 and name every tested Node line.** `build` adds `lts/krypton`; `integration`
   pins Node `26` instead of `lts/*`; `CLAUDE.md` lists the three lines.
4. **#357–#362 — (docs) audit the {set} scope documents' CI, runtime and tooling claims against their sources**, one
   per set: deepmerge-alert (#357), phantom-required-checks (#358), minimatch-alert (#359), typescript-7-blocked
   (#360), bump-invariants-unchecked (#361), capture-hang (#362, blocked by #354). Each writes
   `docs/audits/{set}-claims-audit.md`.

## Held and Excluded

- **Held — the TypeScript 7 design's Node line** (`docs/design/typescript-7-adoption-solution-design.md:25` says CI
  runs Node `lts/jod` in every integration cell; integration cells run `lts/*`). The owner holds it behind the
  TypeScript 7 call (#335): no item, and #360 records it by reference to the hold.
- Not in this run: pending owner decisions on #332, #335, #338, #339–#342 and #347; edits to any existing issue.

## Key Decisions

All are pipeline defaults, ratification pending.

1. **D-1 — the premise correction answers no pending decision.** It adds facts, a bound table and notes, and changes
   no requirement, decision, option name, error name or default. The bearing on the watchdog default, release type,
   #341 priority and `waitForTimeout()` on stop becomes open-question rows.
2. **D-2 — the error name is fixed by documentation plus a test**, not by renaming or re-exporting (PRD OQ-5).
3. **D-3 — two `build` cells for Node 24 and an explicit Node 26 pin for `integration`**, not 118 more cells.
4. **D-4 — only phantom-required-checks is corrected in place**, the one set no pending item freezes. A false claim
   in any other set gets its own new issue (PRD OQ-6, OQ-7).
5. **D-5 — the audit runs as six items with one record file each.** The cardinality guard fired: the six sets hold
   more claims than one reviewable change can carry.
6. **No epic.** The repository has no epics, and the earlier scopes filed flat items linked from their brief.

## Stats

- **Work Items**: 9 in GitHub Issues (alexey-pelykh/puppeteer-capture)
- **Ready**: none certified — Stage 4 did not run (see the gate below); each item carries a ratification-pending build-gate note
- **Gaps accepted**: 0/9
- **Deferred**: 0/9

## Coverage Quality Gate (Stage 3.7)

**Verdict: FAIL** — one blocking finding is left, and only the owner can clear it: every requirement (REQ-001 to REQ-004, REQ-010, REQ-011,
REQ-020 to REQ-022, REQ-030 to REQ-035) was written by the planning pipeline rather than stated by the owner, and await the owner's ratification. Readiness
certification (Stage 4) did not begin, because the gate forbids it on an un-excepted FAIL.

Fixed after the gate, in this run, and not re-gated:

- The audits could have quoted claims about other workflows into public records. #357–#362 step 7 and AC-6, PRD
  REQ-034 and design C4 step 6 now leave out every claim about a workflow other than `.github/workflows/ci.yml`,
  whatever its verdict, and route it through the private channel `SECURITY.md` names.
- #354 now links each puppeteer-core source line it cites at the 24.3.1 and 25.17.0 tags. #356 titles its links and
  says Node 24 has been in maintenance since 2026-10-20.
- The category sweep ran: PASS-WITH-FINDINGS. The "not applicable" calls fall outside the documented library
  pattern (i18n, observability, recoverability, auth/authz, data concerns); each needs only the owner's agreement.

Open non-blocking findings: #354's Context names only the caller's `stop()` where its Specification covers any stop;
D-4's rejection of alternative (b) reads against the routing it applies; the audits judge claims at the current
baseline rather than at each set's scope commit, which interacts with #356; #358 has no route for a false claim
tied to #333 or #334; audit AC-2 samples are graded by the auditor; no item owns the PRD's D1 and G1 measurements;
REQ-035 and #362's routing differ. Two cut candidates, recommended only: the NotChromeHeadlessShell `err.name` line
in #355, and the inventory copy in #354's PR body.

## Artifacts Produced

**Assertion**: 5/6 declared artifacts verified, 1 amended-absent, 0 repaired
**Disposition**: 0 tracked, 5 committed here, 0 ignored, 0 undeterminable, 0 filed — of 5 artifacts (`T+C+G+D` partitions `S`; `F` counts filings and overlaps `G` and `D`)

- **PRD** — `docs/requirements/corrections-2026-11-15-prd.md` [committed here] — lean profile: EARS
  requirements REQ-001 to REQ-035. `dor_status: failed` on the provenance check only.
- **Requirements run report** — `docs/briefs/2026-11-15-requirements-corrections.md` [committed here]
- **Solution design** — `docs/design/corrections-2026-11-15-solution-design.md` [committed here], brief
  `docs/design/corrections-2026-11-15-brief.md` [committed here] — brief `status: draft` until the owner ratifies
  the requirements and defaults D-1 to D-5.
- **Feature files** — none (amended-absent): every item is prose or configuration work, and each acceptance
  criterion names the command or review that decides it.
- **Scope brief** — `docs/briefs/2026-11-15-scope-corrections.md` [committed here]
- **Work items** — 9 in GitHub Issues: #354–#362 (#362 blocked by #354)
- _No `user-stories` document_ — requirements are EARS; story-shaped work is tracked items.

## Next Steps

- The owner ratifies, amends or drops each requirement and the defaults D-1 to D-5, one at a time, and
  answers design questions Q-8 (a red Node 24 cell, #356) and Q-9 (a notice on #339–#342); then Stage 3.7 is re-run and Stage 4 certifies #354–#362.
- The owner confirms or overrides the five out-of-pattern "not applicable" category calls.
- `/do` #354 first once certified; #362 waits for it. #355, #356 and #357–#361 do not depend on it.
- The TypeScript 7 design's Node line stays held behind #335.
