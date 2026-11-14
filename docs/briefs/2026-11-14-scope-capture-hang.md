---
type: scope-brief
date: 2026-11-14
workflow: /scope
status: final
---

# Scope Brief: Capture liveness (frame-request watchdog)

## Problem

Chrome sometimes does not answer a `HeadlessExperimental.beginFrame`. When that happens, puppeteer-capture's `start()`, `waitForTimeout()` and `stop()` wait forever, because nothing bounds a frame request. This happened twice in CI, on 2026-09-19 and 2026-11-14. Both times it hit the first frame of a capture, right after the only reply in the run that had no screenshot.

A second problem sits behind the first. When a frame fails during `start()`'s first-frame wait, the existing failure path deadlocks on the start/stop lock. So even a bounded frame could not reject `start()`.

The repository owner decided that every CI integration cell will become a required check. A capture hang will then block merges, which is why this needs fixing now.

## What's In Scope

Work runs in dependency order. All five items are GitHub issues on `alexey-pelykh/puppeteer-capture`.

1. **#339** — (fix) reject `start()` when its first frame fails, instead of deadlocking on the start/stop lock. Must. Label priority high. Nothing blocks it.
2. **#340** — (fix) bound every frame capture with a watchdog that rejects with `FrameCaptureTimeout`. Must. Label priority high. Blocked by #339.
3. **#341** — (fix) bound `stop()` and its CDP cleanup after a stalled frame. Should. Label priority medium. Blocked by #340 and #339.
4. **#342** — (docs) document `FrameCaptureTimeout`, its option and the change from a hang to a rejection. Should. Label priority medium. Blocked by #340 and #341.
5. **#343** — (spike) reproduce the unanswered `beginFrame` after a screenshot-less reply, and test three hypotheses about the cause. Should. Label priority medium. Time-boxed to half a day. Nothing blocks it, and it blocks nothing.

Related, from a sibling scoping run: #333 and #334 make every integration cell a required check.

## Key Decisions

Every decision below is **ratification-pending**. Nobody answered during this autonomous run, so each one waits for the maintainer.

