---
type: design-brief
date: 2026-11-14
source: ./capture-hang-solution-design.md
workflow: /scope → /design-solution
status: draft
---

# Design Brief: Capture liveness (frame-request watchdog)

## Problem

When Chrome does not answer a `HeadlessExperimental.beginFrame`, puppeteer-capture's `start()`, `waitForTimeout()` and `stop()` wait forever, because nothing bounds a frame request. This happened twice in CI (2026-09-19 and 2026-11-14). It will block merges once every integration cell is a required check. Library users on the default `waitForFirstFrame: true` path are exposed too.

## Key Decisions

All are ratification pending. Nobody answered during this autonomous run.

1. **One deadline per logical frame (DD-01, D-05)**. The deadline covers the in-page evaluations, every `beginFrame` and every screenshot-less retry. The CDP call cannot be cancelled, so the client races it.
2. **The lock holder hears the failure on an internal signal (DD-02)**. That fixes the `start()` deadlock and keeps today's public order: capture stopped and output final, then `frameCaptureFailed`.
3. **One rethrow rule (DD-03, revised)**. Whichever call delivers the failure first, the next `stop()` rethrows the same instance once. So `try { start } finally { stop }` still surfaces the named error. Every call reports the first failure recorded (DD-08). The first version cleared the error after `start()` rejected, which let a generic error replace it.
4. **Delivery comes before cleanup (DD-06)**. `start()` and `waitForTimeout()` reject, and the event fires, once the output is final. The CDP cleanup runs afterwards, under the lock and bounded. That keeps the rejection within the watchdog plus 1 s even when the session answers nothing after the stall.
5. **First cause wins (DD-08)**. When a stall and a page close both happen, `stop()` reports whichever was recorded first.
6. **The option is bounded to 1…2 147 483 647 ms (DD-04, D-07)**. Node.js clamps a larger timer delay to 1 ms. There is no opt-out. Omitted, `undefined` or `null` means the default (DD-07).
7. **On expiry, the watchdog yields once with `setImmediate` before failing (DD-05)**. A reply that arrived while the event loop was blocked then wins over the timer. If the timer fired early, it re-arms for the remainder.
8. **A failure during a drain is reported, not dropped (DD-09)**. A stalled or rejected frame that settles while a stop drains fires `frameCaptureFailed` once, after `captureStopped`, and `stop()` rejects with the same instance.
9. **A pending `waitForTimeout()` settles when a page close, a disconnect or an ffmpeg error stops the capture (DD-10)**. It rejects with the first recorded cause, with stalled or healthy frames. Today it waits forever. A `waitForTimeout()` pending when the caller's own `stop()` ends the capture is left open for the maintainer.
10. **The setup calls of any `start()` stay unbounded (DD-11)**. Every `start()`, the first one included, makes setup calls before its first frame (the injector and `activate()` evaluates, `HeadlessExperimental.enable`), and they wait as long as the session takes. A new `start()` after a stall has bounded frames.
11. **Waits key on recorded state, not on frame events (DD-12)**. One guarded writer records every failure and tells `start()`'s first-frame wait, which also reads a failure recorded before it began. So a page close, disconnect or ffmpeg error during that wait rejects `start()`, even in the gap before a screenshot-less retry, where today it waits forever, and even when the frame would have answered, where today it resolves. Eight gate runs each found one more such gap while the rule was owned cell by cell.
12. **`detach()` waits for the lock and refuses while capturing (DD-13)**. Today a `detach()` during a capture throws from a timer callback and leaves a pending wait unsettled. Whether a stalled session still answers is OQ-02 (#343), so the documented remedy for a wedged session is a new page.
13. **Default 10 000 ms (D-01)**. That is about 60× the highest observed latency, 165 ms, and below Jest's 30 000 ms timeout.
14. **Public names `frameCaptureTimeout` and `FrameCaptureTimeout` (D-03, D-04)**. The fields `captureTimestamp`, `elapsedMs` and `timeoutMs` are stable. `frameTimeTicks`, `stage` and `screenshotlessReplies` are diagnostic.
15. **`stop()` finalises the output, then rejects with the stall (D-06)**. After a stall the recorder is reusable (D-10).
16. **The retry path's `frameTimeTicks` stays unchanged until the half-day spike reports (D-08, D-11)**.
17. **Minor version (D-09)**. The API addition is additive and the public event order is unchanged.

## Design Tracks

| Track | Approach | Key trade-off |
|---|---|---|
| Technical Architecture | Per-frame deadline in the frame loop, an internal failure signal to the lock holder, a bounded drain and bounded cleanup | A stalled CDP promise stays pending inside puppeteer-core until the session closes |
| API Design (library surface) | One optional option and one exported error class, both additive | The names become public API at release, so they need ratifying first |
| Testing Architecture | Unit tests over a mocked never-answering CDP session with real timers at 250 ms; a deadlock regression against the real class driven by a rejected first frame; one 4K manual run to check the default | Mocks prove the bound, not the Chrome-side cause; the cause is the spike's. A new page, session and ffmpeg fixture is needed |

Not run, for lack of a signal: Data, UX/IA, UI, Security, Performance, Infrastructure and Integration (reasons in the full design).

## Open Questions

| Question | Context needed to answer | Impact of deferring |
|---|---|---|
| Ratify or change D-01…D-14 and DD-01…DD-13 | Each decision with its alternatives is in the PRD § Ratification-pending decisions and in design § 12 | **Load-bearing**: names and the default become public API at release, and DD-02/DD-03 shape the code. Building on an unratified choice risks a rename or rework |
| OQ-01: does Chrome answer a stalled `beginFrame` late? | The spike's reproduction run | Not load-bearing: late replies are dropped either way |
| OQ-02: is the session usable after a stall? | The spike's reproduction run (#343, which asks about `disable`, `enable` and the setup evaluates) | Load-bearing for DD-11: the restart bound and its documented remedy depend on it. Not load-bearing for the cleanup bound, which holds either way |
| OQ-03: is the KNOWN_ISSUES `defaultViewport` freeze the same defect? | A reproducible trace of that freeze | Not load-bearing: docs frame it as an open question |
| OQ-04: stall rate per integration run | `gh run list` over integration jobs, before and after merge | Not load-bearing: it is the lagging metric for root-cause priority |

**Status**: `draft`. Load-bearing questions stand (the ratifications above), so this design is not locked.

**Dual-lens ratification**: the UX lens returned CONFIRM on the developer-facing surface (the error message, the README reference, the KNOWN_ISSUES flow). Its four non-blocking findings are folded in. The product lens first returned BLOCKING-CONCERN, with two blocking findings: the public event order, and Node's timer overflow on huge values. Both were resolved. Its re-grade confirmed both fixes but returned BLOCKING-CONCERN again on one new finding: the fix put the CDP cleanup inside the `start()` rejection time. DD-06 resolves it, and four non-blocking re-grade findings are folded in (DD-03 revised, C1 message, C2 row, C7 remedy). Its second re-grade returned **CONFIRM**. Its three non-blocking findings are folded in: the PRD Q-001 MUST now names ffmpeg finalisation, CHANGELOG gets a `### Changed` line for DD-08, and the retry advice says a new `start()` may first wait up to one watchdog duration for cleanup.

## Full Design

[`capture-hang-solution-design.md`](./capture-hang-solution-design.md). Requirements: [`../requirements/capture-hang-prd.md`](../requirements/capture-hang-prd.md).
