# Solution Design: Capture liveness (frame-request watchdog)

**Status**: Draft. Fourteen decisions (D-01 to D-14, from the PRD) and thirteen design decisions (DD-01 to DD-13) wait for the maintainer to ratify them, so this design is not locked.
**Created**: 2026-11-14
**PRD**: [`docs/requirements/capture-hang-prd.md`](../requirements/capture-hang-prd.md) (`dor_status: failed`. The provenance check failed because every requirement is pipeline-authored and not yet ratified. This design runs in autonomous mode. The verdict is recorded and was not acknowledged by a person. See § 14.)
**Baseline**: `alexey-pelykh/puppeteer-capture` at `185a1ad`, read 2026-11-14T19:31:05Z.
**Tracks run**: Technical Architecture, API Design (library public surface), Testing Architecture. Not run, because their signal is absent: Data Architecture (no persistent data), UX/IA, UX Prototype, UI/Visual (no user interface), Security Architecture (no trust boundary, auth, PII or payment; PRD § 15.1), Performance Architecture (one timer per frame; the latency bound is a liveness quality attribute that § 13 covers), Infrastructure (a library, no deployment), Integration (no new external system; the one existing external dependency, CDP, is the subject of Technical Architecture).

## 1. Goals and Drivers

- **G1**: every public recorder call that waits on a frame request (`start()` with `waitForFirstFrame: true`, `waitForTimeout()`, `stop()`, `detach()` after a stall, and the internal stop on page close, session disconnect or ffmpeg error) settles in bounded time. The bound holds by one rule, not case by case: a wait settles on the recorder's recorded state, never only on a frame event (DD-12, CH-REC-B-008). Two exceptions are recorded, not hidden: the setup calls any `start()` makes before its first frame, the first start included, on a session that answers nothing (DD-11), and a `waitForTimeout()` pending when the caller's own `stop()` ends the capture with no failure recorded, left open for the maintainer (#341 § Out of Scope). A caller's `detach()` waits for a running `start()` or `stop()` and refuses while a capture runs (DD-13, CH-REC-B-009). PRD § 1, CH-REC-Q-001.
- **G2**: a stall shows up as one named, exported error whose fields say which frame stalled, at which stage, and for how long. CH-ERR-I-001, CH-ERR-I-002.
- **G3**: the root cause is investigated before the retry path changes. CH-FRQ-C-002, CH-FRQ-C-003.
- **What this does not do for CI** (product-lens finding): a stall still fails its integration cell, about 20 s sooner and with a named error instead of a Jest timeout, and the cell still needs a re-run. The fix bounds the hang and makes it diagnosable. It does not lower the stall rate. Only the root-cause work (C8, then a retry-path change) can do that, so the per-run stall rate (OQ-04) is a lagging metric to measure before and after merge.
- **Drivers**: two traced CI hangs, E1 (2026-11-14) and E2 (2026-09-19), each an unanswered `HeadlessExperimental.beginFrame`. The sibling gap `gap-phantom-required-checks` makes every integration cell a required check, so a hang will block merges. The CDP states no reply deadline (E6), so the client owns liveness.
- **Success criteria**: PRD § 4, unchanged.

## 1b. Non-Goals

- The root-cause fix of why Chrome stops answering. It is out of scope until the CH-FRQ-C-003 investigation reports (D-08).
- Telling a stalled frame apart from a crashed renderer (`targetCrashed`).
- Raising Jest's `testTimeout`, adding test retries, or re-sending `beginFrame` after expiry (CH-FRQ-C-001).
- CI required-check wiring. The sibling gap `gap-phantom-required-checks` owns it.
- macOS.
- Making the watchdog optional (D-07).

## 2. Constraints

- **Language and runtime**: TypeScript, Node.js ≥ 22.12, lint `ts-standard`, line length ≤ 120.
- **Lock**: `async-mutex` `^0.5.0`. `start()` and `stop()` hold `_startStopMutex` through their whole body (`PuppeteerCaptureBase.ts:135-136`, `:262-270`).
- **Protocol**: `HeadlessExperimental.beginFrame` cannot be cancelled once sent. Puppeteer's `CDPSession.send` has no per-call timeout or abort. So the bound has to be a race the client owns, and the pending CDP promise is left to settle or leak on its own.
- **Tests**: Jest with `ts-jest`, `testTimeout: 30000`, run with `--detectOpenHandles --forceExit`. `--detectOpenHandles` only prints: measured 2026-11-14 with Jest 30.5.2, a test leaving a 60 s timer armed exited 0 under these flags. So a leftover watchdog timer has to be asserted by the test itself (CH-FRQ-B-004).
- **Public API**: additive only. One optional option and one exported class (D-09: minor version).
- **Repository conventions**: error classes follow `src/NotChromeHeadlessShell.ts`. Commit messages are `(type) description` with no issue numbers.

## 3. Context and Scope

```text
user code ──► PuppeteerCapture (public API) ──► PuppeteerCaptureBase (lifecycle, lock, events, ffmpeg)
                                                     ▲
                                                     │ template methods (onPostCaptureStarted/Stopped, attach/detach)
                                                     │
                                 PuppeteerCaptureViaHeadlessExperimental (frame loop)
                                                     │
                                                     ▼  CDP over puppeteer-core
                           Runtime.evaluate(process(T)) per frame  ──►  HeadlessExperimental.beginFrame
                                                     │
                                                     ▼
                                          chrome-headless-shell (external, may never reply)
```

**In the boundary**: the frame loop (`doRequestFrameCapture`, `requestFrameCapture`), the failure path (`onFrameCaptureFailed`, the reaction to a failed first frame inside `_start`), the stop path (`_stop` drain, `onPostCaptureStopped`, `_detach`), the options validation, and the public exports.
**Outside the boundary**: Chrome's internals, puppeteer-core's session plumbing, ffmpeg.

## 4. Solution Strategy

1. **One deadline per logical frame (D-05).** A `FrameRequest` record is created when the frame loop begins capture timestamp T. It holds one deadline timer that is armed before the first `process(T)` evaluation. Every step of that frame races against the same deadline: each frame's `evaluate`, each `beginFrame` send, and each screenshot-less retry of that same frame. A retry never re-arms the deadline. The record is settled exactly once, as captured, failed or stalled. Any later reply finds it settled and is dropped (CH-FRQ-B-005).
2. **The lock holder hears the failure on an internal signal, and the public event keeps its order.** At `185a1ad`, `onFrameCaptureFailed` awaits `stop()` before it emits `frameCaptureFailed`. While `start()` holds the lock and waits for the first frame, that is a deadlock (E5, F10). Today's public order is "capture stopped and output final, then `frameCaptureFailed`", and callers can rely on it. So the fix keeps that order and changes only how the lock holder learns of the failure:
   - (a) Record the error, then fire a private internal signal that only `_start`'s first-frame wait listens to.
   - (b) Schedule the stop through the lock without awaiting it. That is the fire-and-forget pattern `onPageClose` already uses (`PuppeteerCaptureBase.ts:386-396`), and it emits the public `frameCaptureFailed` **after** that stop completes.
   - (c) `_start`, on the internal signal, finalises inline under the lock it already holds: the drain settles, the frames stream ends, ffmpeg exits and `captureStopped` fires. It marks the CDP cleanup as pending and then rejects. That way `start()` rejects with `isCapturing === false` (CH-REC-B-001). The scheduled task then finds nothing to stop. It emits the event, then runs the pending cleanup under the lock (DD-06).

   `waitForTimeout()` keeps listening to the public event, so it rejects only once the output is final (CH-REC-B-002). (Product-lens blocking finding 1, resolved this way rather than by changing the public ordering.)

   **Delivery comes before cleanup (DD-06).** On the `start()` and `waitForTimeout()` paths, the rejection and the event are delivered once the output is final, and the CDP cleanup runs after them, still under the lock. Users need the output to be final; they do not need the browser-side cleanup to have finished. This keeps both rejections inside the CH-REC-Q-001 bound even when the session answers nothing after the stall (A-05). Any `start()` or `stop()` that the caller issues after the rejection queues behind that cleanup, which is bounded at 1×. (Product-lens re-grade, blocking finding, option a.)

   **Waits key on recorded state (DD-12).** Every failure is recorded through one guarded writer (DD-08, #341), and that writer fires the internal signal of (a). `_start`'s first-frame wait reads a failure already recorded when it begins, and listens to the signal after. So whichever writer records the first failure, a stall, a rejected frame, a page close, a disconnect, an ffmpeg error or a frame request that cannot be sent, the lock holder hears it, finalises inline and rejects. For the rule to reach `_start`'s own awaits, `_start` registers its page `close` handler and resets the recorded failure before its first await, never after, and when `onPostCaptureStarted` finds the page or the session detached it records that failure instead of returning with no frame requested. `waitForTimeout()` settles on `captureStopped` as well as on its frame events (DD-10). Any frame request that cannot be sent, the first frame's retry or a later frame's request, fails its frame through the failure path instead of throwing inside its timer callback. The pending-state sweep in § 11a § 3d is a check of how far this rule reaches, not the place it is enforced.
3. **Bounded drain, honest stop.** `_stop`'s drain loop is bounded once every frame request settles by its deadline. A frame failure that settles during the drain, a stall or a rejected request, is recorded even though `_isCapturing` is already `false`. Today's `if (!this._isCapturing) return` early-out would swallow it. `stop()` finalises ffmpeg and then rejects with the recorded first cause (D-06, DD-08), and `frameCaptureFailed` fires once for it after `captureStopped` (DD-09).
4. **Bounded cleanup.** The CDP calls the stop path awaits after a stall run as one block, raced against one watchdog duration (§ 13): the per-frame `deactivate`/ejector evaluates and `HeadlessExperimental.disable` in `onPostCaptureStopped`, and `Page.removeScriptToEvaluateOnNewDocument` and `session.detach` in `_detach`. A cleanup timeout is swallowed. It never replaces the `FrameCaptureTimeout` as the reported error (CH-REC-B-007).
5. **The retry path is unchanged** apart from counting screenshot-less replies (CH-FRQ-C-002, D-08). The time-boxed investigation runs as its own spike.
6. **`detach()` waits for the lock and refuses while capturing (DD-13).** It takes the start/stop lock, so a running `start()`, `stop()` or pending cleanup finishes first. Then it rejects with `Capture is in progress` if a capture is still running, and otherwise detaches as at `185a1ad`. The internal stops, which already hold the lock, detach through the inner step.

**Alternatives considered** for strategy 1 and strategy 2: § 12b.

## 5. Building Blocks

| ID | Component | Location (indicative) | Responsibility | Requirements |
|---|---|---|---|---|
| C1 | `FrameCaptureTimeout` error class (name D-04) | new `src/FrameCaptureTimeout.ts`; exported from `src/index.ts` | Carries `captureTimestamp`, `frameTimeTicks`, `elapsedMs`, `timeoutMs`, `stage`, `screenshotlessReplies`. The message renders all six and ends with a remedy pointer that branches on the fields. When `stage === 'beginFrame'` and `screenshotlessReplies ≥ 1` (the E1/E2 signature), it points at KNOWN_ISSUES.md and does not suggest a larger timeout. Otherwise it suggests raising `options.frameCaptureTimeout` if frames are legitimately slow, and points at KNOWN_ISSUES.md (UX-lens finding; product-lens re-grade). It holds no screenshot data, page content or URL. | CH-ERR-I-001, CH-ERR-I-002 |
| C2 | `frameCaptureTimeout` option (name D-03) | `PuppeteerCaptureOptions`; default in `PuppeteerCaptureBase.DEFAULT_OPTIONS`; validated in the constructor next to `options.fps` | Duration in ms, default 10 000 (D-01). Construction throws on a value that is not a number from 1 to 2 147 483 647 (D-07, DD-04). Omitted, `undefined` or `null` means the default (DD-07). | CH-OPT-I-001, CH-OPT-B-002 |
| C3 | Frame deadline (`FrameRequest` record plus a small race helper) | `PuppeteerCaptureViaHeadlessExperimental` (frame loop) | Arms one timer per logical frame, covering evaluates, `beginFrame` and retries. Tracks the stage and the screenshot-less count. Settles once and clears its timer. On expiry it yields once and re-arms for the remainder if the timer fired early (DD-05). Drops late replies. Sends no `beginFrame` after it expires. A frame request that cannot be sent, a retry or a later frame's request, fails the frame through the failure path rather than throwing in its timer callback (DD-12). | CH-FRQ-B-001…005, CH-FRQ-C-002 |
| C4 | Failure-path ordering | `PuppeteerCaptureBase.onFrameCaptureFailed`, `_start` first-frame wait | Records the error and fires a private internal signal. Schedules a task through the lock without awaiting it. That task stops the capture if it is still running, emits the public `frameCaptureFailed` once with the same instance, and then runs the CDP cleanup (DD-06). `_start` listens to the internal signal, finalises inline under its own lock, marks the cleanup pending, and rejects. The event order of `185a1ad` is unchanged: capture stopped and output final, then the event. The recorded error is never cleared on delivery, so the next `stop()` rethrows the same instance once (DD-03). From #341 the one guarded writer fires the internal signal for every failure, and the first-frame wait reads a failure recorded before it began (DD-12). | CH-REC-B-001, CH-REC-B-002, CH-REC-B-005, CH-REC-B-006, CH-REC-B-008 |
| C5 | Bounded stop and cleanup | `PuppeteerCaptureBase._stop`, `PuppeteerCaptureViaHeadlessExperimental.onPostCaptureStopped` and `_detach`, `onPageClose`, `onSessionDisconnected` | The drain is bounded by C3. A frame failure during the drain is recorded, fires `frameCaptureFailed` once after `captureStopped` (DD-09), and is rethrown from `stop()` after ffmpeg finalises. A pending `waitForTimeout()` rejects when an internal stop ends the capture (DD-10). The cleanup CDP calls run as one block raced against one duration. `stop()` awaits that bounded cleanup. Internal stops on page close or disconnect inherit both bounds, so they finish within 2× the watchdog plus ffmpeg finalisation (CH-REC-B-004 as amended in PRD v1.2). `detach()` takes the lock and refuses while capturing (DD-13). | CH-REC-B-003, CH-REC-B-004, CH-REC-B-007, CH-REC-B-009 |
| C6 | Stall tests | `src/PuppeteerCaptureViaHeadlessExperimental.unit.test.ts` and `src/PuppeteerCaptureBase.test.ts` | Mocked never-answering session; the E1/E2 signature; the deadlock regression against the real class. | CH-TST-C-001…003 |
| C7 | Release documentation | `README.md` (`PuppeteerCaptureOptions` table, § Error Classes, § Methods), `KNOWN_ISSUES.md`, `CHANGELOG.md` `[Unreleased]`, release-note line | States the behaviour change and the remedy, and leaves the cause open. The remedy text branches on the diagnostic fields. Raise the option only when `elapsedMs` and the frame's measured latency show slow frames. For the E1/E2 signature (`stage: 'beginFrame'`, `screenshotlessReplies ≥ 1`), raising the timeout only makes that failure slower. Instead: capture on a new page. Calling `start()` again on the same page is allowed (D-10), though it may first wait up to one more watchdog duration while the previous capture's cleanup finishes (DD-06); its frames are bounded, but if the session is wedged (OQ-02 is open) it can fail the same way or wait on its setup calls without end (DD-11). Report the error with a `DEBUG=puppeteer:protocol:*` trace. CHANGELOG also gets `### Changed` lines: when more than one failure happens, `stop()` now reports the first one recorded (DD-08), where at `185a1ad` a later page close or disconnect overwrote an earlier error; a page close, disconnect or ffmpeg error during `start()`'s first-frame wait now rejects `start()` (DD-12); and `detach()` during a capture now rejects with `Capture is in progress` (DD-13). The README states the rejection as "after the timeout, plus the time ffmpeg takes to finalise the frames already captured", never as exactly the timeout. The existing `defaultViewport` freeze entry gets one line pointing at the new error, framed as OQ-03 (product-lens findings). The KNOWN_ISSUES entry gets a fixed heading, `### A frame capture stalls and rejects with FrameCaptureTimeout` (name per D-04), placed next to the `defaultViewport` freeze entry. The README option row and error-class entry deep-link to it. The README documents caller handling with the one rule of § 8: catch the error and treat the recording as ended; the next `stop()` rethrows the same instance once, whichever call delivered it first; a further `stop()` throws `Capture is not in progress`. It also explains `stage` by which call did not settle (`evaluate` = the in-page `process(T)` evaluation; `beginFrame` = the CDP frame request, the E1/E2 signature) and makes no claim about cause (UX-lens findings). | CH-DOC-C-001…004 |
| C8 | Root-cause investigation (spike) | written result, filed on the tracker | Controlled reproduction attempt; verdict against H1/H2/H3; answers OQ-01 and OQ-02. | CH-FRQ-C-003 |

**Entity model**: no persistent entities. The PRD § 9 object model maps one to one: Recorder → `PuppeteerCaptureBase` and its subclass. FrameRequest → C3. StallError → C1. CaptureOptions → C2. ReleaseDocs → C7. StallTestSuite → C6.

**Dependency order**: C1 and C2 are leaves. C3 depends on C1 and C2. C4 has no build dependency on C3, and its regression test can drive a rejected first frame without a watchdog. C5 depends on C3 for the drain bound. C6 tracks C3, C4 and C5. C7 depends on the ratified names (D-01, D-03, D-04). C8 is independent.

## 6. Runtime View

### 6b. System interactions

**R1: first-frame stall during `start()` (E1/E2 signature)**

```text
start() ─lock─► _start ─► ffmpeg started ─► _isCapturing=true ─► onPostCaptureStarted ─► doRequestFrameCapture(T=0)
                                                                    │ FrameRequest{T=0, ticks=0, deadline=D} armed
                                                                    ├─ evaluate process(0)            ✓
                                                                    ├─ beginFrame(ticks 0)            ✓ {hasDamage:true} (no screenshot) → screenshotless=1, retry same FrameRequest
                                                                    └─ beginFrame(ticks 0)            … no reply
_start awaits first frame ◄───────────── deadline D fires (after one setImmediate yield, still unsettled): FrameRequest settles STALLED, no further beginFrame
                          ◄─ onFrameCaptureFailed: _error=FCT; internal signal(FCT); schedule [stop-if-capturing, then emit frameCaptureFailed(FCT)] (not awaited)
_start: internal signal ─► finalise inline under the held lock (drain already settled; frames stream ended; ffmpeg exited; captureStopped) ─► mark cleanup pending ─► reject FCT
start() rejects with FCT; isCapturing === false; _error still holds FCT
scheduled task runs under the lock, sees !_isCapturing, emits frameCaptureFailed(FCT) once, then runs the pending cleanup (one block, raced against 1× watchdog)
```

**R2: stall while `waitForTimeout()` is pending.** The frame loop has captured k frames. Frame k+1's deadline fires → `onFrameCaptureFailed` records the error → the scheduled stop runs under the lock, drains (already settled), finalises ffmpeg with the k frames, emits `captureStopped` → then emits `frameCaptureFailed` → `waitForTimeout()` rejects with the same instance, and the output is already final → the same task then runs the bounded cleanup (DD-06). A later `stop()` throws the recorded error once (existing `stop()` behaviour at `PuppeteerCaptureBase.ts:263-267`).

**R3: `stop()` with an outstanding frame that stalls or is rejected.** `_stop` sets `_isCapturing=false` and drains. The frame's deadline fires within its remaining time, or the request rejects. The failure is recorded under DD-08 even though capture is stopping (strategy 3). ffmpeg is finalised, `captureStopped` is emitted, `frameCaptureFailed` fires once with the recorded first cause (DD-09), bounded cleanup runs, and `stop()` rejects with that same instance (D-06). If the page closes or the session disconnects during the drain, before the frame fails, the first cause is `Page was closed` or `Session was disconnected`, and the detach the close queued runs after `stop()` releases the lock, under its own bound. With no frame failure, `stop()` resolves as at `185a1ad`.

**R4: page close or session disconnect with an outstanding frame.** `onPageClose` or `onSessionDisconnected` schedules stop-and-detach through the lock. If a stalled `start()` holds the lock, its own wait ends within the deadline, so the queued work starts within the bound (CH-REC-B-004). `_detach`'s CDP calls are bounded.

**R6: page close or session disconnect while `waitForTimeout()` is pending.** `waitForTimeout()` holds no lock, so the internal stop runs at once: `_stop` sets `_isCapturing=false` and drains. If the frame stalls, it fails during the drain and DD-09 fires `frameCaptureFailed` with the first cause, `Page was closed` or `Session was disconnected`. If the frames are healthy, the in-flight reply is dropped and no frame event fires. Either way `captureStopped` is emitted, and `waitForTimeout()` rejects with the recorded first cause (DD-10), before the bounded cleanup runs. At `185a1ad` it waits forever in both cases, because it listens only to `frameCaptured` and `frameCaptureFailed`. A `waitForTimeout()` pending when the caller's own `stop()` ends the capture has no recorded cause; it stays out of scope (#341 § Out of Scope).

**R7: page close, disconnect or ffmpeg error in the retry gap of a waiting `start()`.** A screenshot-less first reply clears `_frameBeingCaptured` and schedules the retry. The close is recorded through the guarded writer, which fires the internal signal; the stop the close queues waits behind `start()`'s lock. `_start` hears the signal, finalises inline (nothing is in flight to drain), rejects with `Page was closed` and releases the lock. The queued task then finds nothing to stop and detaches. The retry runs, sees the recorded failure and returns, with its deadline cleared. At `185a1ad`, and with #339 and #340 alone, the retry returns the same way but nothing tells `start()`, so it waits forever (DD-12, #341 AC-10).

**R5: late reply.** The deadline has fired and the `FrameRequest` is settled. Chrome then answers the stale `beginFrame`. The reply handler sees a settled record and returns. No `frameCaptured`, no write, no second `frameCaptureFailed`.

## 8. Interface Contracts

Library public surface (the API Design track; additive):

```ts
// PuppeteerCaptureOptions (additive)
frameCaptureTimeout?: number   // ms; default 10000 (D-01); 1 ≤ value ≤ 2147483647, else the constructor throws (D-07, DD-04)

// new export from 'puppeteer-capture'
export class FrameCaptureTimeout extends Error {            // name D-04
  readonly captureTimestamp: number    // ms, capture timeline
  readonly frameTimeTicks: number      // as sent to beginFrame
  readonly elapsedMs: number           // wall clock since the FrameRequest was armed
  readonly timeoutMs: number           // the configured duration
  readonly stage: 'evaluate' | 'beginFrame'
  readonly screenshotlessReplies: number
}
```

**Field stability** (product-lens finding): `captureTimestamp`, `elapsedMs` and `timeoutMs` are the stable contract. `frameTimeTicks`, `stage` and `screenshotlessReplies` are documented as **diagnostic**. Their meaning follows the CDP and the retry path, and a future retry-path change (D-08) may change them.

**Why the upper bound** (DD-04): Node.js clamps a `setTimeout` delay above 2 147 483 647 ms to 1 ms. Measured 2026-11-14 on Node v26.13.0: `setTimeout(…, 1e10)` printed `TimeoutOverflowWarning: 10000000000 does not fit into a 32-bit signed integer. Timeout duration was set to 1.` A user reaching for a huge value as an "off switch" would instead fail every frame at once. The maximum (about 24.8 days) is documented as the effectively-off value.

**Behavioural contract**: `start()`, `waitForTimeout()` and `stop()` reject with the same `FrameCaptureTimeout` instance that `frameCaptureFailed` carries. The event fires once per stall, after the capture has stopped and the output is final, which is the same order as `185a1ad`. After a stall the recorder is not capturing, and a new `start()` is allowed (D-10). `PuppeteerCaptureEvents.frameCaptureFailed`'s `reason` type does not change.

**Caller handling after a stall** (documented by C7). One rule covers every path (DD-03): after `start()`, `waitForTimeout()` or `stop()` rejects with a frame-capture failure (a `FrameCaptureTimeout`, or any other error a frame request failed with), the next `stop()` rethrows **the same instance** once, and a further `stop()` throws `Capture is not in progress`. So in `try { await recorder.start() } finally { await recorder.stop() }`, the error that escapes is still the `FrameCaptureTimeout`, and an `instanceof` check catches it. Treat the recording as ended. A page close, disconnect or ffmpeg error during `start()`'s first-frame wait rejects `start()` with that error even when the frame would have answered (DD-12), and `detach()` rejects with `Capture is in progress` while a capture runs (DD-13). A new `start()` is allowed (D-10). Its frames are bounded, and its setup calls (the injector and `activate()` evaluates and `HeadlessExperimental.enable`) are bounded only while the session answers them (DD-11). Whether the page and CDP session can be reused is OQ-02, still open: if the new `start()` fails the same way or waits on its setup, close the page and capture on a new one.

**Constructor validation message** follows the existing `options.fps` style: `options.frameCaptureTimeout can not be set to ${value}`.

## 11. Crosscutting Concepts

- **Error handling**: one error type crosses the boundary from the frame loop to the public API. Cleanup errors after a stall are swallowed, so the first cause is the one reported. Every other existing error (`Page was closed`, `Session was disconnected`, ffmpeg errors) keeps its path. When more than one failure is recorded, the first one recorded is kept: a later stall does not overwrite `Page was closed`, and a later page close does not overwrite a recorded stall (DD-08).
- **Observability**: the six fields on C1, the `frameCaptureFailed` event, and CI's existing `DEBUG: "puppeteer:protocol:*"` (PRD § 7). No logging dependency is added.
- **Security**: N/A (PRD § 15.1). One constraint is carried: the error carries no screenshot data, page content or URL.
- **Accessibility**: N/A, no user interface.
- **Performance**: one `setTimeout`/`clearTimeout` per logical frame. No added CDP call per frame (PRD § 15.4). Checked by a unit case: a healthy capture of three or more frames logs the same sequence of CDP methods as at `185a1ad`, and arms one watchdog timer per logical frame (PRD v1.3 § 15.4, D-14).
- **Master test plan**: [§ 11a](#11a-master-test-plan).

### 11a. Master Test Plan

Authored by the testing-architect track (`test-plan-format` sections 1-10) against this design and PRD v1.2. PRD v1.3 changed only § 4 wording and § 15.4, whose check is the call-log case named in § 11 Performance.

**Status**: draft. It inherits the design's open decisions (D-01…D-14, DD-01…DD-13) and tests against PRD v1.2, plus the v1.5 additions to CH-REC-B-002, B-003 and B-004 that DD-09 and DD-10 carry. Code read at baseline `185a1ad`, 2026-11-14. Every finding at the end of this section is now applied or resolved.

**Design premises this plan tests against.** These are the decisions in the solution design that change what a test expects. All are ratification-pending.

- **DD-03 (revised).** A recorded frame-capture failure is never cleared when a call delivers it. That covers a `FrameCaptureTimeout` and any other error a frame request fails with, such as a rejected `beginFrame`. After `start()`, `waitForTimeout()` or `stop()` rejects with such an error, the next `stop()` rethrows the **same instance** once. A further `stop()` throws `Capture is not in progress`.
- **DD-04.** The option is valid only from 1 to 2 147 483 647 ms.
- **DD-05.** When the deadline fires, the recorder yields once with `setImmediate`, checks again that the frame is still unsettled, and only then fails it. If the timer fired early by `performance.now()`, the recorder re-arms for the remainder instead of failing. So `FCT.elapsedMs >= FCT.timeoutMs` holds exactly (CH-ERR-I-002).
- **DD-06.** On the `start()` and `waitForTimeout()` failure paths, the rejection and the `frameCaptureFailed` event are delivered once the output is final: the drain has settled, the frames stream has ended, ffmpeg has exited and `captureStopped` has fired. The CDP cleanup runs **after** delivery, still under the start/stop lock, and is bounded at 1 × `W`. `stop()` still awaits the cleanup. A `start()` or `stop()` issued right after the rejection queues behind that cleanup.
- **DD-07.** An omitted `frameCaptureTimeout`, or one set explicitly to `undefined` or `null`, means the default 10 000. The constructor does not throw for these (PRD v1.2 CH-OPT-B-002).
- **DD-08.** First cause wins: `_error` is written only when nothing is recorded yet. This holds for every writer: the stall or rejected frame, page close, session disconnect and the ffmpeg `error` handler. Every call that rejects with a recorded failure, `start()`, `waitForTimeout()` and `stop()`, rejects with the recorded first cause, and the `frameCaptureFailed` event, when it fires, carries that same instance (PRD CH-REC-B-005). The writer guard that makes this hold ships with #341. So when the page closes while a frame is stalled inside `start()`, `start()` rejects with `Page was closed` once the deadline frees it, and DD-03's "same instance" is that first cause.
- **DD-09.** A frame failure that settles while a stop drains, a stall or a rejected request, fires `frameCaptureFailed` once, after `captureStopped`, with the recorded first cause. On `stop()`, that is before `stop()` settles, and `stop()` rejects with the same instance. At `185a1ad` such a failure is dropped without an event.
- **DD-10.** When an internal stop (page close, session disconnect or ffmpeg error) ends the capture while `waitForTimeout()` is pending, `waitForTimeout()` rejects with the recorded first cause once `captureStopped` has fired, whether or not a frame stalled.
- **DD-11.** The setup calls any `start()` makes before its first frame, the first start included (the injector and `activate()` evaluates and `HeadlessExperimental.enable`), stay unbounded. Under DD-13 a caller's `detach()` queued behind such a `start()` waits as long. Every fixture case answers them. A setup call that rejects, as a real `frame.evaluate` on a closed page may, is not modelled: it is reasoned out of scope, because `start()` then rejects with that protocol error, which is a bound, not a hang. A `start()` on a session that answers no CDP command is out of scope until OQ-02 is answered.
- **DD-12.** A wait settles on the recorder's recorded state, never only on a frame event. The one guarded writer (DD-08) fires the internal signal for every failure; `start()`'s first-frame wait reads a failure recorded before it began and listens after, so it rejects with the first cause whichever writer recorded it, including in the screenshot-less retry gap, before a healthy answer, and during setup. A retry that cannot be sent fails its frame through the failure path.
- **DD-13.** `detach()` takes the start/stop lock: it waits for a running `start()`, `stop()` or pending cleanup, then rejects with `Capture is in progress` if a capture still runs, and otherwise detaches.
- **CH-REC-B-004 (PRD v1.2, on disk).** The internal stop on page close or disconnect is bounded by the CH-REC-B-007 bound, 2 × `W` plus ffmpeg finalisation, not by the CH-REC-Q-001 bound. A later `stop()` rejects with whichever error was recorded first (DD-08).

**Notation.** `W` is the configured watchdog duration (`frameCaptureTimeout`, D-03). `FCT` is the stall error class (`FrameCaptureTimeout`, D-04). "Real class" means `PuppeteerCaptureViaHeadlessExperimental` itself, with its real `_start`, `_stop`, frame loop and failure path, and with mocked page, CDP session and ffmpeg. "Guard" is a test-owned timer that fails the test with its own message before Jest's 30 000 ms timeout can.

#### 1. Goals and risk surface

**Goals.** The tests must show four things:

- Every public call that waits on a frame settles in bounded time: `start()`, `waitForTimeout()`, `stop()`, `detach()` after a stall, and the internal stop on page close, disconnect or ffmpeg error, with the two exceptions G1 names (DD-11 and the caller-`stop()` wait).
- A stall reaches the caller as one `FCT` instance, with the six diagnostic fields filled in.
- The lock-ordering deadlock in the failure path (PRD E5, A-07) is gone. The test runs against the real class.
- A healthy capture behaves as before: no false stall, no timer left behind, no retry-path change.

**Out of scope for verification.** The cause of the stall (C8 is a spike, not a test). Telling a stall from a renderer crash. macOS. CI required-check wiring (owned by the sibling gap `gap-phantom-required-checks`).

**Risk surface (attributes × components).** Each cell names the capability that covers it. A dash means that component does not carry that attribute.

| Attribute \ Component | C1 error | C2 option | C3 frame deadline | C4 failure ordering | C5 bounded stop and cleanup |
|---|---|---|---|---|---|
| Bounded (never hangs) | — | — | CAP-WD-ARM, CAP-WD-EXPIRE, CAP-WD-RETRY | CAP-PROP-START, CAP-PROP-WAIT | CAP-PROP-STOP, CAP-PROP-CLOSE, CAP-CLEANUP, CAP-DETACH |
| Reports one error, once | CAP-ERR | — | CAP-WD-LATE | CAP-PROP-EVENT | CAP-CLEANUP |
| Leaves clean state | — | — | CAP-WD-DISARM | CAP-PROP-REUSE | CAP-PROP-REUSE |
| Configurable and validated | — | CAP-OPT | — | — | — |
| Diagnosable | CAP-ERR | — | CAP-WD-RETRY | — | — |
| No false alarms | — | CAP-OPT | CAP-FALSE-STALL | — | — |
| Change stays inside its boundary | — | — | CAP-CONSTRAINT | — | — |

C6 (the tests) and C7 (docs) carry no runtime attribute. C7 is checked by review (§ 7, gate G4). C8 is the spike.

**Capability catalog.** Risk decides one thing later: a HIGH capability must show a red run before its fix lands (gate G0).

| CAP id | The promise it tests | Requirements | Risk | Why that risk |
|---|---|---|---|---|
| CAP-WD-ARM | One deadline is armed per logical frame, before the first `process(T)` evaluate. It covers the evaluates as well as `beginFrame`. | CH-FRQ-B-001 | MEDIUM | If the deadline starts at `beginFrame`, a hung evaluate is still unbounded. No evaluate hang has been observed. |
| CAP-WD-EXPIRE | When the deadline fires, the frame fails with `FCT`, never before `W`, and no further `beginFrame` is sent. | CH-FRQ-B-002 | HIGH | This is the core bound. Both observed hangs (E1, E2) are this case. |
| CAP-WD-RETRY | A screenshot-less reply retries under the same deadline. The E1/E2 signature reports `screenshotlessReplies === 1`. | CH-FRQ-B-003, CH-TST-C-002 | HIGH | Both observed stalls follow a screenshot-less reply (E3). A per-call deadline would never expire on an endless run of them. |
| CAP-WD-DISARM | A healthy frame clears its deadline, and so does a frame abandoned because its retry is never sent (a `stop()` in the retry gap, or a failure recorded in it, whose writer tells the waiting call, DD-12). A frame request that cannot be sent, a retry or a later frame's request, fails the frame through the failure path and clears any deadline it armed. No timer stays armed, and none fires after the frame or after `stop()`. | CH-FRQ-B-004, CH-REC-B-008 | MEDIUM | A leaked timer would raise a false `FCT` or keep the process alive. Every healthy frame passes through this path. |
| CAP-WD-LATE | A reply that arrives after the deadline is dropped. No `frameCaptured`, no write, no second event. | CH-FRQ-B-005 | MEDIUM | It is unknown whether Chrome ever answers late (OQ-01). If it does, the effect is a write to an ended stream. |
| CAP-OPT | The `frameCaptureTimeout` option defaults to 10 000, honours a set value, accepts 1 and 2 147 483 647, uses the default for an omitted option and for an explicit `undefined` or `null` (DD-07), and throws on 0, -1, NaN, Infinity and 2 147 483 648. | CH-OPT-I-001, CH-OPT-B-002 | LOW | Plain constructor logic with an existing precedent (`options.fps`). The upper bound (DD-04) stops Node from clamping a huge value to 1 ms. |
| CAP-PROP-START | `start()` with `waitForFirstFrame: true` rejects within `W + 1000` when the first frame fails, **even when no cleanup call answers** (DD-06). At rejection the output is final, `captureStopped` has fired and `isCapturing` is `false`. This includes the deadlock regression. It also rejects with the first cause when a page close, disconnect or ffmpeg error is recorded while it waits: in the screenshot-less retry gap, before a healthy answer, or during setup (DD-12). | CH-REC-B-001, CH-REC-B-008, CH-REC-Q-001, CH-TST-C-001, CH-TST-C-003 | HIGH | It is the default call path and the place where both observed stalls happened. The modelled deadlock (E5) lives here. If cleanup slips back inside the rejection, this breaks the bound at the default `W`. It also covers DD-12: a failure recorded while `start()` waits rejects it, whichever writer recorded it. |
| CAP-PROP-WAIT | A pending `waitForTimeout()` rejects within `W + 1000`, even when no cleanup call answers (DD-06). At rejection the output is final, and the frames captured before the stall are kept. | CH-REC-B-002, CH-REC-Q-001, CH-TST-C-001 | HIGH | No call reaches this path today, yet it is a public method with an unbounded wait. |
| CAP-PROP-STOP | `stop()` with a stalled frame outstanding drains within the remaining deadline, finalises ffmpeg, emits `captureStopped`, waits for the bounded cleanup, then rejects with `FCT`. Under DD-03 the next `stop()` rejects with the same `FCT` instance once, and a further `stop()` throws `Capture is not in progress`. | CH-REC-B-003, CH-REC-Q-001, CH-TST-C-001 | HIGH | Today's `!_isCapturing` early-out in the reply handler would swallow the stall (design R-2). |
| CAP-PROP-CLOSE | Page close or session disconnect during a stall finishes its internal stop and detach within 2 × `W` plus ffmpeg finalisation (PRD v1.2 CH-REC-B-004). A later `stop()` reports the error recorded **first** (DD-08), whichever order the close and the stall come in. A `waitForTimeout()` pending at the close rejects with that first cause after `captureStopped` (DD-10), with stalled or healthy frames. A `stop()` draining at the close rejects with it (R3). | CH-REC-B-004 | MEDIUM | The queued close work waits behind the lock a stalled `start()` holds. Before DD-08, the close and disconnect handlers overwrote `_error` unconditionally, so the reported error depended on timing. |
| CAP-PROP-EVENT | `frameCaptureFailed` fires exactly once per frame failure, with the same instance (`===`) that the awaiting call rejects with. It fires after `captureStopped`, which is the order at `185a1ad`. A failure that settles during a drain fires it too (DD-09). | CH-REC-B-005 | MEDIUM | The failure path is being reordered, and a late reply could emit a second time. |
| CAP-PROP-REUSE | After a stall the recorder is not capturing, ffmpeg has exited and no `start()`/`waitForTimeout()` listener is left. The next `stop()` rethrows the same `FCT` once, then throws `Capture is not in progress` (DD-03). A `start()` right after the stall waits for the pending cleanup, at most 1 × `W`, then works, while the session answers the setup calls `start()` makes (DD-11). | CH-REC-B-006, CH-REC-B-003 (DD-03) | MEDIUM | Leftover state would turn a stall into `Capture is in progress` or into a second hang. In a `try { start } finally { stop }` block, a generic error from `stop()` would replace the named one. |
| CAP-DETACH | `detach()` waits for the lock, rejects with `Capture is in progress` while a capture runs and changes nothing, and detaches once a draining `stop()` settles (DD-13). | CH-REC-B-009 | MEDIUM | At `185a1ad` `detach()` takes no lock, so a detach under a running capture throws from the next frame's timer callback and leaves a pending wait unsettled. |
| CAP-CLEANUP | When no cleanup CDP call answers after a stall, `stop()` still settles within 2 × `W` plus ffmpeg finalisation, and `FCT` stays the reported error. | CH-REC-B-007 | MEDIUM | It is unknown whether the session still answers after a stall (A-05, OQ-02). If it does not, the hang moves from the drain into cleanup. |
| CAP-ERR | `FCT` is an exported `Error` subclass whose `name` is its class name. It carries six fields, renders them in its message, and holds no page data. | CH-ERR-I-001, CH-ERR-I-002 | LOW | Simple class. The only failure that matters is a missing field or leaked content. |
| CAP-FALSE-STALL | Healthy captures never raise `FCT`, on CI or on large viewports. A reply that had already arrived while user code blocked the event loop is not a stall (DD-05). | CH-REC-Q-002 | LOW | The highest observed latency is 165 ms against a 10 000 ms default (E4). Large viewports and user hardware are unmeasured (A-04). The blocked-loop case is a hypothesis the design guards against, not an observed failure. |
| CAP-CONSTRAINT | Jest `testTimeout` stays 30000. No retries are added. The retry branch changes only by the screenshot-less counter. | CH-FRQ-C-001, CH-FRQ-C-002 | LOW | Checked mechanically at review. A breach would hide the defect instead of fixing it. |

`CH-REC-Q-001` is not its own capability. It is the timing assertion inside CAP-PROP-START, CAP-PROP-WAIT and CAP-PROP-STOP. `CH-FRQ-C-003` (investigation) and `CH-DOC-C-001…004` (docs) have no capability: § 6 shows how each is verified.

#### 2. Test pyramid composition

**System type.** A library that drives an external process (Chrome) over a protocol it does not control (CDP), plus a second child process (ffmpeg). The defect cannot be produced on demand from Chrome. That fact sets the shape.

| Layer | What it carries for this change | Why it sits here |
|---|---|---|
| Unit, real class, mocked CDP session and ffmpeg | Almost all of it: every CAP in § 1 except CAP-FALSE-STALL and CAP-CONSTRAINT. | A stall must be injected. A scripted session that never answers (`new Promise(() => {})`) gives the exact E1/E2 shape on every run, in milliseconds, on both OSes. |
| Integration, real `chrome-headless-shell` and real ffmpeg, stall injected | Two new tests (§ 3c). They cover what the mocks assume: real ffmpeg finalisation with zero and with k frames, real `page.frames()`, a live session answering the cleanup calls, and every puppeteer version in the matrix. | The unit fixture states its own assumptions (ffmpeg ends at once; the reply shape). These tests check them against real components. |
| Integration, existing healthy tests | Unchanged tests now run with a default deadline armed on every frame. | They are the pre-merge false-stall net (CAP-FALSE-STALL) and the healthy-path regression net (R-1 in the design). |
| Review checks | CAP-CONSTRAINT, docs (CH-DOC-C-001…003), the traceability orphan check. | These are properties of the diff, not of runtime. |
| One validation run | A-04: one 3840×2160 capture with the latency recorded (§ 7, gate G5). | It informs a decision (D-01). It is not a regression test. |
| Post-merge meter | CAP-FALSE-STALL over 30 days, and the Jest-timeout count (PRD § 4). | A real stall cannot be reproduced before merge. Only CI history can show whether real stalls now end as `FCT`. |

**Why not more integration.** A real-Chrome stall test would depend on reproducing the root cause. That is C8's open question, and PRD CH-TST-C-001 excludes it ("BUT NOT a test that depends on reproducing a real Chrome stall").

#### 3. gTAA layers and framework selection

| Layer | Decision | Tool or pattern | Rationale |
|---|---|---|---|
| Generation | Hand-written from the PRD acceptance criteria. Each test's oracle values (bounds, field values, `===` identity) are copied from the PRD, never read off the implementation. | Manual, spec-derived | The same author is likely to write both the fix and its tests (§ 10, R-T3). Spec-derived oracles keep the tests independent of the code's own assumptions. |
| Definition | Jest with ts-jest. New stall tests go in the files design C6 names, plus one new per-module file for the error class. | `*.test.ts` co-located in `src/` | This follows the repository. No new framework, so no Test ADR. |
| Execution | `npm run test` unchanged: `--runInBand --coverage --detectOpenHandles --forceExit`, `testTimeout: 30000`. Real timers. | Local, then the CI matrix | Per CH-FRQ-C-001. Timers: TD-01 below. |
| Adaptation | A scripted fixture, local to the test file: page, frames, session, page client and a per-call ffmpeg mock (§ 3a). | Hand-built `jest.fn` doubles | Puppeteer and fluent-ffmpeg are external. The recorder is the subject, so it stays real. |

**Test decisions.** Each is local to this plan and reversible in one change, so none gets an ADR file. This matches how the design records DD-01 and DD-02.

| ID | Decision | Alternatives considered and why each lost |
|---|---|---|
| TD-01 | **Real timers** for every stall test. `W = 250 ms` in unit tests (the PRD METER), with elapsed time measured by `performance.now()`. | *Jest fake timers.* Lost on three counts. (1) The PRD METER for CH-REC-Q-001 says real timers. Under fake timers the "elapsed" value is whatever the test advanced, so the timing assertion would measure the test's own input. (2) The frame loop reschedules itself with `setTimeout(…, 0)` (`PuppeteerCaptureViaHeadlessExperimental.ts:168`, `:178`), and `async-mutex` queues on promises. Fake timers would need `advanceTimersByTimeAsync` steps written to match the implementation's order. The test would then encode the code under test, and a deadlocked path would look the same as a clock nobody advanced: both just stay pending. That defeats CH-TST-C-003, whose point is to fail by its own bound. (3) Fake timers are not real handles, so `--detectOpenHandles` could never see a leaked deadline. Real timers keep the leak observable, though § 3b shows Jest's report alone cannot fail the run. **Cost:** each stall test spends real time. At `W = 250` that is well under the 5 s per test that CH-TST-C-001 allows, and far under Jest's 30 000 ms. |
| TD-02 | **Guard race.** Every awaited call in a stall test is wrapped as `settlesWithin(promise, GUARD_MS, label)`. The helper rejects with `Error(\`${label} still pending after ${GUARD_MS} ms\`)` and clears its own timer in `finally`. `GUARD_MS = 3000`. | *Rely on Jest's 30 s timeout.* Lost: it is ten times slower to fail, and its message names nothing. *Lower each test's own timeout (`test(…, 3000)`).* Lost: Jest's timeout message does not say which call hung, and a test that never cleans up still blocks Jest. |
| TD-03 | **Fixture lives in the test file**, not in a shared helper module. | *A shared helper under `src/`.* Lost: `tsconfig.json` compiles all of `src` except `**/*.test.ts` into `lib/`, so a helper would ship in the package. A helper can move to a shared test file later if a second file needs it. |
| TD-04 | **Integration stall injection** wraps the recorder's own `capture['_session'].send`. The wrapper returns `new Promise(() => {})` for `HeadlessExperimental.beginFrame` from frame k on, and passes every other call through. | *Intercept at the Chrome or network level.* Lost: Chrome's behaviour cannot be steered there. The private-field access has precedent: the existing disconnect test emits on `capture['_session']` (`PuppeteerCaptureViaHeadlessExperimental.test.ts`, the "session connection drop" test). |

##### 3a. The unit fixture (Adaptation layer)

`createStallFixture(options)` builds the real class's collaborators. This is new work: no such fixture exists today (finding F-1). What it must provide:

- **Platform.** In `beforeEach`, set `process.platform` to `'linux'`. Restore it in `afterEach`, using the existing pattern (`PuppeteerCaptureViaHeadlessExperimental.unit.test.ts:8-12`). The constructor throws on `darwin`, and the maintainer develops on macOS.
- **Page.** `browser()` returns a process whose `spawnfile` contains `chrome-headless-shell` and whose `spawnargs` are `REQUIRED_ARGS`. `createCDPSession()` returns the session. `_client()` returns a page client: its `send` answers `Page.addScriptToEvaluateOnNewDocument` with `{ identifier }` and answers or hangs `Page.removeScriptToEvaluateOnNewDocument` per option, and its `detached` is `false`. `frames()` returns `options.frames` frame doubles (default 1). `isClosed()` returns `false`. `once`, `on` and `off` record their handlers, so a test can fire `close`. `url()` returns the sentinel `https://sentinel.invalid/secret-path`.
- **Frames.** `evaluate(expr)` answers at once by default. `options.evaluate` can script it per expression: hang on the first `process(` call, or hang on `deactivate()` and the ejector after the stall. Every call is logged with `performance.now()`. **The log entry for a frame's first `process(T)` evaluate is that frame's start time**, the start of the PRD's SCALE.
- **Session.** `send(method)` dispatches by method. `HeadlessExperimental.enable` answers. `HeadlessExperimental.beginFrame` follows `options.beginFrame`, a list consumed one entry per call. Each entry is one of: `{ screenshotData: 'ZnJhbWU=' }` (healthy), `{ hasDamage: true }` (screenshot-less, the E1/E2 reply shape), `'never'` (returns `new Promise(() => {})`), an `Error` (rejects), or a deferred the test resolves later. After the list runs out, every call is healthy. `HeadlessExperimental.disable` answers or hangs per option. `on` and `off` record handlers, so a test can fire `CDPSession.Disconnected`. `connection()` returns a non-null object. `detached` is `false`. `detach()` answers or hangs per option. Every call is logged with its time.
- **ffmpeg (`jest.mock('fluent-ffmpeg')`).** This is the module mock from `PuppeteerCaptureBase.test.ts:8-43`, with three changes the real class needs:
  1. `ffmpeg()` returns a **fresh stream double per call**. The existing mock is one shared object whose `run()` calls the first recorded `start` handler. A second `start()` in one test (CAP-PROP-REUSE) would call the first, stale handler and hang.
  2. `input(stream)` keeps the `PassThrough`, consumes it, and counts the bytes and writes it receives.
  3. When that stream finishes, the mock calls the registered `end` handler on the next tick. Without this, `_stop` waits forever at `await this._ffmpegExited` (`PuppeteerCaptureBase.ts:301-302`). The test would then fail by its guard for a reason that has nothing to do with the code under test.
- **Unhandled rejections.** Each stall test listens for `process.on('unhandledRejection')` and asserts it saw none. The fix schedules its stop without awaiting it (design § 4.2), so a missing `.catch` would surface here.
- **ffmpeg can fail on demand.** The ffmpeg double emits `error` with a test-supplied error when the test asks, so a case can drive the ffmpeg-error internal stop (DD-10, #341 AC-4d, AC-5b).
- **Setup answers in every case.** The injector and `activate()` evaluates and `HeadlessExperimental.enable` always answer, because no watchdog bounds them (DD-11); a case that hung them would test a promise the scope does not make. One case delays them 50 ms so a page `close` can land during setup (#341 AC-10).
- **Cleanup is set per case, never by default.** After the stalled frame, the `deactivate()` and ejector evaluates and `HeadlessExperimental.disable` either answer at once or are `'never'` (`options.cleanup`). A case sets `'never'` only when it tests DD-06 or the cleanup bound, the worst case A-05 describes; every other case uses answering cleanup. The per-case choice is the Cleanup column of § 3d's ownership table. The feature file's shared condition makes the cleanup answer, and every scenario whose case uses `'never'` says so in a Given.
- **Quiescence at the end of a test.** Under DD-06 the cleanup still runs after `start()` or `waitForTimeout()` has rejected, and with `'never'` cleanup it holds a 1 × `W` race timer. From #341 on, every `'never'`-cleanup test ends by awaiting the DD-03 sequence: one `stop()` that rethrows, then a second `stop()` that queues behind the pending cleanup and throws `Capture is not in progress`. So no race timer outlives its test. Before #341 lands the second `stop()` would wait forever, so tests in the #339 and #340 PRs end differently (§ 3d, Before #341 lands).

**What this fixture assumes, and what checks each assumption.** It assumes the `beginFrame` reply shapes and an instant ffmpeg exit. The reply shapes come from the E1/E2 traces and from the pinned CDP definition, in which `screenshotData` is optional. Real ffmpeg exit and real puppeteer session types are checked by the two integration tests (§ 3c). A real Chrome stall is checked only by C8 and by the post-merge meter. This is a known limit, not a gap the fixture can close.

##### 3b. Timing constants and the assertions they drive

| Constant | Value | Used for |
|---|---|---|
| `W` (unit) | 250 ms | The PRD METER value for CH-REC-Q-001. |
| `MUST` | `W + 1000` ms | The assertion `elapsed ≤ MUST`, where elapsed runs from the frame's start (§ 3a) to the settling of the awaiting call. |
| `GOAL` | `W + 250` ms | **Not asserted.** It is printed in the test's failure message for context only. Asserting it would make loaded Windows runners flake. |
| Lower bound | `elapsed ≥ W − 20` ms | Checks "BUT NOT a failure before D ms" (CH-FRQ-B-002). The 20 ms tolerance exists because Node timers can fire slightly before a `performance.now()` interval of the same length. Measured locally: a 250 ms timer armed after 20 ms of synchronous work in the same tick fired after **249.62 ms** (Node v26.13.0, macOS, 15 trials). This tolerance applies **only to the test's own wall-clock measurement**. The error's own field is asserted exactly: `FCT.elapsedMs >= FCT.timeoutMs`, with no tolerance, because DD-05 re-arms the timer when it fires early (F-6, resolved). |
| `GUARD_MS` | 3000 ms | Greater than `MUST`, below the 5 s per-test budget, and far below 30 s. |
| `W` (cleanup sensitivity) | 1500 ms | For one `start()` case and one `waitForTimeout()` case with cleanup that never answers. At `W = 250` cleanup inside the rejection would cost `2W = 500 ms`, still under `MUST = 1250`, so the bound could not tell whether DD-06 holds. At `W = 1500`, `2W = 3000 > W + 1000 = 2500`, so a regression that puts cleanup back inside the rejection fails the bound. Guard: 4500 ms. |
| Close/disconnect bound | `2W + 1000` ms | CH-REC-B-004 as amended in PRD v1.2: 2 × `W` plus ffmpeg finalisation. The 1000 ms is the same slack as `MUST`, and covers the instant mocked ffmpeg. |
| Cleanup-queue bound | `W + 1000` ms | A `start()` or second `stop()` issued right after the rejection queues behind the pending cleanup, which is bounded at 1 × `W` (DD-06). Measured from the moment the first call rejected. |
| `W` (integration) | 1000 ms | Leaves slack for a real browser and real ffmpeg on CI runners. |

**Open handles.** `--detectOpenHandles` is not a gate. The repository's installed Jest (30.5.2) prints detected handles with `console.error` and leaves the exit status alone (`node_modules/@jest/core/build/index.js:1473-1477`). The test script also passes `--forceExit`. So CAP-WD-DISARM asserts directly (§ 3c) rather than trusting Jest's report (finding F-4).

##### 3c. Test cases per capability

All unit cases live in `src/PuppeteerCaptureViaHeadlessExperimental.unit.test.ts`, under one `describe` per CAP id, unless noted otherwise. "Never" means `new Promise(() => {})`.

| CAP | Level | How it is driven | What it asserts |
|---|---|---|---|
| CAP-WD-ARM | unit | (a) The first frame's `process(0)` evaluate never settles. (b) A healthy 3-frame capture plus one screenshot-less reply, with `jest.spyOn(global, 'setTimeout')`. | (a) `FCT.stage === 'evaluate'`, within the lower bound and `MUST`. (b) During capture, before `stop()`, the count of `setTimeout` calls whose delay equals `W` equals the number of logical frames begun, not the number of CDP calls. **The count must be greater than 0.** If the implementation does not use the global `setTimeout`, the spy is blind, and the test fails rather than passes. |
| CAP-WD-EXPIRE | unit | The first `beginFrame` is `'never'`. | The frame fails with `FCT` inside the lower bound and `MUST`. The error's own field satisfies `elapsedMs >= timeoutMs` exactly, with no tolerance (DD-05). The count of `beginFrame` calls in the session log stays the same for `2W` after the failure (no re-send). |
| CAP-WD-RETRY | unit | (a) **E1/E2 signature** (CH-TST-C-002): first `beginFrame` `{ hasDamage: true }`, second `'never'`. (b) Every `beginFrame` answers `{ hasDamage: true }` after 20 ms, forever. | (a) `captureTimestamp === 0`, `frameTimeTicks === 0`, `stage === 'beginFrame'`, `screenshotlessReplies === 1`, `timeoutMs === W`. Both `beginFrame` calls carry `frameTimeTicks: 0`, so the retry is unchanged (CH-FRQ-C-002). (b) Rejection within `MUST`. A per-call deadline never expires here, so it would trip the guard. This case needs no tight timing. |
| CAP-WD-DISARM | unit | (a) A healthy capture of at least 3 frames, then `stop()`, with spies on `setTimeout` and `clearTimeout`. (b) The first `beginFrame` answers `{ hasDamage: true }`; `stop()` is called after that reply and before the retry runs (#340 AC-17). | Every handle from a `setTimeout(…, W)` call has been passed to `clearTimeout` by the time `stop()` resolves. Then wait `2W` real time: no `frameCaptureFailed`, and `stop()` resolved rather than rejected. Case (b) asserts the same: the abandoned frame's timer was cleared, and no `FCT` fires into the stopped recorder. (c) The first `beginFrame` answers `{ hasDamage: true }`, and from then on `connection()` returns `null` with no `CDPSession.Disconnected` (#340 AC-18): `start()` rejects with `Session disconnected`, not `FCT`, `frameCaptureFailed` fires once with it, and every deadline handle was cleared. (d) Three healthy frames with `waitForTimeout(1000)` pending, then `connection()` returns `null` before frame 4's request (#340 AC-18): `waitForTimeout()` rejects with `Session disconnected` within `MUST`, with one event. The **integration** healthy tests run the same path with the default `W` on every matrix cell. |
| CAP-WD-LATE | unit | The first `beginFrame` is a deferred. After `FCT`, the test resolves it with `{ screenshotData }`, then waits two `setImmediate` turns and 50 ms. | No `frameCaptured` and no `frameRecorded` event. The ffmpeg double received no write after the stall. `frameCaptureFailed` fired once. No unhandled rejection or stream error. |
| CAP-OPT | unit | Constructor tests in `src/PuppeteerCaptureBase.test.ts` using `TestCapture`. The default-duration case uses the real class and the `setTimeout` spy. | `DEFAULT_OPTIONS.frameCaptureTimeout === 10000`. With no option set, the first deadline is armed with delay 10000. This avoids a 10 s wait: the frame is healthy and the spy reads the delay. `test.each([0, -1, NaN, Infinity, 2147483648])` throws `options.frameCaptureTimeout can not be set to ${value}`. `1` and `2147483647` construct without throwing (DD-04). An explicit `{ frameCaptureTimeout: undefined }` and an explicit `{ frameCaptureTimeout: null }` construct without throwing, and the first deadline is armed with delay 10000, read by the same spy (DD-07, PRD v1.2). With `250` set, the `FCT.timeoutMs` in CAP-WD-EXPIRE is `250`. No environment variable is read: review check. |
| CAP-PROP-START | unit, real class | Cleanup answers in (a) and (b) and is `'never'` in (c) (§ 3a). (a) **CH-TST-C-003a**: the first `beginFrame` **rejects**. (b) **CH-TST-C-003b**: the first `beginFrame` is `'never'`. (c) Like (b), with `W = 1500` and a 4500 ms guard. The default `waitForFirstFrame: true` is used throughout. | (a) and (b): see § 3d. (c) `start()` rejects with `FCT` within `W + 1000` even though no cleanup call answers. **This case fails if cleanup moves back inside the rejection** (DD-06, closed finding F-2). In every case, at the moment of rejection: the ffmpeg double's input had ended, its `end` handler had been called, and `captureStopped` had fired. (a) and (b) end with the DD-03 sequence. (c) ends once `start()` has rejected and the event has fired, and gains the DD-03 ending with #341 (§ 3d). With #341 (DD-12, #341 AC-10): (d) the first `beginFrame` answers `{ hasDamage: true }`, and a page `close`, a `CDPSession.Disconnected` or an ffmpeg `error` fires from a `setTimeout(…, 0)` the mocked `beginFrame` registered before it returned, so it runs before the retry; `start()` rejects with that error within `MUST` of the frame's start. (e) The first `beginFrame` answers after 50 ms and `close` fires before that; `start()` rejects with `Page was closed` and no `frameCaptured` fires. (f) Setup answers after 50 ms and `close` fires while the injector evaluate is pending; `start()` rejects with `Page was closed` within `MUST` of the setup's end. (g) `customFfmpegConfig` awaits 50 ms, and during it the session emits `CDPSession.Disconnected` and reads `detached`, or the page emits `close`; `start()` rejects with `Session was disconnected` or `Page was closed` within `MUST` of the call. Red on the base by guard, because `_start` resets the recorded failure after that await. |
| CAP-PROP-WAIT | unit, real class | Cleanup answers in (a) and is `'never'` in (b) (§ 3a). (a) Three healthy frames, then `'never'`, while `waitForTimeout(1000)` is pending. (b) The same with `W = 1500` and a 4500 ms guard. | (a) Rejects with the same `FCT` within `MUST` of frame 4's start. (b) Rejects within `W + 1000` of frame 4's start (DD-06 sensitivity, as in CAP-PROP-START (c)). In both cases, at the moment of rejection, the ffmpeg input had ended and `captureStopped` had fired. The ffmpeg double received exactly the 3 frames' writes, and `isCapturing === false`. (a) ends with the first `stop()`, which rethrows. (b) ends once `waitForTimeout()` has rejected and the event has fired, and gains the DD-03 ending with #341 (§ 3d). |
| CAP-PROP-STOP | unit, real class | Two healthy frames, then `'never'`. The test calls `stop()` once frame 3's `process(T)` evaluate is logged. (a) Cleanup answers at once. (b) Cleanup is `'never'`. (c) Like (a), but frame 3's `beginFrame` rejects instead of hanging. (d) Like (b), with `W = 1500`, one page frame and a 4000 ms bound. | (a) `stop()` rejects with `FCT` within `MUST` of frame 3's start. With ffmpeg and cleanup instant, this upper-bounds the drain span named in the PRD SCALE. (b) `stop()` rejects with `FCT` within `2W + 1000`, because `stop()` still awaits the bounded cleanup (CH-REC-B-007). In both cases, before the rejection the ffmpeg input had ended and `captureStopped` had fired once. It is a rejection, not a resolution (design R-2). DD-03 also covers `stop()` itself, so a second `stop()` rejects with the **same** `FCT` instance (`===`), and a third throws `Capture is not in progress`. (c) `stop()` rejects with the injected error instance after `captureStopped` (DD-09 and DD-08 on a rejected request). (d) `stop()` settles within 4000 ms of frame 3's start. A race per cleanup call would need the drain plus three races, at least 6000 ms, so this case fails unless the block is raced as a whole (§ 13). In (a) to (c) a `frameCaptureFailed` listener is called once, before `stop()` settles, with the rejection instance (DD-09). |
| CAP-PROP-CLOSE | unit, real class | The first `beginFrame` is `'never'`, and cleanup is `'never'`. While `start()` is pending, the test fires the recorded page `close` handler. A second case fires `CDPSession.Disconnected` instead. A third case also sets `Page.removeScriptToEvaluateOnNewDocument` and `session.detach()` to `'never'`. | In all three cases the internal stop and detach finish within `2W + 1000` of the frame's start (PRD v1.2 CH-REC-B-004, the CH-REC-B-007 bound). It is observed as `capture.page === null`, polled every 10 ms under the guard. **First cause wins (DD-08)**, checked in each order: (d) **stall first:** let the deadline fire, then fire `close`. A later `stop()` rejects with the same `FCT` instance (`===`). (e) **close first:** fire `close` while the frame is still outstanding, then let the deadline fire. A later `stop()` rejects with `Page was closed`, not the stall error. In cases (a) to (c), the close or disconnect comes first, so a later `stop()` rejects with `Page was closed` or `Session was disconnected`. (f) **`waitForTimeout()` pending:** three healthy frames, then frame 4 `'never'`, with `waitForTimeout(1000)` pending; fire `close` (or `CDPSession.Disconnected`) before the deadline. `waitForTimeout()` rejects with `Page was closed` (or `Session was disconnected`) after `captureStopped`, within `W + 1000` of frame 4's start, and `frameCaptureFailed` fires once with the same instance (DD-09, DD-10). A variant with healthy frames rejects within 1000 ms of the close, with no `frameCaptureFailed`. (g) **`stop()` draining:** two healthy frames, frame 3 `'never'`, `stop()` called; fire `close` (or disconnect) before the deadline. `stop()` rejects with `Page was closed` within `2W + 1000` of frame 3's start, and `capture.page === null` within a further `W + 1000`. With a healthy frame 3, `stop()` resolves and a later `stop()` rejects with `Page was closed`. (i) **ffmpeg error:** with `waitForTimeout(1000)` pending and healthy frames, the ffmpeg double emits `error`; `waitForTimeout()` rejects with that error after `captureStopped` within 1000 ms. With a stall recorded first, a later ffmpeg `error` does not replace the `FCT` (DD-08). (h) **One deadline across the internal stop:** `W = 1500`, one page frame, cleanup, `removeScript…` and `detach` all `'never'`; fire `close` while frame 1 is outstanding. `capture.page === null` within 4000 ms of frame 1's start; separate races for `onPostCaptureStopped` and `_detach` would take at least 4500 ms. |
| CAP-PROP-EVENT | unit, real class | A `frameCaptureFailed` listener (`jest.fn`) and a `captureStopped` listener are added to the START (b), WAIT, STOP and LATE cases. | `frameCaptureFailed` was called once. Its argument is `===` the rejection value of the awaiting call. `captureStopped` was called before it, the `185a1ad` order. On the `start()` path the event comes **after** `start()` rejects, from the scheduled task (design R1), so the test awaits it under the guard rather than assuming it already fired. In the LATE case it is still called once after the late reply. |
| CAP-PROP-REUSE | unit, real class | Lands with #341, which bounds the cleanup this case queues behind; #340 AC-16 runs (B)(ii) with a session that answers the cleanup calls. Run CAP-PROP-START (b) with cleanup `'never'`. Record `listenerCount('frameCaptured')` and `listenerCount('frameCaptureFailed')` before `start()`. (A) **DD-03 sequence:** call `stop()`, then `stop()` again. (B) **Restart:** instead of (A), call `start()` again straight after the rejection: (i) with healthy frames, (ii) with `'never'` again. | `isCapturing === false`. The ffmpeg double saw its `end` handler called. Both listener counts equal their pre-start values. (A) The first `stop()` rejects with the **same** `FCT` instance (`===`). The second throws `Capture is not in progress` within `W + 1000` of the `start()` rejection, because it queues behind the pending cleanup. (B) The second `start()` queues behind the pending cleanup and settles within `W + 1000` of the first rejection plus its own frame time. In (i) it resolves, and a following `stop()` resolves. In (ii) it rejects with a new `FCT` within `MUST` of its own frame's start. It is never `Capture is in progress`. |
| CAP-DETACH | unit, real class | (a) Three healthy frames with `waitForTimeout(1000)` pending; the caller calls `detach()`. (b) Two healthy frames, frame 3 `'never'`, `stop()` called; the caller calls `detach()` once frame 3's `process(T)` is logged. (c) `start()` rejected on a stall with cleanup `'never'`, and the caller calls `detach()` at once. (d) No capture: the existing detach tests. | (a) `detach()` rejects with `Capture is in progress`, `capture.page` is unchanged, `waitForTimeout()` later resolves and a following `stop()` resolves. (b) `detach()` settles after `stop()`, within `2W + 1000` of frame 3's start, and `capture.page === null`; `stop()` rejects with `FCT`, not the `TypeError` the base's `_stop` raises at `this._page.off` once the page is gone. (c) `detach()` waits behind the pending cleanup and settles within `2W + 1000` of the rejection, with `capture.page === null`. (d) Unchanged. |
| CAP-CLEANUP | unit, real class | Three frames. The first `beginFrame` is `'never'`. Every later CDP call hangs: evaluates, `disable`, `removeScript…`, `detach`. | The `stop()` that follows settles within `2W + 1000`, and so does the internal stop on close. It rejects with the same `FCT`, never a cleanup timeout. On the `start()` path the same hang is checked by CAP-PROP-START: cleanup stays outside the rejection, and the next `stop()` waits for it. |
| CAP-ERR | unit | New file `src/FrameCaptureTimeout.test.ts`, following `PuppeteerCaptureFormat.test.ts`. The class is constructed directly, and the instance from CAP-WD-RETRY (a) is reused. | `instanceof FCT` and `instanceof Error`. `name === 'FrameCaptureTimeout'`. The class is importable from `./index`. All six fields are set, and each value appears in `message`. Neither `message` nor `JSON.stringify(error)` contains the sentinel URL or the frame payload `ZnJhbWU=`. |
| CAP-PROP-START / CAP-PROP-STOP / CAP-CLEANUP | **integration**, real Chrome and real ffmpeg | New tests in `src/PuppeteerCaptureViaHeadlessExperimental.test.ts`, using TD-04 with `W = 1000`: (1) `that start() rejects with FrameCaptureTimeout when beginFrame never answers [CH-REC-B-001]`, with k = 0; (2) `that stop() finalises output and rejects after a mid-capture stall [CH-REC-B-003]`, with k = 3. Output goes to a `PassThrough`, consumed and counted. | (1) Rejects with `FCT` within `W + 1000`. `isCapturing === false`. Real ffmpeg with zero frames does not stall the rejection. Then `stop()` rethrows the same `FCT` (DD-03), and a second `stop()` throws `Capture is not in progress` after the cleanup has run against a live session. (2) `stop()` rejects with `FCT`, the output stream received bytes and ended, and `captureStopped` fired. Both run on every OS × puppeteer cell. |
| CAP-FALSE-STALL | unit + integration (existing) + validation run + post-merge meter | (a) **DD-05 unit case:** the session answers the first `beginFrame` from a **real loopback socket**, not a timer. The fixture opens a `net` server on `127.0.0.1`, and the session's `beginFrame` promise resolves when the socket's `data` handler runs. The test writes the reply bytes to the socket, then blocks the event loop with synchronous work for `W + 100` ms. (b) The existing healthy integration tests, with the default `W` armed. (c) The A-04 run (§ 7, G5). (d) A CI log grep for 30 days. | (a) No `FCT`. The frame is captured and `frameCaptured` fires. After the block, Node runs the expired deadline in the timers phase before it reads the socket in the poll phase. Only the DD-05 yield lets the reply win. A reply resolved by a timer or a promise cannot test this, because it settles before the deadline callback runs whether or not the yield exists. So the socket is required, not optional. (b) Pre-merge: no `FCT` in any healthy integration test on any cell. (c) A-04: max `beginFrame` latency recorded. (d) Post-merge: CH-REC-Q-002 METER. |
| CAP-CONSTRAINT | review check | The commands in § 7, G4. | `testTimeout: 30000` unchanged. No `retryTimes` and no re-run step. The `test` script is unchanged. The retry branch (`if (dataBase64 == null)`) changes only by the counter. |

**Existing tests.** `onFrameCaptureFailed emits frameCaptureFailed and stores error` (`PuppeteerCaptureBase.test.ts:355-369`) stays, but #339 changes it to await the event under the guard: the handler no longer awaits the task that emits it, and making it await that task would let a `stop()` whose drain awaits the frame chain wait on itself once #341 records drain failures. It calls the handler directly, outside `start()`, so it is **not** coverage for CH-REC-B-001. The existing repeated start/stop and page-close integration tests are the healthy-path regression net for design risk R-1.

##### 3d. The deadlock regression (CH-TST-C-003) against the real class

**Subject.** `PuppeteerCaptureViaHeadlessExperimental`, through its public `start()` with the default `waitForFirstFrame: true`. Not `TestCapture`, and not a direct call to `onFrameCaptureFailed`.

**Two cases, because the base can only confirm A-07 through one of them** (finding F-3):

- **003a, lock ordering.** `test('CH-TST-C-003 start() rejects when the first beginFrame rejects (lock-ordering regression)')`. The first `beginFrame` rejects with `new Error('Protocol error (HeadlessExperimental.beginFrame): injected')`. The assertions:
  - `await expect(settlesWithin(capture.start(new PassThrough()), 3000, 'start()')).rejects.toBe(injected)`, so the rejection is the same instance;
  - `capture.isCapturing === false`;
  - `captureStopped` fired exactly once, before the rejection;
  - the next `stop()` rejects with the same `injected` instance, and a second `stop()` throws `Capture is not in progress`. DD-03 covers any recorded frame-capture failure, including a rejected `beginFrame` (F-9, resolved);
  - no unhandled rejection.
  Its session answers the cleanup calls (§ 3a). This case **uses no new API**: no `frameCaptureTimeout` option and no `FCT` import. So it compiles on `185a1ad`. ts-jest type-checks test files, so a test that names the new option would fail to compile on the base. It would then be red for the wrong reason.
- **003b, end to end.** `test('CH-REC-B-001 start() rejects with FrameCaptureTimeout on a never-answered first frame')`. The first `beginFrame` is `'never'`, with `W = 250`. Cleanup answers. It asserts `instanceof FCT`, the six fields, `elapsed` inside the lower bound and `MUST`, and `isCapturing === false`. It then runs the DD-03 sequence: the next `stop()` rethrows the same instance, and a second `stop()` throws `Capture is not in progress`.

**How 003a fails on the unfixed code, by its own bound.** At `185a1ad`:

1. The rejected `beginFrame` reaches the reply handler (`PuppeteerCaptureViaHeadlessExperimental.ts:181-188`). `_isCapturing` is `true`, so it calls `onFrameCaptureFailed`.
2. That method awaits `this.stop()` before it emits (`PuppeteerCaptureBase.ts:380-384`).
3. `stop()` finds `_error` null and queues `runExclusive(_stop)` (`:269`) behind the lock that `start()` holds (`:136`).
4. `start()` is waiting for `frameCaptured` or `frameCaptureFailed` (`:245-258`). That event is emitted only after `stop()` returns.

So `start()` never settles. The guard rejects at 3000 ms with `start() still pending after 3000 ms`, and Jest's 30 000 ms timeout never comes into play. The guard clears its own timer. The leftover pending `start()` and the held lock belong to this test's recorder only, and a pending promise is not a handle. So the run ends cleanly at about 3 s, with one red test.

**How 003b behaves on the unfixed code.** Once C1 and C2 exist, so that it compiles, 003b is red by its guard as well. Before the fix nothing fails a frame that never answers, so 003b's red shows that the deadline is missing. It does not show the deadlock. 003a shows the deadlock.

**Red-first evidence (gate G0).** The fix ships as three PRs, one per item. Each PR commits its tests before its fix, and G0 runs inside that PR against its own base:

1. **#339**: the fixture, 003a and the `'never'`-cleanup delivery cases (#339 AC-5c, AC-5d), then C4. All are red by their guards on the base, where the failure handler awaits a `stop()` that awaits the cleanup, and green after C4.
2. **#340**: C1 and C2 with the stall tests (003b, the CAP-WD cases including CAP-WD-DISARM (c), CAP-ERR, CAP-OPT, CAP-PROP-WAIT (a) and (b), CAP-PROP-START (c)), then C3. The stall tests are red by guard or assertion after the first commit, because C1 and C2 make them compile, and green after C3.
3. **#341**: the bounded-stop tests (CAP-PROP-STOP (a) to (d), CAP-PROP-CLOSE (a) to (i), CAP-PROP-START (d) to (g), CAP-DETACH (a) to (c), CAP-WD-DISARM (b), CAP-CLEANUP, CAP-PROP-REUSE) and the DD-03 endings of the `'never'`-cleanup cases above, then C5. CAP-PROP-CLOSE (f) is red on the base by its guard: the pending `waitForTimeout()` never settles.

Run the named tests after each first commit, for example `npx jest src/PuppeteerCaptureViaHeadlessExperimental.unit.test.ts -t 'CH-TST-C-003'` in #339, and quote the failing line in that PR's body. After each fix commit the same command is green, and `npm run test` passes at every PR's head.

**Before #341 lands.** Nothing bounds the pending cleanup in the #339 and #340 PRs. So a `'never'`-cleanup case there ends once `start()` or `waitForTimeout()` has rejected and the event has fired. It calls no `stop()` and never restarts behind the cleanup. No race timer exists before C5, so nothing outlives the test. #341 AC-8 then gives each of these cases the DD-03 ending, which also proves that every cleanup race timer was cleared.

**Call-path ownership.** Every pair of a call path and an obligation has one owning item AC. The Cleanup column is the per-case setting of § 3a. The Ending column is how the test ends in the PR that adds it.

| Call path | Obligation | Owning AC | Cleanup | Ending |
|---|---|---|---|---|
| `start()`, rejected first frame | rejects with the same instance, state, event order | #339 AC-1, AC-2, AC-3 | answers | DD-03 sequence (#339 AC-5b) |
| second `start()` after a rejected first frame | resolves and captures | #339 AC-7 | answers | its own resolution |
| `start()`, rejected first frame | delivery before cleanup (DD-06) | #339 AC-5c | `'never'` | rejection and event; DD-03 ending from #341 AC-8 |
| `waitForTimeout()`, rejected frame | rejects with the same instance after `captureStopped` | #339 AC-5 | answers | one `stop()` that rethrows |
| `waitForTimeout()`, rejected frame | delivery before cleanup (DD-06) | #339 AC-5d | `'never'` | rejection and event; DD-03 ending from #341 AC-8 |
| `start()`, never-answered first frame | `FrameCaptureTimeout` within `MUST`; one event, same instance | #340 AC-1 (003b) | answers | DD-03 sequence (stated in #340 AC-1) |
| `start()`, never-answered first frame | DD-06 at `W = 1500` (R-T4 guard) | #340 AC-1b (CAP-PROP-START (c)) | `'never'` | rejection and event; DD-03 ending from #341 AC-8 |
| `waitForTimeout()`, never-answered frame | `FrameCaptureTimeout` within `MUST`, k frames written, one event | #340 AC-2 (CAP-PROP-WAIT (a)) | answers | one `stop()` that rethrows (stated in #340 AC-2) |
| `waitForTimeout()`, never-answered frame | DD-06 at `W = 1500` (R-T4 guard) | #340 AC-2b (CAP-PROP-WAIT (b)) | `'never'` | rejection and event; DD-03 ending from #341 AC-8 |
| second `start()` after a stall | bounded, state clean | #340 AC-16 | answers | its own rejection |
| second `start()` after a stall | bounded behind a cleanup that never answers | #341 AC-4c | `'never'` | DD-03 sequence |
| `stop()` after a rejected `start()` | cleanup waited at most 1 × `W` | #341 AC-4c | `'never'` | DD-03 sequence |
| `stop()` with a stalled or rejected frame | drain bound, finalise, reject, one event (DD-09), DD-03 | #341 AC-1, AC-3b | answers | DD-03 sequence |
| `stop()` with a stalled frame | cleanup bound 2 × `W` raced as one block, first cause kept | #341 AC-2, AC-3 | `'never'` | its own rejection |
| `stop()` draining at a page close or disconnect | first cause, bounded, queued detach bounded | #341 AC-1b | `'never'` | its own rejection, then `capture.page === null` |
| `waitForTimeout()` at a page close or disconnect | rejects with the first cause after `captureStopped`, stalled or healthy frames (DD-10) | #341 AC-4d | `'never'` | later `stop()` |
| internal stop (page close, disconnect) | bounded, later `stop()` reports the recorded error | #341 AC-4, AC-4b (close and disconnect), AC-5 | `'never'` | later `stop()` |
| any two failures | first cause wins (DD-08) | #341 AC-4b, AC-5b | `'never'` | later `stop()` |
| every `'never'`-cleanup case of #339 and #340 | DD-03 ending, no race timer left | #341 AC-8 | `'never'` | DD-03 sequence |
| `start()`, a failure recorded in the retry gap, before a healthy answer, or during setup | rejects with the first cause (DD-12) | #341 AC-10 | answers | DD-03 sequence |
| a retry that cannot be sent | the frame fails through the failure path, no deadline left | #340 AC-18 | answers | DD-03 sequence |
| caller `detach()` during a capture or a draining `stop()` | waits for the lock, refuses while capturing (DD-13) | #341 AC-11 | answers | its own settling |

**Pending-state sweep.** The table above pairs a call path with an obligation. The defects found while scoping came from a third axis: what is pending when a trigger arrives, and in what order two triggers come. Eight gate runs each found one more such cell, because each wait listened only to frame events and each cell was owned on its own. DD-12 moved the rule into the one guarded writer and the two waits, so this table no longer carries the bound: it checks how far DD-12 reaches. Every pending state is crossed with every trigger, every stop source (page close, disconnect, ffmpeg error, caller `stop()`, caller `detach()`) included. Each cell names the AC that owns it, or says why nothing is owed. "Close" means a page `close` or a `CDPSession.Disconnected`; both are listed in every cell that names one.

| Pending when the trigger arrives | Stall | Rejected frame | Page close or disconnect | ffmpeg error | Close, then stall | Stall, then close or ffmpeg error | Caller `stop()` | Caller `detach()` |
|---|---|---|---|---|---|---|---|---|
| `start()` in its own awaits before setup (output directory, ffmpeg lookup, `format`, `customFfmpegConfig`) | not reached: no frame yet | not reached | recorded and kept, because `_start` registers its `close` handler and resets the recorded failure before its first await (DD-12); `start()` rejects with it (#341 AC-10) | not reached: ffmpeg is not running yet | not reached | not reached | queues behind the lock | waits behind the lock, then detaches once `start()` has rejected (#341 AC-11) |
| `start()` in its setup phase (any `start()`'s injector, `activate()`, `enable`, the first start included) | not reached: no frame yet | not reached | recorded at once; once setup answers, the first-frame wait reads it and `start()` rejects with it (DD-12, #341 AC-10); bounded only while the session answers setup (DD-11, carved out) | the same | not reached | not reached | queues behind the lock; the same carve-out | waits behind the lock (DD-13); the same carve-out |
| `start()` waiting on the first frame, request in flight (holds the lock) | #340 AC-1, AC-1b | #339 AC-1, AC-5c | `start()` rejects with it: stalled frame #341 AC-4b; healthy frame #341 AC-10 (DD-12; at `185a1ad` `start()` resolved) | #341 AC-10 | #341 AC-4b | `start()` has already rejected with the stall; a later close is a no-op (handler removed, #339 AC-2); a disconnect or ffmpeg error keeps the first cause (#341 AC-5b) | queues behind the lock; the watchdog frees the lock (#340 AC-1), and #339 AC-6 asserts the order | waits behind the lock, which the watchdog or DD-12 frees, then detaches if `start()` rejected or refuses if it resolved (#341 AC-11) |
| `start()` waiting on the first frame, in the retry gap (a screenshot-less reply scheduled a retry that has not run) | the retry is sent under the same deadline (#340 AC-3) | the retried request rejects (#339 AC-1's path), or cannot be sent and fails the frame (#340 AC-18 (a)) | #341 AC-10: the retry returns on the recorded failure, and the writer has already told the wait (DD-12) | #341 AC-10 | not reached: no retry is sent after a recorded failure | not reached: nothing is in flight to stall | queues behind the lock; the retry's own frame or the watchdog frees it (#340 AC-1; #339 AC-6 asserts the order) | as the row above (#341 AC-11) |
| `waitForTimeout()` pending (no lock) | #340 AC-2, AC-2b | #339 AC-5, AC-5d | #341 AC-4d, stalled and healthy frames (DD-10) | #341 AC-4d, ffmpeg row (DD-10) | #341 AC-4d | #341 AC-5b | waits forever at `185a1ad`; with no failure recorded, what it settles with is open (carved out, #341 § Out of Scope) | refused at once with `Capture is in progress`; the capture and the wait go on (#341 AC-11) |
| `stop()` draining (holds the lock) | #341 AC-1, AC-2, AC-3 | #341 AC-1 | #341 AC-1b, stalled and healthy frames | the drain is bounded by the watchdog; the ffmpeg error cannot replace a recorded stall (#341 AC-5b) | #341 AC-1b | #341 AC-1 with DD-08's writer guard (#341 AC-5b) | not reached: the caller's `stop()` is the one draining | waits for the stop, then detaches (#341 AC-11) |
| capturing, nothing pending | #340 AC-7 (one event); #341 AC-5b (later `stop()`) | the existing `onFrameCaptureFailed` path; a later `stop()` rethrows, as #339 AC-5 asserts | #341 AC-4, AC-5 with a stalled frame; healthy frames: the existing integration test `that capture stops gracefully on page close` | the existing ffmpeg-error path; first cause per DD-08 (#341 AC-5b) | #341 AC-5b (close first) | #341 AC-5b (stall first) | #341 AC-1; a stop in the retry gap leaves no armed deadline (#340 AC-17) | refused at once (#341 AC-11); a later frame request that cannot be sent fails the frame (#340 AC-18 (b)) |
| idle after a failure, cleanup maybe pending | nothing owed: no frame is requested while a failure is recorded | nothing owed | a page close is a no-op (handler removed, #339 AC-2, #340 AC-16); a disconnect keeps the first cause and its detach is bounded (#341 AC-5b) | nothing owed: ffmpeg has exited | nothing owed | #341 AC-5b | #341 AC-3b, AC-4c (DD-03 sequence) | waits behind the pending cleanup, bounded at 1 × `W` (DD-06), then detaches inside the cleanup race (#341 AC-11 (c); after the cleanup, #341 AC-9) |
| restart: a second `start()` after a failure | #340 AC-16 (answering cleanup); #341 AC-4c (cleanup never answers) | #339 AC-7 | as the `start()` rows, once the second `start()` holds the lock | as the `start()` rows | as the `start()` rows | as the `start()` rows | as the `start()` rows | as the `start()` rows |

One pending state is left out on purpose: a `waitForTimeout()` pending when the caller's own `stop()` ends the capture. It also waits forever at `185a1ad`. Under DD-12 it hears `captureStopped`, but no failure is recorded, so DD-10 gives it no error to reject with. Whether it should resolve or reject with a new error is a public-API choice, left to the maintainer (#341 § Out of Scope).

#### 4. Environment topology

| Env | Purpose | Lifecycle | Data source | Downstream | Provisioning |
|---|---|---|---|---|---|
| Local, macOS (the maintainer's machine) | Unit tests only. The constructor throws on `darwin`, so the fixture overrides `process.platform`. Integration tests cannot run here. | Per run | Synthetic (§ 5) | All mocked | None |
| Local, Linux or Windows | Everything in `npm run test`, plus the A-04 run | Per run | Synthetic; real browser pages from `about:blank` or `data:` URLs | Real Chrome and ffmpeg | `npm ci` downloads the pinned browsers |
| CI `build` job, ubuntu-24.04 and windows-2022 | Lint plus the full `npm run test` at the pinned `PUPPETEER_VERSION` (25.17.0 at baseline) | Ephemeral GitHub-hosted runner per job | Same | Real | `.github/workflows/ci.yml` (this fix does not change it) |
| CI `integration` job, OS × puppeteer-version matrix (24.3 to the pin, one entry per minor) | The same `npm run test`, so the unit stall tests and the integration stall tests run once per cell | Ephemeral, `fail-fast: false` | Same | Real; browsers provisioned per cell and verified by the job | `ci.yml`, unchanged |

No staging or canary: this is a library. Promotion runs from the PR, to `main`, to a GitHub Release. Section 7 names the gates on each step.

#### 5. Test data strategy

| Level | Data | Privacy class | Refresh | Source |
|---|---|---|---|---|
| Unit | Base64 frame payload `ZnJhbWU=` (the bytes `frame`), sentinel URL `https://sentinel.invalid/secret-path`, injected `Error` instances | Public | Per test, inline | The fixture (§ 3a) |
| Integration | `about:blank`, the existing pattern. Output goes to an in-memory `PassThrough`, so no files are written. | Public | Per test | Existing tests |
| A-04 run | A `data:` URL page with a full-viewport animated CSS gradient, with no network requests | Public | Once | An ad-hoc script outside the suite |
| Post-merge meter | CI job logs with protocol traces of the test pages | Public (the repository's own CI logs) | 2 weeks, then 30, 60 and 90 days | `gh run list`, `gh run view --log` |

No non-Public data exists at any level.

#### 6. Bidirectional traceability

**Schema.** Every new test title contains the requirement ID it verifies, for example `CH-REC-B-002 waitForTimeout() rejects …`. Integration titles keep the repository's `that …` style and append the ID in brackets. Each `describe` is named by its CAP id. The repository has no traceability convention yet, so this scheme is introduced here. It was not found in the codebase. IDs in titles also appear in Jest's CI output, which the post-merge log grep reads.

**Tooling.** Run at PR review (gate G4), and again whenever the PRD's requirement list changes:

```sh
mkdir -p .tmp
grep -oE '\*\*CH-[A-Z]{3}-[BQCI]-[0-9]{3}' docs/requirements/capture-hang-prd.md | tr -d '*' | sort -u > .tmp/ch-prd-ids
grep -ohE 'CH-[A-Z]{3}-[BQCI]-[0-9]{3}' src/*.test.ts | sort -u > .tmp/ch-test-ids
comm -23 .tmp/ch-prd-ids .tmp/ch-test-ids   # specs with no test
comm -13 .tmp/ch-prd-ids .tmp/ch-test-ids   # test IDs the PRD does not define
```

**Pass condition.** The second command prints nothing. The first prints exactly `CH-DOC-C-001` to `CH-DOC-C-004`, `CH-FRQ-C-001`, `CH-FRQ-C-002`, and `CH-FRQ-C-003`: the IDs verified by review or by the spike (table below). `CH-REC-Q-002` now has a unit test (the DD-05 case), so it no longer appears. Any other ID is an orphan spec. The first grep was checked against the PRD at baseline: it extracts all of its requirement IDs.

**Matrix (CH ↔ CAP ↔ test).**

| Requirement | CAP | Verified by (test title, or check) | File |
|---|---|---|---|
| CH-FRQ-B-001 | CAP-WD-ARM | `CH-FRQ-B-001 a frame that stalls in process(T) evaluation fails with stage 'evaluate'`; `CH-FRQ-B-001 arms one watchdog per logical frame, not per CDP call` | unit |
| CH-FRQ-B-002 | CAP-WD-EXPIRE | `CH-FRQ-B-002 a never-answered beginFrame fails the frame after the watchdog and sends no further beginFrame` | unit |
| CH-FRQ-B-003 | CAP-WD-RETRY | `CH-FRQ-B-003 an endless run of screenshot-less replies still expires` | unit |
| CH-FRQ-B-004 | CAP-WD-DISARM | `CH-FRQ-B-004 a healthy capture leaves no watchdog armed and none fires after stop`; also the existing healthy integration tests | unit, integration |
| CH-FRQ-B-005 | CAP-WD-LATE | `CH-FRQ-B-005 a reply that arrives after the watchdog is discarded` | unit |
| CH-OPT-I-001 | CAP-OPT | `CH-OPT-I-001 default frameCaptureTimeout is 10000`; `CH-OPT-I-001 the first frame deadline uses the default duration`; `timeoutMs` in CH-FRQ-B-002 | Base, unit |
| CH-OPT-B-002 | CAP-OPT | `CH-OPT-B-002 rejects frameCaptureTimeout %p` (0, -1, NaN, Infinity, 2147483648); `CH-OPT-B-002 accepts frameCaptureTimeout %p` (1, 2147483647); `CH-OPT-B-002 uses the default for an explicit %p` (undefined, null) | Base |
| CH-REC-B-001 | CAP-PROP-START | `CH-REC-B-001 start() rejects with FrameCaptureTimeout on a never-answered first frame`; `that start() rejects with FrameCaptureTimeout when beginFrame never answers [CH-REC-B-001]` | unit, integration |
| CH-REC-B-002 | CAP-PROP-WAIT | `CH-REC-B-002 waitForTimeout() rejects on a mid-capture stall and keeps the frames captured before it`; `CH-REC-Q-001 waitForTimeout() rejects within the bound when cleanup calls also never answer`; `CH-REC-B-002 waitForTimeout() rejects with the first cause when the page closes while it is pending` (CAP-PROP-CLOSE (f), DD-10) | unit |
| CH-REC-B-003 | CAP-PROP-STOP | `CH-REC-B-003 stop() drains a stalled frame in bounded time, finalises output, then rejects`; `CH-REC-B-003 stop() with hanging cleanup rejects within 2x the watchdog and the next stop() rethrows the same error`; `that stop() finalises output and rejects after a mid-capture stall [CH-REC-B-003]`; `CH-REC-B-003 stop() reports a frame request rejected during the drain` (CAP-PROP-STOP (c)); `CH-REC-B-003 stop() races the cleanup block as a whole` (CAP-PROP-STOP (d)); `CH-REC-B-004 stop() draining at a page close rejects with Page was closed` (CAP-PROP-CLOSE (g)) | unit, integration |
| CH-REC-B-004 | CAP-PROP-CLOSE | `CH-REC-B-004 page close during a stalled start() finishes stop-and-detach in bounded time`; `CH-REC-B-004 session disconnect during a stalled start() finishes stop-and-detach in bounded time`; `CH-REC-B-004 stop-and-detach stays bounded when detach calls hang`; `CH-REC-B-004 a stall recorded before page close is the error stop() reports`; `CH-REC-B-004 a page close recorded before the stall is the error stop() reports` | unit |
| CH-REC-B-005 | CAP-PROP-EVENT | `CH-REC-B-005 frameCaptureFailed fires once with the instance the awaiting call rejects with`, plus listener assertions folded into the START, WAIT, STOP and LATE tests | unit |
| CH-REC-B-006 | CAP-PROP-REUSE | `CH-REC-B-006 after a stall the recorder is idle, leak-free and can start again`; `CH-REC-B-006 the next stop() after a stall rethrows the same FrameCaptureTimeout once, then Capture is not in progress` (DD-03); `CH-REC-B-006 a start() right after a rejected start() waits for the pending cleanup, bounded by the watchdog` (DD-06) | unit |
| CH-REC-B-007 | CAP-CLEANUP | `CH-REC-B-007 stop() settles within 2x the watchdog when every cleanup call hangs` | unit |
| CH-REC-Q-001 | CAP-PROP-START, -WAIT, -STOP | The elapsed assertions in the B-001, B-002 and B-003 tests; `CH-REC-Q-001 start() rejects within the bound when cleanup calls also never answer` | unit |
| CH-REC-Q-002 | CAP-FALSE-STALL | `CH-REC-Q-002 a reply already received while the event loop was blocked is not a stall` (DD-05). Pre-merge: no `FCT` in healthy integration tests (G3) and the A-04 run (G5). Post-merge: the 30-day meter (G7). | unit |
| CH-ERR-I-001 | CAP-ERR | `CH-ERR-I-001 is an exported Error subclass named FrameCaptureTimeout` | `FrameCaptureTimeout.test.ts` |
| CH-ERR-I-002 | CAP-ERR | `CH-ERR-I-002 carries and renders all six fields and no page data`; the field assertions in CH-TST-C-002 | `FrameCaptureTimeout.test.ts`, unit |
| CH-FRQ-C-001 | CAP-CONSTRAINT | Review check G4 (a) | — |
| CH-FRQ-C-002 | CAP-CONSTRAINT | Review check G4 (b); the `frameTimeTicks: 0` assertion on both calls in CH-TST-C-002 | unit |
| CH-FRQ-C-003 | — | The C8 spike's written result, filed on the tracker. It must record the verdict against H1, H2 and H3 and answer OQ-01 and OQ-02 where reached. | — |
| CH-DOC-C-001…003 | — | Review check G4 (c) | — |
| CH-DOC-C-004 | — | Release check G6 | — |
| CH-TST-C-001 | CAP-PROP-START, -WAIT, -STOP | The B-001, B-002 and B-003 unit tests. Each completes in under 5 s (§ 3b). | unit |
| CH-TST-C-002 | CAP-WD-RETRY | `CH-TST-C-002 the E1/E2 signature reports screenshotlessReplies 1 at stage beginFrame` | unit |
| CH-TST-C-003 | CAP-PROP-START | `CH-TST-C-003 start() rejects when the first beginFrame rejects (lock-ordering regression)`, plus 003b above | unit |

"unit" means `src/PuppeteerCaptureViaHeadlessExperimental.unit.test.ts`. "Base" means `src/PuppeteerCaptureBase.test.ts`. "integration" means `src/PuppeteerCaptureViaHeadlessExperimental.test.ts`.

#### 7. Quality gates

| # | Gate | Stage | Entry | Exit | Bypass authority | Failure action |
|---|---|---|---|---|---|---|
| G0 | Red first | Each item's PR, before its fix lands (#339: C4; #340: C3; #341: C5) | The fixture, 003a and the stall tests are committed in the order in § 3d | 003a is red by its guard on the base. The other HIGH-CAP tests are red by guard or assertion after C1 and C2. Failing lines are quoted in the PR body. | None | A test that is green on the unfixed code does not test the defect. Rewrite it. |
| G1 | Local | Before push | Code compiles | `npm run lint` passes. On macOS, the unit test files pass. On Linux or Windows, `npm run test` passes. | — | Fix before push |
| G2 | PR CI, `build` job | On the PR | G1 passed | Lint and the full `npm run test` are green on **both** ubuntu-24.04 and windows-2022 | None | Block merge |
| G3 | PR CI, `integration` job | On the PR | `build` green | **Every** OS × puppeteer-version cell is green. No healthy integration test reports `FCT`. | The maintainer, only when a cell fails in a step before `Test` (for example browser provisioning), after reading the log. The reason is recorded in the PR. | Block merge. A Jest `Exceeded timeout of 30000 ms` in a capture test counts as a failure of the fix, not a flake: read the trace, never re-run it to green. A stall test that flakes on its timing goes through flaky-test triage, never through a retry (CH-FRQ-C-001). |
| G4 | Review checks | PR review | G2 and G3 green | (a) `git diff origin/main...HEAD -- jest.config.js package.json .github/workflows/` shows no change to `testTimeout`, to the `test` script or to the Test steps, and `git grep -nE 'retryTimes\|--testTimeout' -- src package.json` is empty. (b) The `if (dataBase64 == null)` branch diff adds only the screenshot-less counter. (c) README, KNOWN_ISSUES and CHANGELOG carry the CH-DOC-C-001…003 content, and no text presents A-01 to A-03 as the cause. (d) The traceability commands in § 6 meet their pass condition. | None | Block merge |
| G5 | A-04 validation run | Before merge, once | The fix is complete on the branch | The run is done and its numbers are in the PR body | The maintainer may defer it. The deferral is recorded, and D-01 then stays unvalidated. | If the max latency is ≥ 1000 ms (10% of the default), take D-01 back to the maintainer before merge |
| G6 | Release | GitHub Release | Merged | The release body carries the CH-DOC-C-004 line | None | Edit the release body |
| G7 | Post-merge meters | 2 weeks, then 30, 60 and 90 days | Merged | Zero integration failures with `Exceeded timeout of 30000 ms` in a capture test. Each `FCT` found in a CI log is checked against its `DEBUG` trace: a reply within `W` makes it a false stall (CH-REC-Q-002 MUST is 0). | — | A Jest timeout recurs: reopen PRD § 10. One or more `FCT` with `screenshotlessReplies ≥ 1` within 30 days: the D-12 decision gate fires. Any false stall: revisit D-01. |

**Constraints carried into every gate.** Jest `testTimeout` stays 30000. No test retries, no `jest.retryTimes`, no CI re-run step. The `test` script is unchanged. This plan does not depend on which checks branch protection marks required, because the sibling gap owns that. The maintainer merges on all-green G2 and G3.

**A-04 run (classification).** This is an **assumption-validation measurement, not a test**. It asserts nothing in CI, runs once by hand, and produces a number for a decision (D-01). It belongs to no pyramid layer and is not added to the suite. How to run it:

- **Where.** On a Linux x64 or Windows host. macOS cannot run it.
- **Code.** The fix branch, with the default `W`.
- **Script.** An ad-hoc script outside `src/` launches `chrome-headless-shell` through `launch()`, attaches, opens the § 5 `data:` page, and calls `start()`. **After the first frame**, it calls `page.setViewport({ width: 3840, height: 2160 })`. Calling it after start follows the KNOWN_ISSUES workaround for the `defaultViewport` freeze. It then runs `waitForTimeout(2000)` and `stop()`.
- **Trace.** Run with `DEBUG=puppeteer:protocol:*`, and send stderr to a file, not a TTY.
- **Measure.** Pair `beginFrame` sends and replies by id, the method behind E4. That measurement used a throwaway scratch script over the saved CI logs, which is not kept in the repository; any equivalent pairing works. That it parses a local trace's timestamp prefix is **unverified**. If it does not, pair the lines with an equivalent script.
- **Record.** The answered count, p50, p99 and max latency, whether any `FCT` was raised, the host, and the Chrome build.

#### 8. Framework selection standards

- **Unit and integration framework.** Jest with ts-jest, as now. The installed Jest is 30.5.2. No Test ADR: nothing new is chosen.
- **Mocking.** `jest.fn`, `jest.mock('fluent-ffmpeg')` and `jest.spyOn` on the global `setTimeout` and `clearTimeout`. Fixture doubles are hand-built (§ 3a). No new test dependency: no sinon, no `@sinonjs/fake-timers`.
- **Timers.** Real (TD-01).
- **Contract testing.** Not used. The external contract is CDP, and its reply shapes are pinned in the fixture from the E1/E2 traces and the CDP definition.
- **Property-based testing.** Not used. The behaviour under test is a small set of named orderings (stall at evaluate, at `beginFrame`, after a screenshot-less reply, during stop, during close), not an input space.
- **Mutation testing.** Deferred. The repository has none, and the red-first gate (G0) gives the same "does this test catch the defect" evidence for the HIGH capabilities.
- **Lint.** `ts-standard` covers test files, as now.

#### 9. AI-augmented testing

N/A: there is no AI or LLM in the system. The library has no model in its runtime path. The fact that the PRD, the design and probably the tests are agent-authored is a test-independence risk, handled in § 10 (R-T3) and gate G0.

#### 10. Risks and open questions

| Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|
| R-T1. Timing assertions flake on loaded Windows runners. | Medium | Medium: red PRs, pressure to add retries | Assert only `MUST` (1 s of slack), never `GOAL`. Use a lower-bound tolerance (§ 3b). Guards stay well under 30 s. Any flake goes to diagnosis, never to a retry. | Maintainer |
| R-T2. The unit fixture encodes the same assumptions as the code (instant ffmpeg exit, reply shapes), so the tests agree with the code and are wrong together. | Medium | High | Two integration stall tests with real ffmpeg and a real session (§ 3c). Reply shapes are pinned to the E1/E2 traces. A real stall is covered only by C8 and the G7 meter: this limit is stated, not closed. | Maintainer |
| R-T3. The same author writes the fix and the tests, so the suite checks self-consistency rather than the spec. | High | High | Oracles are copied from the PRD (§ 3, Generation). Red-first evidence comes from the unfixed code (G0). The reviewer checks each oracle value against the PRD, not against the implementation. | Maintainer |
| R-T4. At `W = 250` a `start()` or `waitForTimeout()` that waits for cleanup still passes `MUST` (`2W = 500 < 1250`), so the PRD METER cannot tell whether DD-06 holds. | Medium: DD-06 is easy to undo in a later refactor | High: at the default `W` it breaks the MUST | The `W = 1500` cases in CAP-PROP-START and CAP-PROP-WAIT (§ 3c), with cleanup that never answers. | Maintainer |
| R-T7 (resolved). The CAP-PROP-CLOSE oracle once followed a PRD version that was not on disk (F-8). PRD v1.2 is now on disk, and its CH-REC-B-004 states the bound and the first-cause rule the test uses. | — | — | Gate G4 (d) still runs whenever the PRD changes. | Maintainer |
| R-T5. Integration tests cannot run on the maintainer's macOS machine. | Certain | Low | Unit tests run locally with the platform override. Integration tests and A-04 run on CI, Linux or Windows. | Maintainer |
| R-T6. A test spy is blind because the implementation uses another timer source. | Low | Medium: a false green on ARM and DISARM | Each spy-based case asserts a non-zero count first (§ 3c). | Maintainer |

**Values this plan sets.** These are test parameters, not product decisions. Each can be changed without touching the design.

| Value | Set to | Why |
|---|---|---|
| Unit `W` | 250 ms | PRD METER |
| Guard | 3000 ms (4500 ms for the `W = 1500` case) | Above `MUST`, below the 5 s budget per test |
| Lower-bound tolerance | 20 ms | Timer early-fire measured at 0.38 ms on Node v26 (§ 3b). 20 ms leaves room on slower runners. |
| Cleanup-sensitivity `W` | 1500 ms | Smallest round value with `2W > W + 1000` and some margin. Used for `start()` and `waitForTimeout()`. |
| Close/disconnect and cleanup bounds | `2W + 1000` ms; cleanup queue `W + 1000` ms | Same 1000 ms slack as `MUST` |
| DD-05 loop block | `W + 100` ms of synchronous work | Long enough that the deadline has expired when the loop resumes |
| Integration `W` | 1000 ms | A real browser and ffmpeg on shared runners |
| Endless screenshot-less reply interval | 20 ms | Fast enough to retry many times within `W` |
| A-04 escalation threshold | max latency ≥ 1000 ms (10% of the default) | E4's worst case is 1.65% of the default. 10% would mean less than 10× headroom on large viewports. |

**Open questions.** None for this plan. F-1 to F-9 are all applied or resolved (below). The decisions they rest on (DD-01…DD-13, D-01…D-14) are still ratification-pending, and a changed decision changes its tests. Every case in § 3c can be written now.

#### Findings for the design

**Status.** Every finding below is applied or resolved, in design DD-03…DD-08, design § 14 (C6 row) and PRD v1.2. Each finding's original evidence is kept, so the record shows why the change was made.

**F-1 (applied: design § 14, C6 row). C6 overstated the existing test scaffolding.** Design § 14 (C6 row) says the CDP unit test file "already mocks the class's collaborators". It does not. `src/PuppeteerCaptureViaHeadlessExperimental.unit.test.ts` mocks only a browser object for `validateBrowserArgs` (lines 14-21). It has no page, frame, session or fluent-ffmpeg mock. The fluent-ffmpeg mock lives in `src/PuppeteerCaptureBase.test.ts:8-43`, and it is one shared object that never emits `end`. So a real `start()` then `_stop()` would wait forever at `PuppeteerCaptureBase.ts:301-302` (`await this._ffmpegExited`), and a second `start()` in one test would call a stale `start` handler. **Impact:** C6 needs the new fixture in § 3a. That is feasible, but the work belongs in the appetite (D-11), and C6's feasibility basis should be corrected.

**F-2 (closed by DD-06). `start()`'s rejection used to include cleanup.** The first design draft had `_start` run `_stop()` inline before rethrowing. `_stop` awaits ffmpeg exit (`PuppeteerCaptureBase.ts:301-302`) and then `onPostCaptureStopped` (`:318`), which sends the cleanup CDP calls. With `W = 10 000` and a session that answers nothing after the stall, `start()` would have rejected at about 20 000 ms, past the CH-REC-Q-001 MUST of 11 000 ms. DD-06 now delivers the rejection once the output is final and runs the cleanup afterwards, so the finding is closed. **What remains:** the `W = 1500` cases (§ 3c) stay as regression guards, because the PRD METER at `W = 250` cannot see the difference. Design § 13 also notes that ffmpeg finalisation is still inside the span. The tests cover only a few frames, so a long capture with many queued frames is not covered by any test.

**F-3 (applied: PRD v1.2 CH-TST-C-003 is split into 003a and 003b). CH-TST-C-003 as first worded could not confirm A-07 on the base.** PRD § 10.6 runs the test "against a never-answering first frame" on `185a1ad` and expects it to fail "by its own bound … confirming A-07". At `185a1ad`, a frame that never answers never reaches `onFrameCaptureFailed`, because no deadline exists. The reply handler (`PuppeteerCaptureViaHeadlessExperimental.ts:151-189`) acts only on a settled promise. So the guard failure is fully explained by the missing deadline, and says nothing about the deadlock. Only a first `beginFrame` that **rejects** reaches the deadlocking path (`PuppeteerCaptureBase.ts:136`, `:269`, `:381`). Also, a test that uses the new option or class does not compile on the base under ts-jest. **This plan splits the test** into 003a (rejected frame, existing API only: the A-07 confirmation) and 003b (never-answering frame, the end-to-end bound). Design C6 and PRD CH-TST-C-003 should say the same. Design § 5's dependency note ("its regression test can drive a rejected first frame without a watchdog") already points this way, but the PRD acceptance criterion was not updated.

**F-4 (applied: PRD v1.2 CH-FRQ-B-004 asserts timers directly; also verified by the requester, whose Jest 30.5.2 run with an open 60 s timer exited 0 under `--detectOpenHandles --forceExit`). "Jest reports no open handle" cannot fail CI.** Two places lean on `--detectOpenHandles` as a check: CH-FRQ-B-004's acceptance criterion, and design § 2 / R-5 ("`--detectOpenHandles` is already in the test script"). The installed Jest 30.5.2 prints detected handles with `console.error` and returns the results unchanged (`node_modules/@jest/core/build/index.js:1473-1477`). The test script also passes `--forceExit`. So a leaked deadline would print a warning on a green run. **This plan** asserts directly instead (§ 3c, CAP-WD-DISARM). The design's R-5 mitigation and the PRD's acceptance text should name a check that can fail.

**F-5 (resolved by DD-08, first cause wins; tested by CAP-PROP-CLOSE cases (d) and (e)). Which error wins was undefined when a close or disconnect and a stall both happen (R4).** CH-REC-B-004 says a later `stop()` rejects with `Page was closed` or `Session was disconnected`. C4 says `onFrameCaptureFailed` records the `FrameCaptureTimeout`. That is the same `_error` field `onPageClose` and `onSessionDisconnected` already wrote (`PuppeteerCaptureBase.ts:387`; `PuppeteerCaptureViaHeadlessExperimental.ts:227`). In R4 the deadline fires after the close, so as designed the stall overwrites the close error. CH-REC-B-005, meanwhile, says `stop()` rejects with the same `FCT` instance as the event. A test needs one oracle. **This plan** asserts B-004's stated oracle and marks it pending. The design should state a precedence rule, for example "the first recorded cause wins", which matches CH-REC-B-007's rule that a cleanup failure never replaces the reported error.

**F-6 (resolved by DD-05, which re-arms an early-firing timer, so the field assertion is exact; the 20 ms tolerance stays only on the test's wall clock). "Never before `W`" was a few milliseconds too strict for Node timers.** CH-ERR-I-002 expects `elapsedMs >= timeoutMs`, and CH-FRQ-B-002 says "BUT NOT a failure before D ms". Measured locally: a 250 ms `setTimeout`, armed after 20 ms of synchronous work in the same tick, fired after **249.62 ms** by `performance.now()` (Node v26.13.0, macOS, 15 trials). This was not measured on the CI Node version. If the implementation computes `elapsedMs` from `performance.now()` around a `setTimeout`, then `elapsedMs >= timeoutMs` can fail by under a millisecond. **Needs:** either the implementation guarantees the field (for example, it fires the deadline when the measured elapsed time is `≥ W`), or the PRD states a tolerance. This plan's lower bound uses 20 ms (§ 3b).

**F-7 (applied: design DD-07, PRD v1.2 CH-OPT-B-002). Explicit `frameCaptureTimeout: undefined`.** The options merge (`PuppeteerCaptureBase.ts:51-54`) lets an explicit `undefined` replace the default. DD-07 settles it: an omitted option, an explicit `undefined` and an explicit `null` all mean the default 10 000, and the constructor does not throw. CAP-OPT tests both explicit values.

**F-8 (resolved: PRD v1.2 is on disk). PRD v1.2 was cited before it existed on disk.** The CAP-PROP-CLOSE oracle (2 × `W` plus ffmpeg finalisation, and first cause wins) now matches PRD v1.2 CH-REC-B-004 and its change-log row 1.2.

**F-9 (resolved: DD-03 revised). DD-03 was stated for `FrameCaptureTimeout` only.** DD-03 now covers any recorded frame-capture failure, including a rejected `beginFrame`. So the 003a sequence stands as written: the next `stop()` rethrows the same `injected` instance, and the one after throws `Capture is not in progress`.

## 12. Architecture Decisions

| ID | Decision | Status | Rationale |
|---|---|---|---|
| DD-01 | Bound the frame with a client-owned deadline raced against each step. Do not try to cancel the CDP call. | proposed (ratification pending) | CDP `beginFrame` cannot be cancelled. `CDPSession.send` has no abort. The race is the only bound the client owns. |
| DD-02 | Fix the deadlock with a private internal failure signal that only `_start` (the lock holder) listens to. `_start` stops inline and rejects. Every other failure delivery keeps today's order: stop under the lock, then emit the public event. Do not release the lock during the first-frame wait. | proposed (ratification pending) | It keeps `start()`/`stop()` mutual exclusion intact. It keeps the public contract "event after output is final", which a reordering would have broken silently (product-lens finding 1). It reuses the `onPageClose` pattern. |
| DD-03 | Never clear a recorded frame-capture failure when a call delivers it. This covers a `FrameCaptureTimeout` and any other error a frame request fails with, such as a rejected `beginFrame`. On every path, the next `stop()` rethrows the same instance once, as `stop()` already does for `Page was closed` and `Session was disconnected`. (Revised: the first version cleared the error after `start()` rejected.) | proposed (ratification pending) | One rule for callers. The first version made `stop()` throw a generic `Capture is not in progress` after a rejected `start()`. In `try { start } finally { stop }`, that generic error replaced the named one, so an `instanceof` check missed it (product-lens re-grade). The cost is that a caller who catches the `start()` rejection and then calls `stop()` sees the same instance twice. Alternative not taken: make `stop()` resolve quietly after a rejected `start()`, which adds a second rule. |
| DD-04 | Bound `frameCaptureTimeout` to 1…2 147 483 647 ms | proposed (ratification pending) | Node's timer overflow (§ 8). |
| DD-06 | On the `start()` and `waitForTimeout()` failure paths, deliver the rejection and the event once the output is final (drain settled, ffmpeg exited, `captureStopped` emitted). Run the CDP cleanup after delivery, still under the lock and bounded at 1×. `stop()` still awaits the cleanup. | proposed (ratification pending) | Without it, a session that answers nothing after the stall (A-05) delays the rejection to about 2× the watchdog plus finalisation. That breaks the CH-REC-Q-001 MUST (product-lens re-grade, blocking). Alternative not taken: loosen CH-REC-Q-001 to 2×, which makes every stalled `start()` slower for a cleanup the caller does not need. |
| DD-05 | When the deadline fires, yield once with `setImmediate`, re-check that the frame is still unsettled, then fail it | proposed (ratification pending) | Node runs timers before the I/O poll phase in a loop turn. A reply that already arrived while user code blocked the event loop would otherwise lose to the timer: a false stall. One yield lets the poll phase handle it first. This is a hypothesis about the risk (product-lens finding 7), and it costs one tick per expiry. If the timer fired early (measured: a 250 ms Node timer fired after 249.62 ms by `performance.now()`, Node v26.13.0 on macOS, per the test plan), re-arm for the remainder instead of failing. So `elapsedMs ≥ timeoutMs` holds by construction (CH-ERR-I-002). |
| DD-07 | An omitted `frameCaptureTimeout`, or one set explicitly to `undefined` or `null`, means the default | proposed (ratification pending) | The constructor merges options with an object spread (`PuppeteerCaptureBase.ts:51-54`), so an explicit `undefined` would otherwise replace the default. Callers who forward an unset config value expect the default. Alternative not taken: throw, as `options.fps == null` does; that would break such callers for an optional, additive option. |
| DD-08 | First cause wins: `_error` is written only when nothing is recorded yet, for every writer (stall or rejected frame, page close, session disconnect, ffmpeg error) | proposed (ratification pending) | At `185a1ad`, `onPageClose` and `onSessionDisconnected` overwrite `_error` unconditionally, so the error a later `stop()` reports would depend on timing. The first failure is the one that caused the rest. |
| DD-09 | A frame failure that settles while a stop drains fires `frameCaptureFailed` once, after `captureStopped`, with the recorded first cause; on `stop()`, before `stop()` settles | proposed (ratification pending) | PRD CH-REC-B-005 promises one event per failure, with the instance the awaiting call rejects with. At `185a1ad` the drain drops the failure silently, so a listener never hears of it. Alternative not taken: no event during a drain, which leaves CAP-PROP-EVENT's STOP case with nothing to observe and a listener-only caller blind to the failure. |
| DD-10 | When an internal stop (page close, session disconnect, or an ffmpeg error, which records the error and runs `_stop`) ends the capture while `waitForTimeout()` is pending, `waitForTimeout()` rejects with the recorded first cause once `captureStopped` has fired, with stalled or healthy frames | proposed (ratification pending) | At `185a1ad` it waits forever, because it listens only to frame events and the internal stop drops the in-flight reply. G1 promises every waiting call settles. This widens #341 to the healthy-frame case, which is a defect that exists before this gap's change. Alternative not taken: carve the case out of G1 and B-002 and track it apart. |
| DD-11 | The setup calls a `start()` makes before its first frame (the injector and `activate()` evaluates, `HeadlessExperimental.enable`) stay unbounded; a restart and its D-10 promise are bounded only while the session answers them, and the documented remedy for a wedged session is a new page | proposed (ratification pending) | A stall that wedges the whole session is assumption A-05, unverified; OQ-02 (#343) asks it. Bounding setup now would add a public `stage` value to `FrameCaptureTimeout` on no evidence. The cleanup bound differs: every stop after a stall runs cleanup, while a restart is the caller's choice. Alternative not taken: arm a setup race now, rejecting with a new `stage` value. The cost of the choice is a restart, or a page close during it, that waits without end on a wedged session. |
| DD-12 | A wait settles on the recorder's recorded state, never only on a frame event. Every failure is recorded through the one guarded writer (DD-08), and that writer fires the internal signal (DD-02). `start()`'s first-frame wait reads a failure recorded before it began and listens to the signal after, so it settles on whichever comes first: the first frame captured, or a failure recorded by any writer (stall, rejected frame, page close, disconnect, ffmpeg error, a frame request that cannot be sent). `_start` registers its `close` handler and resets the recorded failure before its first await, and `onPostCaptureStarted` records a failure when it finds the page or the session detached. `waitForTimeout()` settles on `captureStopped` as well as its frame events (DD-10). Any frame request that cannot be sent records its error through the failure path instead of throwing inside its timer callback. | proposed (ratification pending) | Stage 3.7 runs 1 to 8 each found one more pairing of a pending call and a trigger that left the call waiting, because each wait listened only to frame events and each pairing was owned cell by cell. Run 8 found a page close, disconnect or ffmpeg error in the screenshot-less retry gap while `start()` holds the lock: the retry returns on the recorded error and nothing frees the lock. Moving the rule into the writer every stop source passes through, and into the two waits, covers every writer at once, including one added later. Its cost is one behaviour change: such a failure during `start()`'s first-frame wait now rejects `start()` even when the frame would have answered, where at `185a1ad` `start()` resolved and the capture was then stopped behind the caller. Alternative not taken: own each cell with its own criterion, which eight gate runs showed does not converge. |
| DD-13 | `detach()` takes the start/stop lock: it waits for a running `start()`, `stop()` or pending cleanup, then rejects with `Capture is in progress` if a capture still runs, changing nothing. The internal stops on page close and disconnect, which hold the lock already, detach through the inner step and are unaffected. | proposed (ratification pending) | At `185a1ad` `detach()` takes no lock. A caller's `detach()` during a capture sets `page` to `null` under a running frame loop: the next frame request throws `Not attached to a page` inside its timer callback, an uncaught exception; a queued stop throws the same error; a pending `waitForTimeout()` never settles; and a `detach()` during a draining `stop()` makes that stop throw when it removes its page listener. The README's example stops before it detaches, so no documented flow detaches mid-capture. Alternative not taken: carve `detach()` during a capture out of G1 as an unsupported call order, as the caller-`stop()` wait is; that leaves an uncaught exception and two hangs a small guard removes. |
| D-01…D-14 | Inherited from the PRD (§ Ratification-pending decisions) | proposed (ratification pending) | See the PRD. Each stands alone. |

No architecture decision record file is written into `docs/decisions/`. DD-01 and DD-02 are local to two classes and reversible in one change. Recording them here keeps them next to the requirements they serve. If the maintainer prefers ADRs, both convert directly.

## 12b. Alternatives Considered and Drawbacks

**Bounding mechanism (DD-01)**

| Option | Verdict | Why |
|---|---|---|
| A. One deadline per logical frame, raced against each step (chosen) | chosen | Covers the evaluates, `beginFrame` and the retries. One timer per frame. Late replies are droppable by record state. |
| B. One timeout per CDP call | rejected | An endless run of screenshot-less replies never expires. Misses the D-05 scope. |
| C. A global "no frame for N ms" heartbeat on an interval | rejected | Adds a second timer lifecycle that has to be torn down on every path. Its error cannot name the stalled frame's stage or ticks without the per-frame state anyway. |
| D. Kill and recreate the CDP session on stall | rejected | That is recovery, not liveness. It depends on OQ-02 (is the session usable?), which is unanswered. Out of appetite. |

**Deadlock fix (DD-02)**

| Option | Verdict | Why |
|---|---|---|
| A. Internal signal to the lock holder; public event after the scheduled stop; `_start` stops inline (chosen) | chosen | Smallest change that keeps today's public event order. Reuses an existing pattern. Keeps mutual exclusion. |
| A′. Emit the public event first, stop later (first draft) | rejected | It reorders a public contract: callers would see `frameCaptureFailed` and the `waitForTimeout()` rejection before the output is final, and `stop()` rethrows before the scheduled stop finishes. Found by the product lens. |
| B. Release the lock during the first-frame wait | rejected | Opens a concurrency window `start`/`stop` never had. |
| C. Make `onFrameCaptureFailed` call `_stop` directly (lock-free) | rejected | Two `_stop` runs could interleave (failure path and a user `stop()`). The drain and the ffmpeg teardown are not re-entrant. |

**Delivery before cleanup (DD-06)**

| Option | Verdict | Why |
|---|---|---|
| a. Deliver once the output is final; run the CDP cleanup afterwards under the lock (chosen) | chosen | Keeps the CH-REC-Q-001 MUST and the "event after output is final" order. |
| b. Keep cleanup inside the span; amend CH-REC-Q-001 to ≤ 2× watchdog plus ffmpeg finalisation | rejected | Doubles the worst-case wait for every stalled `start()`, at the default about 20 s, for a cleanup the caller does not need. |
| c. Run the cleanup outside the lock | rejected | A new `start()` could interleave with the old session's cleanup. |

**Drawbacks of the chosen design**: a pending CDP promise for the stalled `beginFrame` stays unresolved inside puppeteer-core until the session closes. This is accepted: the recorder holds no reference to it after settling. A default of 10 000 ms means a real stall still costs 10 s, and a test with the default watchdog cannot detect a stall faster than that. Tests set the option low (CH-TST-C-001).

## 13. Quality Requirements

| Attribute | Target | How the design meets it |
|---|---|---|
| CH-REC-Q-001 liveness bound | MUST ≤ watchdog + 1 000 ms; GOAL ≤ watchdog + 250 ms | C3 deadline plus C4 delivery. The CDP cleanup runs after the rejection (DD-06), so it is outside the measured span for `start()`/`waitForTimeout()`, as R1 and R2 show. ffmpeg finalisation is inside that span: the margin covers it for the few frames the tests capture, and a long capture with many queued frames can take longer to finalise. PRD v1.2 states this in the MUST, and the docs (C7) do not promise a rejection at exactly the watchdog duration. For `stop()` the span ends at the drain's end, per the PRD SCALE. |
| CH-REC-Q-002 no false stalls | 0 | Default 10 000 ms against an observed max of 165 ms (E4). A-04 large-viewport validation run (§ 14). |
| CH-REC-B-007 cleanup bound | `stop()` within 2 × watchdog plus ffmpeg finalisation | The drain is bounded by the remaining deadline (≤ 1×). **Finding**: with several frames in a page, sequential per-frame evaluates raced one by one could exceed 2× if each one hangs. So the whole cleanup block is raced against one 1× deadline, not each call separately. This is recorded as the design's reading of CH-REC-B-007. |
| CH-REC-B-004 internal stop bound | within 2 × watchdog plus ffmpeg finalisation (PRD v1.2) | The internal stop-and-detach includes the drain (≤ 1×) and the cleanup block (≤ 1×). PRD v1.0/1.1 tied it to the CH-REC-Q-001 bound, which a stop that includes cleanup cannot meet; v1.2 corrects that (ratification pending). |

## 14. Risks and Open Questions

### Feasibility summary

| Component | Verdict | Basis |
|---|---|---|
| C1 error class | FEASIBLE | Two existing classes follow the same pattern. |
| C2 option | FEASIBLE | `options.fps` validation precedent. |
| C3 frame deadline | FEASIBLE | `setTimeout` plus a race. The frame loop is one method (`doRequestFrameCapture`, ~45 lines). |
| C4 failure ordering | FEASIBLE | The pattern exists in `onPageClose`. The model (E5/F10) shows the defect, and the regression test runs against the real class. |
| C5 bounded stop and cleanup | FEASIBLE | Same race helper. |
| C6 tests | FEASIBLE (cost noted) | `PuppeteerCaptureViaHeadlessExperimental.unit.test.ts` mocks only a browser object (`createMockBrowser`, lines 14-21), and the `fluent-ffmpeg` mock in `PuppeteerCaptureBase.test.ts` never ends, so a real `stop()` would wait at `PuppeteerCaptureBase.ts:301-302`. A new fixture is needed: a mocked page and CDP session plus an ffmpeg mock that exits. That build cost sits inside the D-11 appetite but is not free. A never-settling `session.send` is a `new Promise(() => {})`. |
| C7 docs | FEASIBLE | Anchors exist: README `### PuppeteerCaptureOptions` (line 90), `#### Methods` (126), `### Error Classes` (176). |
| C8 investigation | FEASIBLE-WITH-SPIKE | It is the spike. Reproduction is not guaranteed; the result is recorded either way. |

No Must-Have component is UNCERTAIN or INFEASIBLE.

### Risk register

| ID | Risk | L | I | Score | Mitigation |
|---|---|---|---|---|---|
| R-1 | Failure-ordering change (C4) alters `start`/`stop` concurrency in a way existing tests miss | 2 | 3 | 6 MEDIUM | CH-TST-C-003 against the real class. The existing repeated start/stop and page-close tests stay green. Design constraint: mutual exclusion is kept (DD-02). |
| R-2 | Stall during `stop()` swallowed by today's `!_isCapturing` early-out | 3 | 2 | 6 MEDIUM | Design constraint, strategy 3. A test drives R3. |
| R-3 | Cleanup CDP calls hang after a stall (A-05) | 2 | 2 | 4 MEDIUM | C5 races the whole cleanup block (§ 13 finding). |
| R-4 | False stalls on slow user hardware or large viewports (A-04) | 1 | 2 | 2 LOW | Configurable option. A-04 validation run: one integration capture at 3840×2160, max latency recorded. |
| R-5 | Open timer handle left after a healthy capture | 2 | 1 | 2 LOW | CH-FRQ-B-004, asserted directly by the tests. `--detectOpenHandles` cannot fail the run (§ 2). |
| R-6 | Root cause keeps producing stalls, now as errors | 2 | 2 | 4 MEDIUM | C8 spike, filed as its own tracked item now, not only when D-12's gate fires. Per-run stall rate (OQ-04) measured before and after merge. |
| R-7 | A blocked event loop lets the timer win over a reply that already arrived (false stall) | 1 | 2 | 2 LOW | DD-05: one `setImmediate` yield before failing. This is a hypothesis, not observed. |
| R-8 | A user sets a huge timeout as an off switch, and Node's overflow makes it 1 ms | 2 | 2 | 4 MEDIUM | DD-04 upper bound, validated in the constructor. |

**Rabbit holes (10× test)**: C8 is the only one, because reproducing a Chrome-internal stall may not converge. It is time-boxed to half a day (D-11) and its outcome is recorded whatever it finds. The fix itself (C1–C7) does not depend on it.

### Open questions

| ID | Question | Load-bearing? | Context and impact |
|---|---|---|---|
| D-01…D-14 | Ratify each PRD decision, or change it | yes | The names (D-03, D-04) and the default (D-01) are written into the public API and the docs. Changing them after release is a breaking change. |
| DD-01…DD-13 | Ratify the bounding mechanism, the deadlock fix, the one-rethrow rule, the option's upper bound, the expiry yield, delivery before cleanup, the `undefined` default, first-cause-wins, the event for a failure during a drain, the pending `waitForTimeout()` under an internal stop, the unbounded setup of every `start()`, waits keyed on recorded state, and `detach()` refusing while capturing | yes | Implementation shape for C2, C3, C4 and C5, and the public contract (DD-03, DD-04, DD-06, DD-07, DD-08, DD-12, DD-13). |
| OQ-01 | Does Chrome ever answer a stalled `beginFrame` late? | no (the design drops late replies either way) | Answered by C8. |
| OQ-02 | Is the session usable after a stall? | yes for DD-11: the restart bound and its documented remedy depend on it; no for the cleanup bound, which holds either way; yes for any later recovery design | Answered by C8 (#343), which asks about `disable`, `enable` and the setup evaluates. |
| OQ-03 | Is the KNOWN_ISSUES `defaultViewport` freeze the same defect? | no | Recorded as an open question in C7's KNOWN_ISSUES entry. |
| OQ-04 | Stall rate per integration run | no | Measured as the PRD § 4 lagging indicator. |

## 15. Glossary

| Canonical name | Definition | Technical Architecture | API Design | Testing |
|---|---|---|---|---|
| Recorder | One `PuppeteerCapture` instance attached to one page | `PuppeteerCaptureBase` / `PuppeteerCaptureViaHeadlessExperimental` | `PuppeteerCapture` | real class / `TestCapture` |
| FrameRequest | One logical frame at capture timestamp T, from the first `process(T)` evaluate to settlement | `FrameRequest` record (C3) | — | "stalled frame" |
| StallError | The error raised when a FrameRequest's deadline fires | `FrameCaptureTimeout` (D-04) | `FrameCaptureTimeout` | StallError |
| watchdog | The single deadline of one FrameRequest | frame deadline | `frameCaptureTimeout` option (D-03) | watchdog |
| screenshot-less reply | A `beginFrame` reply without `screenshotData` | `screenshotlessReplies` count | field `screenshotlessReplies` | E1/E2 signature |

## 16. Requirement-to-Track Coverage Matrix

| Requirement | Tracks | Covered at | Test capability | Status |
|---|---|---|---|---|
| CH-FRQ-B-001 | TA | § 4.1, C3 | CAP-WD-ARM | covered |
| CH-FRQ-B-002 | TA | § 4.1, C3, R1 | CAP-WD-EXPIRE | covered |
| CH-FRQ-B-003 | TA | § 4.1, C3 | CAP-WD-RETRY | covered |
| CH-FRQ-B-004 | TA, Testing | C3; § 13 R-5 | CAP-WD-DISARM | covered |
| CH-FRQ-B-005 | TA | C3, R5 | CAP-WD-LATE | covered |
| CH-OPT-I-001 | API | § 8, C2 | CAP-OPT | covered |
| CH-OPT-B-002 | API | § 8, C2 | CAP-OPT | covered |
| CH-REC-B-001 | TA | § 4.2, C4, R1 | CAP-PROP-START | covered |
| CH-REC-B-002 | TA | C4, R2, R6 | CAP-PROP-WAIT, CAP-PROP-CLOSE (f) | covered |
| CH-REC-B-003 | TA | § 4.3, C5, R3 | CAP-PROP-STOP | covered |
| CH-REC-B-004 | TA | C5, R4, § 13 | CAP-PROP-CLOSE | covered |
| CH-REC-B-005 | TA, API | C4, § 8 | CAP-PROP-EVENT | covered |
| CH-REC-B-006 | TA | C4, § 8, DD-11 | CAP-PROP-REUSE | covered while the session answers setup calls (PRD v1.6, DD-11) |
| CH-REC-B-007 | TA | § 4.4, C5, § 13 | CAP-CLEANUP | covered |
| CH-REC-B-008 | TA | § 4.2 (DD-12), C3, C4, R7 | CAP-PROP-START (d)–(f), CAP-WD-DISARM (c) | covered |
| CH-REC-B-009 | TA, API | § 4.6 (DD-13), C5, § 8 | CAP-DETACH | covered |
| CH-REC-Q-001 | TA, Testing | § 13 | CAP-PROP-START/WAIT/STOP (timed) | covered under the METER's conditions (few queued frames; PRD v1.2 MUST names finalisation) |
| CH-REC-Q-002 | Testing | § 13, R-4 | CAP-FALSE-STALL (post-merge meter) | covered (post-merge meter) |
| CH-ERR-I-001 | API | § 8, C1 | CAP-ERR | covered |
| CH-ERR-I-002 | API | § 8, C1 | CAP-ERR | covered |
| CH-FRQ-C-001 | TA | § 1b | CAP-CONSTRAINT (review check) | covered |
| CH-FRQ-C-002 | TA | § 4.5 | CAP-CONSTRAINT (diff check) | covered |
| CH-FRQ-C-003 | TA | C8 | non-testable (investigation output) | covered |
| CH-DOC-C-001…004 | API | C7 | non-testable (documentation) | covered |
| CH-TST-C-001…003 | Testing | C6, § 11a | they are the tests | covered |

UNCOVERED: none.

## 16b. Element-to-Requirement Backward-Coverage Matrix

No wireframe handoff package exists (no UX track), so the tracked elements are this design's components, its design decisions DD-01 to DD-13 and its cleanup-block reading.

| Element | Type | Traces to | Provenance | Status |
|---|---|---|---|---|
| C1 | component | CH-ERR-I-001, CH-ERR-I-002 | PRD § 10.3 | traced |
| C2 | component | CH-OPT-I-001, CH-OPT-B-002 | PRD § 10.1 | traced |
| C3 | component | CH-FRQ-B-001…005, CH-REC-B-008 | PRD § 10.1, § 10.2 | traced |
| C4 | component | CH-REC-B-001, -002, -005, -006, -008 | PRD § 10.2 | traced |
| C5 | component | CH-REC-B-003, -004, -007, -009 | PRD § 10.2 | traced |
| C6 | component | CH-TST-C-001…003 | PRD § 10.6 | traced |
| C7 | component | CH-DOC-C-001…004 | PRD § 10.5 | traced |
| C8 | component | CH-FRQ-C-003 | PRD § 10.4 | traced |
| DD-01 | decision | CH-FRQ-B-001, CH-FRQ-B-002 | this document | traced |
| DD-02 | decision | CH-REC-B-001, CH-REC-B-002 | this document | traced |
| DD-03 | decision | CH-REC-B-003, CH-REC-B-006 (D-06) | this document | traced |
| DD-06 | decision | CH-REC-B-001, CH-REC-B-002, CH-REC-Q-001 | this document | traced |
| DD-04 | decision | CH-OPT-B-002 (D-07) | this document | traced (narrows the valid range; PRD amended to match) |
| DD-05 | decision | CH-REC-Q-002, CH-ERR-I-002 | this document | traced |
| DD-07 | decision | CH-OPT-I-001, CH-OPT-B-002 | this document | traced (PRD v1.2 amended to match) |
| DD-08 | decision | CH-REC-B-004 | this document | traced (PRD v1.2 amended to match) |
| DD-09 | decision | CH-REC-B-003, CH-REC-B-005 | this document | traced (PRD v1.5 amended to match) |
| DD-10 | decision | CH-REC-B-002, CH-REC-B-004 | this document | traced (PRD v1.5 amended to match) |
| DD-11 | decision | CH-REC-B-006 (D-10) | this document | traced (PRD v1.6 amended to match) |
| DD-12 | decision | CH-REC-B-008, CH-REC-B-001, CH-REC-B-002 | this document | traced (PRD v1.8 amended to match) |
| DD-13 | decision | CH-REC-B-009 | this document | traced (PRD v1.8 amended to match) |
| § 13 cleanup-block reading | design reading | CH-REC-B-007 | this document | traced (it narrows how B-007 is met, and adds no scope) |

PHANTOM: none. Each traced requirement is itself ratification-pending (PRD § 14), so "traced" means traced to a PRD row, not to a ratified requirement. The provenance gap is recorded in § 14 and in the brief.

## Readiness and lock

- Feasibility gate: pass. Risk gate: pass (no HIGH risk). Quality gate: security N/A, reliability addressed (§ 13, § 14).
- Coverage gates: forward UNCOVERED = 0; backward PHANTOM = 0.
- Dual-lens ratification: see the companion brief.
- Lock: **not locked**. Load-bearing open questions stand (D-01…D-14, DD-01…DD-13), so the brief's status stays `draft`.