1. **Bound the hang; do not hide it.** No raised Jest timeout, no test retries, and no automatic re-send of a frame. Each would turn a hang into a slower hang.
2. **Fix the deadlock separately from the watchdog** (#339 before #340). The deadlock exists today for any failed first frame. The watchdog depends on that path working.
3. **One deadline per logical frame**, covering the in-page evaluation, every `beginFrame` and every screenshot-less retry (D-05, DD-01).
4. **Public names**: the option `frameCaptureTimeout` and the error `FrameCaptureTimeout` (D-03, D-04). The default is 10 000 ms (D-01). The option is valid from 1 to 2 147 483 647 ms (D-07, DD-04). Leaving it out, or passing `undefined` or `null`, means the default (DD-07).
5. **The public event order does not change.** The capture stops and the output is final, then `frameCaptureFailed` fires (DD-02).
6. **The rejection comes before the browser-side cleanup** (DD-06). A session that answers nothing after a stall does not delay the rejection.
7. **One rethrow rule** (DD-03). The next `stop()` rethrows the same error once. The first recorded failure wins (DD-08): every call that rejects reports that one.
8. **The retry path stays unchanged until the spike reports** (D-08). The cause is unknown. Two traces show a correlation, not a mechanism.
9. **Minor version** (D-09): the API change is additive.
10. **Feature-file location**: `docs/requirements/`, beside the PRD. The repository has no convention for feature files.
11. **Standalone issues** with no parent issue, following the sibling scoping runs.
12. **Priorities**: #339 and #340 Must; #341, #342 and #343 Should. #341 is Should because the stop path hangs only if the session also ignores cleanup calls after a stall, which is unverified (A-05). Must work is 49% of the ladder estimate under the gate judge's reading, under the 60% guide; another reading gives 62%. #341 also fixes two defects that exist today whatever A-05 says (decision 15), which argues for Must; as Must, Must work would be 74% to 80%, so the priority is the owner's call. The one-to-two-day appetite (D-11) is smaller than the Must work, so the owner should set it again.
13. **No throughput meter** (D-14). A unit test checks that the watchdog adds no CDP call and arms one timer per frame (#340 AC-15). CI job durations vary too much to show that.
14. **The maintainer runs the post-merge meters** (D-13). No tracked item owns them.
15. **A frame failure during a stop is reported, and a pending `waitForTimeout()` settles when a page close, a disconnect or an ffmpeg error stops the capture** (DD-09, DD-10, #341). Today the first is dropped silently and the second waits forever, with healthy frames too. A `waitForTimeout()` pending when the caller's own `stop()` ends the capture is left open for the maintainer (#341 § Out of Scope).
16. **The setup calls of any `start()`, the first one included, are bounded only while the session answers them** (DD-11). Whether a stalled session still answers is the open question #343 investigates, so the documented remedy for a wedged session is a new page, and bounding setup is a follow-up once #343 reports.
17. **Waits key on recorded state, not on frame events** (DD-12, #341 AC-10). One guarded writer records every failure and tells `start()`'s first-frame wait. Eight gate runs each found one more pending call that a trigger left waiting while the rule was owned cell by cell, so the rule moved into the writer and the waits. It changes one behaviour: a page close during `start()`'s first-frame wait now rejects `start()` even when the frame would have answered.
18. **`detach()` waits for the lock and refuses while capturing** (DD-13, #341 AC-11). Today a `detach()` during a capture throws from a timer callback and strands a pending wait.

## Stats

- **Work Items**: 5 in GitHub Issues
- **Ready**: 0/5 (Stage 4 not run: gated by the Stage 3.7 FAIL)
- **Gaps accepted**: 0/5
- **Deferred**: 0/5 (all five stay open and NOT READY until the owner answers the questions below)

## Artifacts Produced

**Assertion**: 5/5 declared artifacts verified, 0 amended-absent, 0 repaired
**Disposition**: all five documents were untracked and not ignored (`git ls-files --error-unmatch` failed, `git check-ignore` matched nothing). They are committed on the scoping branch, not pushed, for collection into `docs/scope-council-gaps`.

- **PRD** — `docs/requirements/capture-hang-prd.md` [committed]
- **Solution design** — `docs/design/capture-hang-solution-design.md` [committed], with its design brief `docs/design/capture-hang-brief.md` [committed]
- **Feature files** — 1 at `docs/requirements/capture-hang.feature.md` [committed]
- **Scope brief** — `docs/briefs/2026-11-14-scope-capture-hang.md` [committed]
- **Work items** — 5 in GitHub Issues (#339–#343)
- _No `user-stories` document_ — requirements are EARS + OOUX in the PRD; story-shaped work is tracked as items.

## Gates

**Stage 3.7 Coverage Quality Gate: FAIL** (nine runs by fresh judges). The last run's blocking findings:

- `requirements-pipeline-introduced-unratified` (owner): none of the 31 PRD requirements has been ratified. Nobody could ratify during this autonomous run, so no edit can close it.
- `start-reset-erases-failure-recorded-before-wait` and `unsendable-frame-request-narrowed-to-retry` (scoper): both were fixed after the last run, together with its eight non-blocking findings. No judge has graded the fixes yet.

**Stage 4 Readiness: not run.** It is gated by the Stage 3.7 FAIL. No item is certified READY, and no typed exception is recorded, #343's SPIKE included.

**Questions for the owner, one decision each:**

1. Ratify or change each requirement in PRD § 14 and each decision D-01…D-14 (PRD § Ratification-pending decisions).
2. Ratify or change DD-01…DD-13 (design § 12). DD-12 and DD-13 change public behaviour: a page close during `start()`'s first-frame wait now rejects `start()`, and `detach()` refuses while a capture runs.
3. Decide #341's priority: Should, as assigned, or Must. As Must, the Must share is 74–80% under every band reading. The judges also flagged three other ratification-pending choices: the KEEP-DOWNGRADEs of #342 and #343, the two category N/A rows, and the feature-file location.
4. Decide what a `waitForTimeout()` pending when the caller's own `stop()` ends the capture should settle with: resolve, or reject with a new error (#341 § Out of Scope).
5. After #343 reports, decide whether to bound the setup calls of `start()` (DD-11).

When these are answered, re-run `/scope` from Stage 3.7 against this brief's artifacts.

## Next Steps

- Ratify or change D-01…D-14 (PRD § Ratification-pending decisions) and DD-01…DD-13 (design § 12). The names and the default become public API at release.
- No item is ready, so `/do` and `/do-all` have nothing to pick until the owner answers the questions in § Gates and `/scope` is re-run from Stage 3.7.
