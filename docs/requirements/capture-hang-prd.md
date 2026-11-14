---
scope: Capture liveness (frame-request watchdog)
created: 2026-11-14
profile: full
formulation:
  technical-architecture: complete
  api-design: complete
  testing-architecture: complete
features:
  frame-watchdog:
    stage: solution-design
    tracks: [technical-architecture, api-design, testing-architecture]
  stall-propagation:
    stage: solution-design
    tracks: [technical-architecture, api-design, testing-architecture]
  stall-diagnostics:
    stage: solution-design
    tracks: [technical-architecture, api-design, testing-architecture]
  retry-path-investigation:
    stage: solution-design
    tracks: [technical-architecture]
  release-documentation:
    stage: solution-design
    tracks: [api-design]
artifacts:
  design-doc: docs/design/capture-hang-solution-design.md
  design-brief: docs/design/capture-hang-brief.md
dor_status: failed
---

# Capture liveness (frame-request watchdog) — Product Requirements Document

**Version**: 1.8
**Created**: 2026-11-14
**Last Updated**: 2026-11-14
**Status**: Draft — ratification pending (see § Ratification-pending decisions and § 14, Origin column)
**Sources**:

- `S1` — the scoping run's fact sheet, sections F1–F9 (a scratch file of that run, not committed; the measured facts this PRD relies on are reproduced in § 2 Evidence) (baseline `main` @ `185a1ad`, read 2026-11-14T19:31:05Z). F1–F4 and F9 are measured; F5 is hypotheses only.
- `S2` — code read at `185a1ad`: `src/PuppeteerCaptureViaHeadlessExperimental.ts` (lines 131–236), `src/PuppeteerCaptureBase.ts` (lines 18–26, 135–400), `src/PuppeteerCaptureBase.test.ts` (lines 354–369), `src/PuppeteerCaptureViaHeadlessExperimental.test.ts` (lines 101–168), `KNOWN_ISSUES.md`, `README.md` § API Reference, `CHANGELOG.md`.
- `S3` — measurements taken during this capture run on the two saved CI job logs named in F1 and F2 (see § 2 Evidence, rows E3 and E4).
- `S4` — a scratch model of the start/stop lock ordering, run during this capture run (see § 2 Evidence, row E5).
- `S5` — issue #12 (closed), a user report of `start()` never resolving, read with `gh issue view` (read-only).
- `S6` — council panel guidance, fact sheet F6.
- Protocol reference: Chrome DevTools Protocol, `HeadlessExperimental.beginFrame`, pinned source
  <https://github.com/ChromeDevTools/devtools-protocol/blob/dd55cb67621a728bba3d23e056f2de2ca1e7c906/pdl/domains/HeadlessExperimental.pdl#L24-L50>.

> Classification: corrective defect, `Audit findings` (owner-confirmed classification, per the scope brief). This PRD specifies a liveness fix. It is not a new product idea, so no existence or desirability gate was run.

## 1. TL;DR

One unanswered `HeadlessExperimental.beginFrame` makes `start()`, `waitForTimeout()` and `stop()` wait forever, because nothing bounds a frame request. It has happened twice in CI (2026-09-19 and 2026-11-14), both times on the first frame of a capture, both times right after the only screenshot-less reply in the run.

The fix bounds every wait on a frame request with a per-frame watchdog. When the watchdog expires, every awaiting public call rejects with one named error that says which frame stalled and for how long. The watchdog alone is not enough: a code-path model built during this run shows that the existing failure path deadlocks when the failure arrives while `start()` waits for its first frame — the exact place both observed stalls happened. So the requirements also cover that lock ordering and the CDP cleanup calls `stop()` makes.

Why Chrome stops answering is not known. Three hypotheses are recorded (§ 12, A-01 to A-03); the retry path that precedes every observed stall is investigated before it is changed. The behaviour change, a hang becoming a rejection, ships with README, KNOWN_ISSUES and CHANGELOG entries.

## 2. Problem Statement

**Why this matters.** A recorder that hangs gives its caller nothing to act on: no error, no event, no timeout, no partial output. A script that calls `await recorder.start(...)` waits until something outside it kills the process. In CI that something is Jest's 30 000 ms test timeout; in user code there may be nothing.

**Who has this problem.**

- Library users. `waitForFirstFrame: true` is the default (`PuppeteerCaptureBase.ts:25`), so the default call path is exposed. Issue #12 (closed 2024-12-18) is a user report of the same symptom, "`PuppeteerCapture.start` never returns completed promise", with a different cause (a Chrome 109 / Puppeteer 19.5 combination). It shows the symptom reaches users; it is not evidence of this specific cause.
- The maintainer and every pull request. The sibling gap `gap-phantom-required-checks` records the owner decision that the aggregate `ci-ok` job will require every integration cell (fact sheet F7). From then on a capture hang blocks merges until someone re-runs the job.

**Current state.** No workaround exists in the library. Callers can wrap calls in their own `Promise.race` timeout, but the recorder's internal `_frameBeingCaptured` stays pending, so a later `stop()` hangs too (`PuppeteerCaptureBase.ts:282`). The CI workaround today is re-running the job.

**Evidence.**

| ID | Observation | Source | What it means here |
|---|---|---|---|
| E1 | CI run 43566065391, job 132360535486, `integration (ubuntu-24.04, 24.5.0)`, 2026-11-14: `beginFrame` id 3 sent 06:25:32.277Z, never answered; no protocol traffic until Jest closes the browser 06:26:02.020Z. Test `that capture works with custom viewport size` timed out; 89 of 90 passed. | S1 F1 | The hang is in `start()`'s first-frame wait: `page.setViewport` (test line 112) never ran. |
| E2 | CI run 35426449460, job 105853320073, `integration (windows-2022, 24.42.0)`, 2026-09-19: `beginFrame` id 34 never answered; next traffic is `Browser.close` 29 s later. Test `that capture stops gracefully on page close` timed out. | S1 F2; test file lines 153–168 | No `page.close()` traffic appears, so this hang is also inside `start()` (test line 163). |
| E3 | In both job logs, exactly one `beginFrame` reply lacks `screenshotData`, and it is the reply immediately before the stalled request. Job 132360535486: 205 sends, 204 answered, 1 unanswered. Job 105853320073: 210 sends, 209 answered, 1 unanswered. | S1 F3; recount S3 | Strong correlation, n = 2. Not a mechanism. |
| E4 | `beginFrame` round-trip latency over every answered request. Job 132360535486: min 10 ms, p50 12 ms, p95 19 ms, p99 113 ms, max 165 ms. Job 105853320073: min 5 ms, p50 7 ms, p95 18 ms, p99 25 ms, max 83 ms. | S3, measured 2026-11-14 with a scratch script pairing SEND/RECV by id and session | Baseline for choosing the watchdog default (D-01). Two CI runners only; user hardware and very large viewports are not covered. |
| E5 | A scratch model of the lock ordering (async-mutex `Mutex`; `start()` holds it while awaiting the first-frame event; the failure handler awaits `stop()`, which needs the same lock, before it emits `frameCaptureFailed`): after a simulated failure at 10 ms, `start()` was still pending at 2000 ms. | S4, run 2026-11-14 against the repository's installed `async-mutex` | The existing failure path cannot reject `start()`'s first-frame wait; it deadlocks. This is a model of the code at `185a1ad`, not a run of the real class. The fact sheet's F4 statement that this path "already rejects `start()`'s first-frame wait" does not hold for `start()` by this model; it does hold for `waitForTimeout()`, which runs outside the lock. |
| E6 | The protocol states: "Sends a BeginFrame to the target and returns when the frame was completed." It states no reply deadline. It also states: "capturing a screenshot can fail, for example, during renderer initialization. In such a case, no screenshot data will be returned." | Pinned CDP source above (S1 F9) | The client owns liveness. A screenshot-less reply is a documented case, so the retry branch is expected protocol behaviour. Both stalls were at `frameTimeTicks: 0`, the first frame, which is consistent with renderer initialization — an observation, not a proof. |

**Why now, and what doing nothing costs.** Once every integration cell is required (F7), each stall turns a green pull request red for 30 s of timeout plus a manual re-run, and a Dependabot bump can sit blocked until someone notices. For users, the cost of doing nothing is an unbounded hang with no diagnostic. The failure rate is not known: the denominator (total integration runs in the period) was not measured (§ 8, OQ-04).

## 3. Boundaries

- **Appetite:** small batch, about one to two working days of build plus review, excluding the root-cause investigation spike, which is time-boxed separately to half a day. Set autonomously; ratification pending (D-11).
- **In scope:** a per-frame watchdog bounding every wait on a frame request (the first-frame wait in `start()`, `waitForTimeout()`, the drain loop in `stop()`, and the internal stop run on page close or session disconnect); a named error with diagnostic fields; the lock ordering that lets that error reach `start()`; bounding the CDP cleanup calls `stop()` makes after a stall; a time-boxed investigation of the screenshot-less retry path; README, KNOWN_ISSUES and CHANGELOG entries and a release-note line for the behaviour change.
- **Out of scope, not yet:**
  - Changing the retry path's `frameTimeTicks` handling. Deferred because the mechanism is unverified (A-01 to A-03). Reopens when the investigation (CH-FRQ-C-003) confirms H1 or H2, or when the decision gate in § 4 fires.
  - Distinguishing a stalled frame from a crashed renderer (`targetCrashed`). Deferred because the watchdog covers both for liveness. Reopens if users need different recovery for the two.
- **Explicitly not building:**
  - Raising the Jest `testTimeout` or `--testTimeout`. Never: it hides the hang instead of ending it (F6).
  - Test retries, or automatic re-sending of `beginFrame` after a watchdog expiry. Never: a retry turns a liveness bound into a longer hang and masks the defect (F6).
  - CI required-check wiring. Never in this PRD: owned by the sibling gap `gap-phantom-required-checks`.
  - macOS support. Never in this PRD: `HeadlessExperimental` is unavailable on macOS (KNOWN_ISSUES).

## 4. Success Criteria

- **Serves:** caller liveness: every public recorder call that waits on a frame settles in bounded time, with two exceptions the design records: the setup calls any `start()` makes before its first frame, the first start included, on a session that answers nothing (DD-11), and a `waitForTimeout()` pending when the caller's own `stop()` ends the capture with no failure recorded, left open for the maintainer. The bound holds by one rule, not case by case: a wait settles on the recorder's recorded state, never only on a frame event (CH-REC-B-008, design DD-12). Under required integration cells (F7), a stall then fails one test quickly with a named error instead of holding a CI job until Jest's 30 000 ms timeout. This work does not lower how often Chrome stalls (design § 1), so a stall still fails its CI cell. Lowering the stall rate is the root-cause work behind the decision gates below.
- **Meter owner:** the maintainer runs the leading and lagging meters below. No tracked item owns them (D-13, ratification pending).
- **Leading indicators (within two weeks of merge):**
  - The stalled-frame tests (CH-TST-C-001 to CH-TST-C-003) pass on every cell of the CI matrix (Ubuntu 24.04 and Windows 2022).
  - Zero integration-job failures with `Exceeded timeout of 30000 ms` in a capture test since the merge (meter: `gh run list` over integration jobs, then a log grep).
- **Lagging indicators (30, 60, 90 days):**
  - Count of integration-job failures with `Exceeded timeout of 30000 ms` in a capture test: 0 at each checkpoint.
  - Count of failures reporting the named stall error, with each one's diagnostic fields. This is the new observability: its frequency and the `screenshotlessReplies` field decide the root-cause work.
- **Decision gates:**
  - If the named stall error appears in CI one or more times within 30 days of merge with `screenshotlessReplies ≥ 1`, prioritise the retry-path change after the investigation reports (threshold: D-12).
  - If a Jest-timeout failure in a capture test recurs after merge, the bound is incomplete somewhere; reopen this PRD at § 10.

## 5. Proposed Solution

User scenarios at sketch altitude; technical design belongs to the solution design document.

1. **Stall during start.** A user calls `await recorder.start('out.mp4')`. Chrome never answers the first `beginFrame`. After the watchdog duration, `start()` rejects with the named stall error. Its message names capture timestamp 0, `frameTimeTicks` 0, the elapsed time, the configured timeout, the stage that did not settle, and the count of screenshot-less replies. The `frameCaptureFailed` event fired once with the same error.
2. **Stall during waitForTimeout.** Capture is running; `await recorder.waitForTimeout(1000)` is pending; a frame stalls mid-way. `waitForTimeout()` rejects with the same error; the output holds every frame captured before the stall.
3. **Stall during stop.** The user calls `await recorder.stop()` while a frame request is outstanding and Chrome never answers it. `stop()` waits at most the remaining watchdog time, finalises the video with the frames captured so far, then rejects with the stall error (D-06).
4. **Page close or disconnect during a stall.** The internal stop-and-detach run finishes in bounded time; a later `stop()` reports the error it recorded.
5. **Slow but healthy machine.** The user raises the watchdog through the capture option (D-02, D-03) so slow frames are not misreported.

## 6. Risks and Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| False positive: a healthy but slow frame (very large viewport, loaded host) exceeds the default and fails a capture that would have succeeded. | Low on CI by E4 (max 165 ms against a 10 000 ms default); unmeasured on user hardware. | Configurable duration (D-02); default far above observed latency (D-01); validate A-04 with a large-viewport integration run. |
| The watchdog ends the hang but hides the root cause, so stalls keep happening as errors. | Medium. | Diagnostic fields (CH-ERR-I-002); decision gate in § 4; investigation spike CH-FRQ-C-003. |
| After a stall, the cleanup CDP calls (`frame.evaluate` deactivate/ejector, `HeadlessExperimental.disable`) also never settle, so `stop()` hangs on cleanup instead of the drain. | Unknown (A-05). | CH-REC-B-007 bounds cleanup with the same watchdog. |
| The lock-ordering fix changes `start()`/`stop()` concurrency semantics in ways existing tests do not cover. | Medium. | CH-TST-C-003a drives the deadlock case against the real class; the existing repeated start/stop and page-close tests stay green. |
| A late `beginFrame` reply arrives after the watchdog fired and writes a frame into a finished stream. | Unknown (OQ-01). | CH-FRQ-B-005 discards late replies. |
| Callers that relied on a hang (none known) see a rejection. | Very low. | CHANGELOG and release note name the behaviour change (CH-DOC-C-003, CH-DOC-C-004). |

## 7. Dependencies

- Chrome DevTools Protocol `HeadlessExperimental.beginFrame` (pinned source above). The protocol states no reply deadline (E6), which is why the client owns the bound.
- `async-mutex` (`^0.5.0`): the start/stop lock whose ordering E5 models.
- Sibling gap `gap-phantom-required-checks`: once integration cells are required, this fix's leading indicators read directly off `ci-ok` (F7). No build-order dependency in either direction.
- CI keeps `DEBUG: "puppeteer:protocol:*"` on the integration step (`ci.yml` Test step), which made E1 and E2 traceable. Removing it would blind the investigation.

## 8. Open Questions

| ID | Question | Owner | How it gets answered |
|---|---|---|---|
| OQ-01 | Does Chrome ever answer a stalled `beginFrame` late? Both logs end when Jest closes the browser after 30 s. | Maintainer | CH-FRQ-C-003 investigation: keep the session open past the watchdog and log. |
| OQ-02 | Is the CDP session usable after a stall (does `HeadlessExperimental.disable` answer)? | Maintainer | Same investigation; informs D-10 and A-05. |
| OQ-03 | Is the KNOWN_ISSUES "Setting `defaultViewport` causes rendering to freeze" entry the same defect? Its documented workaround is waiting for the first frame. | Maintainer | Compare its trace, if reproducible, against E1/E2 signature. Not claimed here. |
| OQ-04 | What is the stall rate per integration run? | Maintainer | `gh run list` over integration jobs for the period 2026-09-19 to 2026-11-14 as the denominator. Not measured in this run. |

## 9. Object Model

### Objects

| Object | Code | Identity | Description | Lifecycle |
|---|---|---|---|---|
| Recorder | REC | One `PuppeteerCapture` instance attached to one page | The public API surface: `start`, `waitForTimeout`, `stop`, `detach`, events | attached → starting → capturing → stopping → stopped; capturing → failed (stall) → stopped |
| FrameRequest | FRQ | One logical frame at one capture timestamp T | The internal unit the watchdog bounds: in-page `process(T)` evaluations, then one or more `beginFrame` sends until a screenshot arrives | requested → evaluating → beginFrame-sent → (screenshot-less reply → beginFrame-sent)* → captured; any non-terminal state → stalled (watchdog) or failed (rejection) |
| StallError | ERR | One error instance per stalled FrameRequest | The named error the watchdog raises (class name: D-04) | created → emitted on `frameCaptureFailed` → rejected to awaiting callers → stored as the recorder's recorded error |
| CaptureOptions | OPT | The options object passed to `capture()` | Carries the watchdog duration (D-02, D-03) | read once at construction |
| ReleaseDocs | DOC | README, KNOWN_ISSUES, CHANGELOG, release note | User-facing statement of the behaviour change | drafted with the fix → published with the release |
| StallTestSuite | TST | The unit tests that drive a stalled frame | Verification artifact; listed as an object so its constraints are traceable | written before or with the fix |

### Relationships

| From | To | Type | Cardinality | Navigation |
|---|---|---|---|---|
| Recorder | FrameRequest | owns | 1 : 0..1 outstanding | Recorder → current FrameRequest |
| FrameRequest | StallError | raises | 1 : 0..1 | FrameRequest → StallError on expiry |
| Recorder | CaptureOptions | configured by | 1 : 1 | Recorder → options |
| Recorder | StallError | reports | 1 : 0..n over its lifetime | Recorder → recorded error |

### CTA inventory

| Object | CTA | Feature | Preconditions | Outcome |
|---|---|---|---|---|
| Recorder | start | stall-propagation | attached, not capturing | resolves on first frame, or rejects with StallError |
| Recorder | waitForTimeout | stall-propagation | capturing | resolves at target timestamp, or rejects with StallError |
| Recorder | stop | stall-propagation | capturing | finalises output; rejects with StallError when a stall occurred (D-06) |
| Recorder | (internal) page-close / disconnect stop | stall-propagation | capturing | bounded stop-and-detach; error recorded |
| Recorder | detach | stall-propagation | attached | waits for a running `start()` or `stop()`; detaches, or rejects with `Capture is in progress` while capturing (DD-13) |
| Recorder | on('frameCaptureFailed') | stall-diagnostics | — | fires once per StallError |
| FrameRequest | arm / disarm watchdog | frame-watchdog | capturing | timer scheduled / cancelled |
| FrameRequest | retry on screenshot-less reply | frame-watchdog, retry-path-investigation | reply lacks `screenshotData` | same watchdog continues (D-05) |
| FrameRequest | discard late reply | frame-watchdog | already stalled | reply ignored |
| StallError | construct / read fields | stall-diagnostics | — | message and fields populated |
| CaptureOptions | set watchdog duration | frame-watchdog | at construction | validated value or thrown error |
| ReleaseDocs | publish entries | release-documentation | fix merged | entries present |
| StallTestSuite | drive stalled frame | frame-watchdog, stall-propagation | — | assertions on rejection and bound |

### Attribute priority

| Object | Attribute | Type | Priority |
|---|---|---|---|
| StallError | `captureTimestamp` | number (ms) | primary |
| StallError | `frameTimeTicks` | number | primary |
| StallError | `elapsedMs` | number | primary |
| StallError | `timeoutMs` | number | primary |
| StallError | `stage` | `'evaluate'` \| `'beginFrame'` | primary |
| StallError | `screenshotlessReplies` | number | secondary |
| CaptureOptions | watchdog duration | number (ms) | primary |

### Entity-Feature Matrix

| Object \ Feature | frame-watchdog | stall-propagation | stall-diagnostics | retry-path-investigation | release-documentation |
|---|---|---|---|---|---|
| Recorder | — | 4 | 1 | — | — |
| FrameRequest | 3 | — | — | 1 ! | — |
| StallError | — | — | 1 | — | — |
| CaptureOptions | 1 | — | — | — | — |
| ReleaseDocs | — | — | — | — | 1 |
| StallTestSuite | 1 | 1 | — | — | — |

`!` — the retry CTA is claimed by two features: the watchdog bounds it now (D-05), and the investigation may change it later (D-08). Resolution: priority — frame-watchdog owns its behaviour in this PRD; retry-path-investigation may only change `frameTimeTicks` handling, never the bound.

## 10. Requirements

Statement form: EARS. Identifiers: `CH-{OBJECT}-{LAYER}-{NNN}` (layer `B` behavioural, `Q` quality, `C` constraint, `I` interface). Every acceptance criterion ends with its exclusions. Values marked with a decision id are ratification-pending defaults, carried as written until ratified or changed.

### 10.1 Frame watchdog {#feature-frame-watchdog}

**CH-FRQ-B-001 — Arm one watchdog per logical frame.**
When the recorder begins a frame request for capture timestamp T, the system shall start one watchdog for that frame request, measuring wall-clock time from before the first in-page `process(T)` evaluation.

- GIVEN an attached recorder that is capturing
- WHEN it begins the frame request for capture timestamp T
- THEN exactly one watchdog is scheduled for T, and its start time precedes the first `Runtime.evaluate` of `process(T)`
- BUT NOT a watchdog that starts only at the `beginFrame` send, because the in-page evaluations are part of the same unbounded wait
- BUT NOT a second concurrent watchdog for the same frame request

**CH-FRQ-B-002 — Fail the frame on expiry.**
While capturing, when the watchdog of an outstanding frame request expires before that frame has produced screenshot data, the system shall fail that frame request with a StallError (class name D-04) and shall send no further `HeadlessExperimental.beginFrame` in that capture session.

- GIVEN a capturing recorder whose CDP session never answers `beginFrame`, and a watchdog duration of D ms
- WHEN D ms pass since the frame request began
- THEN the frame request fails with a StallError, and the protocol trace shows no further `beginFrame` send for that session
- BUT NOT a re-send of `beginFrame` after expiry
- BUT NOT a failure before D ms have passed

**CH-FRQ-B-003 — Retries stay inside one watchdog.**
When a `beginFrame` reply lacks `screenshotData`, the system shall re-request the same frame under the watchdog already running for it (D-05).

- GIVEN a frame request whose first `beginFrame` reply is `{"hasDamage":true}` with no `screenshotData`
- WHEN the system re-requests the frame
- THEN the elapsed time keeps counting from the original start, and the frame's screenshot-less reply count becomes 1
- BUT NOT a fresh watchdog per re-request, which would let an endless run of screenshot-less replies never expire

**CH-FRQ-B-004 — Disarm on settle.**
When a frame request settles before its watchdog expires, the system shall cancel that watchdog so that no timer from the request remains scheduled.

- GIVEN a healthy capture of N frames
- WHEN capture stops
- THEN no watchdog timer remains scheduled, asserted directly by the test (for example, every timer the recorder armed was cleared), BUT NOT by relying on `--detectOpenHandles`, which only prints: measured 2026-11-14 with Jest 30.5.2, a test leaving a 60 s timer exited 0 under `--detectOpenHandles --forceExit`
- BUT NOT a timer that fires after the frame was captured
- BUT NOT a `StallError` for any frame that produced a screenshot

**CH-FRQ-B-005 — Discard late replies.**
If a `beginFrame` reply arrives after its frame request has failed by watchdog, then the system shall discard that reply without emitting `frameCaptured` and without writing frame data.

- GIVEN a frame request that failed by watchdog
- WHEN Chrome answers that `beginFrame` afterwards with `screenshotData`
- THEN no `frameCaptured` or `frameRecorded` event fires and nothing is written to the output stream
- BUT NOT a write to an ended frames stream
- BUT NOT a second `frameCaptureFailed` event

**CH-OPT-I-001 — Configurable watchdog duration.**
The system shall accept the watchdog duration in milliseconds as a capture option (option name D-03; configurability D-02) with a default of 10 000 ms (D-01).

- GIVEN `capture(page)` called with no watchdog option
- WHEN a frame request begins
- THEN its watchdog duration is 10 000 ms
- AND GIVEN the option set to 250, THEN the duration is 250 ms
- BUT NOT a duration read from an environment variable or a global

**CH-OPT-B-002 — Reject invalid durations.**
If the watchdog option is not a number from 1 to 2 147 483 647 (the largest delay a Node.js timer honours), then the system shall throw at construction with a message naming the option and the rejected value (D-07).

- GIVEN the option set to `0`, `-1`, `NaN`, `Infinity` or `2147483648`
- WHEN `capture()` constructs the recorder
- THEN it throws, in the style of the existing `options.fps` validation (`PuppeteerCaptureBase.ts:55–60`)
- BUT NOT a silent fallback to the default
- BUT NOT a way to disable the watchdog (D-07)
- AND GIVEN the option left out, or set explicitly to `undefined` or `null`, THEN the default applies (design DD-07)

### 10.2 Stall propagation {#feature-stall-propagation}

**CH-REC-B-001 — `start()` rejects on a first-frame stall.**
While `start()` is waiting for the first frame, when the first frame request fails, the system shall reject `start()` with that same error, without that rejection depending on the start/stop lock that `start()` itself holds.

- GIVEN `start(target)` with the default `waitForFirstFrame: true` and a session that never answers the first `beginFrame`
- WHEN the watchdog expires
- THEN `start()` rejects with the StallError within the bound of CH-REC-Q-001, and `isCapturing` is `false`
- BUT NOT a deadlock between the failure handler's `stop()` and the lock held by `start()` — the ordering E5 models at `185a1ad`
- BUT NOT a rejection with any other error type, except the cause recorded first when another failure, such as a page close, was recorded before the stall (first cause wins, design DD-08)

**CH-REC-B-002 — `waitForTimeout()` rejects on a stall.**
While `waitForTimeout(ms)` is pending, when a frame request fails, the system shall reject `waitForTimeout()` with that error.

- GIVEN a capturing recorder with `waitForTimeout(1000)` pending, and a session that stops answering after k frames
- WHEN the watchdog expires
- THEN `waitForTimeout()` rejects with the StallError, and every frame captured before the stall is in the output
- BUT NOT a resolution of `waitForTimeout()`
- BUT NOT a rejection later than the CH-REC-Q-001 bound
- BUT NOT a rejection with any other error, except the cause recorded first when another failure, such as a page close, was recorded before the stall (first cause wins, design DD-08)
- AND GIVEN `waitForTimeout()` is pending when ffmpeg fails and the recorder stops itself, whether or not a frame stalls, THEN `waitForTimeout()` rejects with the error recorded first once that stop has emitted `captureStopped` (design DD-10)

**CH-REC-B-003 — `stop()` drains in bounded time.**
When `stop()` is called while a frame request is outstanding, the system shall wait for that request no longer than its remaining watchdog time, finalise the output with the frames captured so far, and then reject when the outstanding request failed, with the StallError or the rejected request's error, or with the cause recorded first when another failure was recorded before it (D-06, design DD-08).

- GIVEN a capturing recorder with an outstanding frame request that will never settle
- WHEN the caller calls `stop()`
- THEN `stop()` finishes waiting on the request within the remaining watchdog time, ends the frames stream, waits for ffmpeg to exit, emits `captureStopped`, and rejects with the StallError
- BUT NOT an unbounded `while (this._frameBeingCaptured != null)` wait
- BUT NOT a corrupted output: the file ffmpeg wrote is finalised
- AND the `frameCaptureFailed` event fires once for that failure, after `captureStopped` and before `stop()` settles, with the instance `stop()` rejects with (CH-REC-B-005, design DD-09)

**CH-REC-B-004 — Internal stop on page close or disconnect is bounded.**
When the page closes or the CDP session disconnects while a frame request is outstanding, the system shall complete its internal stop and detach within the CH-REC-B-007 bound (2 × watchdog plus ffmpeg finalisation).

- GIVEN a capturing recorder with an outstanding frame request that will never settle
- WHEN the page emits `close` (or the session emits `CDPSession.Disconnected`)
- THEN the internal stop-and-detach completes within the CH-REC-B-007 bound, and a later `stop()` rejects with the recorded error (`Page was closed` or `Session was disconnected`)
- BUT NOT an internal stop queued forever behind the lock held by a stalled `start()`
- AND GIVEN a stall was already recorded before the page closed (or the reverse), THEN a later `stop()` rejects with whichever error was recorded first (first cause wins, design DD-08)
- AND GIVEN `waitForTimeout()` is pending when the page closes or the session disconnects, whether or not the outstanding frame stalls, THEN `waitForTimeout()` rejects with the error recorded first once the internal stop has emitted `captureStopped` (design DD-10)
- BUT NOT a pending `waitForTimeout()` that never settles, which is what happens at `185a1ad`, with healthy frames too

**CH-REC-B-005 — One event per stall.**
When a frame request fails with a StallError, the system shall emit `frameCaptureFailed` exactly once with the same error instance it rejects awaiting callers with.

- GIVEN a listener on `frameCaptureFailed` and a stalled frame
- WHEN the watchdog expires
- THEN the listener is called once, and its argument is `===` the error `start()`, `waitForTimeout()` or `stop()` rejects with
- BUT NOT a second emission from the late-reply path (CH-FRQ-B-005)

**CH-REC-B-006 — Clean state after a stall.**
When a stall has been reported, the system shall leave the recorder not capturing, with ffmpeg exited, with no listener added by `start()` or `waitForTimeout()` still registered, and with a new `start()` permitted (D-10), whose frames are bounded and whose setup calls are bounded only while the session still answers them (design DD-11).

- GIVEN a recorder whose capture failed with a StallError
- WHEN the caller inspects it and calls `start()` again on the same page
- THEN `isCapturing` is `false`, the listener counts for `frameCaptured` and `frameCaptureFailed` and the page's `close` listener count equal their pre-start values, and, with a session that answers the setup calls `start()` makes, the new `start()` either captures or fails with a StallError within the bound
- BUT NOT a hang on the second `start()` while the session answers its setup calls; a session that answers no CDP command at all is out of scope until OQ-02 is answered (design DD-11)
- BUT NOT `Capture is in progress` thrown because of leftover state

**CH-REC-B-007 — Cleanup calls after a stall are bounded.**
While stopping after a stall, the system shall bound each CDP cleanup call it awaits (`frame.evaluate` of deactivate and ejector, `HeadlessExperimental.disable`, session detach) by the watchdog duration, and shall continue the stop when one does not settle.

- GIVEN a session that answers no further CDP command after the stall
- WHEN the recorder stops
- THEN `stop()` settles within twice the watchdog duration plus ffmpeg finalisation, whichever cleanup call hangs
- BUT NOT a stop that hangs on `HeadlessExperimental.disable` instead of on the drain (A-05)
- BUT NOT a cleanup failure replacing the StallError as the reported error

**CH-REC-B-008 — A pending wait hears every recorded failure.**
While `start()` waits for its first frame or `waitForTimeout()` is pending, when any failure is recorded (a stalled or rejected frame, a page close, a session disconnect, an ffmpeg error, or a frame request the recorder cannot send), the system shall settle that wait with the first cause recorded: `start()` within the CH-REC-Q-001 bound, and `waitForTimeout()` once the stop has emitted `captureStopped` (design DD-12).

- GIVEN `start()` waiting on a first frame whose `beginFrame` answered with no screenshot, before the retry is sent
- WHEN the page closes, the session disconnects or ffmpeg fails
- THEN `start()` rejects with that error within the CH-REC-Q-001 bound, and `isCapturing` is `false`
- BUT NOT a `start()` that waits forever because the retry returned on the recorded failure and nothing else frees the lock
- AND GIVEN the failure is recorded before the first frame answers, or during `start()`'s setup calls on a session that answers them, THEN `start()` rejects with it, BUT NOT a resolution (a change from `185a1ad`, where `start()` resolved and the capture was then stopped behind the caller)
- AND GIVEN a frame request the recorder cannot send (no page, no session, or a disconnected one), the first frame's retry or any later frame's request, THEN that frame fails with that error through the failure path and a pending `waitForTimeout()` settles with it, BUT NOT an exception thrown from a timer callback
- AND GIVEN the page closes or the session disconnects while `start()` is still in its own awaits before setup (the output directory, the ffmpeg lookup, the format and `customFfmpegConfig` callbacks), THEN the failure is recorded and kept, and `start()` rejects with it within the CH-REC-Q-001 bound, BUT NOT a failure that `start()` erases or never records, leaving the first-frame wait with no frame requested and no deadline armed
- BUT NOT a bound on `start()`'s setup calls on a session that answers nothing (design DD-11)

**CH-REC-B-009 — `detach()` does not cut a running capture.**
When the caller calls `detach()`, the system shall wait for any running `start()`, `stop()` or pending cleanup to finish, and then reject with `Capture is in progress` if a capture is still running, changing nothing (design DD-13).

- GIVEN a capture in progress with `waitForTimeout()` pending
- WHEN the caller calls `detach()`
- THEN `detach()` rejects with `Capture is in progress`, the page stays attached, and the capture and the wait continue
- AND GIVEN `stop()` is draining, THEN `detach()` settles after it, within the CH-REC-B-007 bound, and the page is detached
- BUT NOT a detach under a running frame loop, which at `185a1ad` makes the next frame request throw `Not attached to a page` from its timer callback and leaves a pending `waitForTimeout()` unsettled

### 10.3 Stall diagnostics {#feature-stall-diagnostics}

**CH-ERR-I-001 — Named, exported error class.**
The system shall define the StallError as a class extending `Error`, whose `name` equals its class name, constructed in the pattern of `src/NotChromeHeadlessShell.ts`, and exported from the package index.

- GIVEN `import { <D-04 name> } from 'puppeteer-capture'`
- WHEN a stall occurs
- THEN `error instanceof <D-04 name>` and `error instanceof Error` are both true, and `error.name === '<D-04 name>'`
- BUT NOT a plain `Error` with a magic message string as the only discriminator

**CH-ERR-I-002 — The error says which frame stalled and for how long.**
When the system creates a StallError, it shall populate `captureTimestamp`, `frameTimeTicks`, `elapsedMs`, `timeoutMs`, `stage` (`'evaluate'` or `'beginFrame'`) and `screenshotlessReplies`, and render all six in the message.

- GIVEN the F1 signature: first frame, one screenshot-less reply, then no reply, watchdog 10 000 ms
- WHEN the StallError is created
- THEN `captureTimestamp === 0`, `frameTimeTicks === 0`, `stage === 'beginFrame'`, `screenshotlessReplies === 1`, `timeoutMs === 10000`, `elapsedMs >= 10000`, and the message contains each value
- BUT NOT screenshot data, page content, or the page URL in the error

### 10.4 Retry-path investigation {#feature-retry-path-investigation}

**CH-FRQ-C-001 — No retries, no raised timeouts.**
The fix shall not raise Jest's `testTimeout`, shall not add test retries, and shall not re-send `beginFrame` after a watchdog expiry.

- GIVEN the change set
- WHEN it is reviewed
- THEN `jest.config.js` `testTimeout` is unchanged at 30000, no `jest.retryTimes` or CI re-run step is added, and CH-FRQ-B-002 holds
- BUT NOT any of those as a substitute for the watchdog

**CH-FRQ-C-002 — Retry behaviour unchanged until confirmed.**
The system shall keep the screenshot-less retry's current `frameTimeTicks` handling (the retry repeats the same ticks, `PuppeteerCaptureViaHeadlessExperimental.ts:168–170`) unless the investigation of CH-FRQ-C-003 records a confirmation of H1 or H2 (D-08).

- GIVEN the watchdog change set
- WHEN the retry branch is diffed
- THEN only the watchdog bookkeeping (the screenshot-less reply count) changes there
- BUT NOT a speculative change to `frameTimeTicks` on the strength of the n = 2 correlation alone

**CH-FRQ-C-003 — Time-boxed root-cause investigation.**
Before any change to the retry path, an investigation time-boxed to half a day shall attempt a controlled reproduction of the E1/E2 signature and record its outcome against H1, H2 and H3.

- GIVEN a `chrome-headless-shell` at the build pinned for the current `PUPPETEER_VERSION`
- WHEN the investigator forces a screenshot-less first reply (for example by issuing the first `beginFrame` during renderer initialization, per E6) and then re-sends with non-advancing, then advancing, `frameTimeTicks`
- THEN a written result records, for each variant, reply or no reply within 30 s, and states which hypothesis the result supports, refutes, or leaves open; it also answers OQ-01 and OQ-02 where the run reaches them
- BUT NOT a conclusion stated as a mechanism when the reproduction did not occur

### 10.5 Release documentation {#feature-release-documentation}

**CH-DOC-C-001 — README API reference.**
The README API reference shall document the watchdog option (name, type, default, validation) in the `PuppeteerCaptureOptions` table, the StallError under § Error Classes with its fields, and, under § Methods, that `start()`, `waitForTimeout()` and `stop()` reject with it after the watchdog duration.

- GIVEN the README after the change
- WHEN a reader looks up the option, the error class, or `start()`
- THEN each is documented with the default value written as `10000` ms (or the ratified D-01 value)
- BUT NOT a description that presents a hypothesis (A-01 to A-03) as the cause

**CH-DOC-C-002 — KNOWN_ISSUES entry.**
`KNOWN_ISSUES.md` shall carry an entry describing the stall symptom, the StallError users now see instead of a hang, what to do (raise the option if frames are legitimately slow; otherwise report with the error's fields and a `DEBUG=puppeteer:protocol:*` trace), and that the cause is under investigation.

- GIVEN the entry
- WHEN read beside "Setting `defaultViewport` causes rendering to freeze"
- THEN it mentions the possible relation as an open question (OQ-03), not as fact
- BUT NOT security or vulnerability language: this is a liveness defect

**CH-DOC-C-003 — CHANGELOG entry.**
`CHANGELOG.md` under `[Unreleased]` shall record the fix under `### Fixed` and the option and error class under `### Added`, and shall state the behaviour change: a stalled frame now rejects with the named error instead of hanging.

- GIVEN the CHANGELOG after the change
- WHEN read
- THEN both sections carry the entries in the file's existing Keep a Changelog style
- BUT NOT an issue number in a commit message (repository convention); issue references go in the PR body

**CH-DOC-C-004 — Release note line.**
The GitHub Release that ships the change shall carry, beside the generated `What's Changed` list, one line naming the behaviour change and the new option.

- GIVEN the release body
- WHEN read
- THEN it names the StallError, the option, and that a stall now rejects instead of hanging
- BUT NOT a release-note claim about the root cause

### 10.6 Verification constraints

**CH-TST-C-001 — A test drives a stalled frame.**
The test suite shall include unit tests that drive a frame request which never settles, through a mocked CDP session, with the watchdog set to a small value, and assert that `start()`, `waitForTimeout()` and `stop()` each reject with the StallError within the CH-REC-Q-001 bound.

- GIVEN the existing mock helpers (`createMockPage`, `TestCapture` in `PuppeteerCaptureBase.test.ts`) or equivalent mocks for `PuppeteerCaptureViaHeadlessExperimental`
- WHEN `npm run test` runs under the unchanged Jest config
- THEN each of the three tests completes in under 5 s and passes on Ubuntu and Windows cells
- BUT NOT a test that depends on reproducing a real Chrome stall

**CH-TST-C-002 — The observed signature is a test case.**
The test suite shall include the E1/E2 signature: one `{"hasDamage":true}` reply without `screenshotData`, then no reply.

- GIVEN a mocked session that answers the first `beginFrame` without `screenshotData` and never answers the second
- WHEN the watchdog expires
- THEN the StallError reports `screenshotlessReplies === 1` and `stage === 'beginFrame'`
- BUT NOT a test that counts the retry as a new watchdog

**CH-TST-C-003 — The deadlock is a regression test against the real class.**
The test suite shall include two tests against the real recorder class's `start()` with `waitForFirstFrame: true`. **CH-TST-C-003a** drives a first `beginFrame` that **rejects**, using only the API present at `185a1ad`, and asserts that `start()` rejects. **CH-TST-C-003b** drives a first `beginFrame` that never answers, with the watchdog set, and asserts the end-to-end CH-REC-Q-001 bound. (Split in v1.2: at `185a1ad` a never-answering frame never reaches `onFrameCaptureFailed`, so only a rejected frame exercises the deadlocking path.)

- GIVEN the code at `185a1ad` (before the fix)
- WHEN CH-TST-C-003a runs
- THEN it fails by its own bound (not by Jest's 30 s timeout), confirming A-07
- AND GIVEN the fix, THEN CH-TST-C-003a and CH-TST-C-003b pass
- BUT NOT a test that calls `onFrameCaptureFailed` directly outside `start()`, which is how the existing test (`PuppeteerCaptureBase.test.ts:355–369`) misses the deadlock

### 10.7 Quality attributes

**CH-REC-Q-001 — Liveness bound.**

- TAG: `StallRejectionLatency`
- SCALE: milliseconds from the moment a frame request begins to the moment the awaiting public call (`start()` or `waitForTimeout()`) rejects, or, for `stop()`, to the moment its drain of the outstanding request ends
- METER: the CH-TST-C-001 tests, real timers, watchdog 250 ms, measured with `performance.now()`, on every CI cell
- MUST: ≤ watchdog + 1 000 ms, plus ffmpeg finalisation of the frames already queued when the stall is detected (the METER's tests queue only a few frames, so there the bound is watchdog + 1 000 ms)
- GOAL: ≤ watchdog + 250 ms
- PAST: unbounded (E1, E2)

**CH-REC-Q-002 — No false stalls on healthy captures.**

- TAG: `FalseStallRate`
- SCALE: StallErrors raised in integration jobs whose protocol trace shows the stalled `beginFrame` answered within the watchdog duration
- METER: grep of integration job logs for the error name over the first 30 days after merge, each hit checked against its `DEBUG` protocol trace
- MUST: 0
- GOAL: 0
- PAST: observed `beginFrame` latency max 165 ms and 83 ms, p99 113 ms and 25 ms (E4), against a 10 000 ms default

## 11. State Matrices

N/A — this PRD specifies no data-driven view. The library has no user interface; its states are the object lifecycles in § 9, and the transitions that matter are bounded by § 10.1 and § 10.2.

## 12. Assumption Registry

| ID | Assumption | Type | Confidence | Evidence | Validation plan | Risk if wrong |
|---|---|---|---|---|---|---|
| A-01 | H1: Chrome does not answer a `beginFrame` whose `frameTimeTicks` does not advance, after a screenshot-less reply. | Mechanism | 🔴 speculative | E3 correlation, 2 of 2 traces; no controlled reproduction | CH-FRQ-C-003, before any retry-path change | A ticks-based fix would not stop stalls; the watchdog still bounds them |
| A-02 | H2: a screenshot-less reply marks a renderer/compositor state in which any later `beginFrame` stalls, whatever its ticks. | Mechanism | 🔴 speculative | E3; E6 (screenshot fails during renderer initialization; both stalls at frame 0) | CH-FRQ-C-003 | A ticks change would not help; recovery may need a new page or session |
| A-03 | H3: runner load or a Chrome-side flake unrelated to the retry; the correlation is coincidental. | Mechanism | 🔴 speculative | Weakened by E3 (the only screenshot-less reply of ~200 precedes each stall), n = 2 | CH-FRQ-C-003; frequency via § 4 lagging indicator | Root-cause work on the retry path would be wasted |
| A-04 | `beginFrame` latency on user hardware and large viewports stays well under 10 000 ms. | Usage | 🟡 assumed | E4 (CI only; max 165 ms) | During build: one integration run at a 3840×2160 viewport, recording max latency | False StallErrors on slow machines; mitigated by the option |
| A-05 | After a stall, the CDP cleanup calls may also not settle. | Behaviour | 🟡 assumed | E1/E2 show no traffic after the stall, so no evidence either way | CH-FRQ-C-003 (OQ-02); CH-REC-B-007 bounds it regardless | `stop()` would hang on cleanup instead of the drain |
| A-06 | The custom viewport did not cause E1. | Cause | 🟢 | No `Emulation.*` call after `start()` in E1; the hang preceded `setViewport` (S1 F4) | — | — |
| A-07 | The real recorder class deadlocks like the E5 model when a frame fails during `start()`'s first-frame wait. | Behaviour | 🟡 assumed | Code read at `185a1ad` plus E5 model; not run against the class | CH-TST-C-003a run against the unfixed code | If wrong, CH-REC-B-001 still holds but its lock-ordering clause is moot |
| A-08 | Users can hit this outside CI. | Usage | 🟡 assumed | Default config takes the unbounded path (S2); #12 shows the symptom class reaches users (different cause) | Watch the tracker after release for reports carrying the new error | Priority would be CI-only |

## 13. Feature Completeness

| Feature | Requirement IDs | Object sections | Entity coverage | CTA coverage | Specification depth | Open questions | Verdict |
|---|---|---|---|---|---|---|---|
| frame-watchdog | CH-FRQ-B-001…005, CH-OPT-I-001, CH-OPT-B-002 | FrameRequest, CaptureOptions | 2/2 | 5/5 | 7/7 with criteria and exclusions | OQ-01 | NEAR-COMPLETE |
| stall-propagation | CH-REC-B-001…009, CH-REC-Q-001 | Recorder | 2/2 (Recorder, StallError) | 6/6 | 10/10 | OQ-02 | NEAR-COMPLETE |
| stall-diagnostics | CH-ERR-I-001, CH-ERR-I-002 | StallError | 1/1 | 2/2 | 2/2 | none | COMPLETE |
| retry-path-investigation | CH-FRQ-C-001…003 | FrameRequest | 1/1 | 1/1 | 3/3 | OQ-01, OQ-02, OQ-03, plus A-01…A-03 | INCOMPLETE — gap: the mechanism is unknown by design; this feature specifies the investigation, not the fix. Closing the gap is the investigation's output, after which a follow-up PRD revision specifies any retry-path change. |
| release-documentation | CH-DOC-C-001…004 | ReleaseDocs | 1/1 | 1/1 | 4/4 | none | COMPLETE (depends on D-01, D-03, D-04 values) |

Verification constraints CH-TST-C-001…003 attach to frame-watchdog and stall-propagation.

## 14. Source Traceability

Origin values: `council-added` (from the council panel guidance F6, relayed in the scope brief), `AI-inferred-expansion` (added by this capture run). No requirement here traces to a message the person wrote; the scope brief that relayed the in-scope list is an orchestrator brief, not the person's own words. Every row is therefore pipeline-authored and needs ratification (see § Readiness).

| Req ID | Source | Object | CTA | Feature | Layer | Confidence | Origin |
|---|---|---|---|---|---|---|---|
| CH-FRQ-B-001 | S1 F4, F6; S2 | FrameRequest | arm watchdog | frame-watchdog | B | validated need (E1, E2) | council-added |
| CH-FRQ-B-002 | S1 F4, F6 | FrameRequest | expiry | frame-watchdog | B | validated need | council-added |
| CH-FRQ-B-003 | S1 F3, F4; S2 | FrameRequest | retry | frame-watchdog | B | assumed | AI-inferred-expansion |
| CH-FRQ-B-004 | S2 (`--detectOpenHandles` in test script) | FrameRequest | disarm | frame-watchdog | B | assumed | AI-inferred-expansion |
| CH-FRQ-B-005 | S1 F9 (no deadline stated) | FrameRequest | discard late reply | frame-watchdog | B | speculative (OQ-01) | AI-inferred-expansion |
| CH-OPT-I-001 | Decisions D-01…D-03 | CaptureOptions | set duration | frame-watchdog | I | assumed | AI-inferred-expansion |
| CH-OPT-B-002 | S2 (`options.fps` validation pattern) | CaptureOptions | set duration | frame-watchdog | B | assumed | AI-inferred-expansion |
| CH-REC-B-001 | S1 F4; S3 E1, E2; S4 E5 | Recorder | start | stall-propagation | B | validated need; deadlock modeled | council-added (bound); AI-inferred-expansion (lock clause) |
| CH-REC-B-002 | S1 F4 | Recorder | waitForTimeout | stall-propagation | B | validated need | council-added |
| CH-REC-B-003 | S1 F4 | Recorder | stop | stall-propagation | B | validated need | council-added; AI-inferred-expansion (v1.5: any frame failure during the drain, and its event) |
| CH-REC-B-004 | S1 F2; S2 | Recorder | internal stop | stall-propagation | B | assumed | AI-inferred-expansion (v1.5 adds the pending `waitForTimeout()`) |
| CH-REC-B-005 | S1 F4; S2 | Recorder | on(frameCaptureFailed) | stall-propagation | B | assumed | AI-inferred-expansion |
| CH-REC-B-006 | S2 | Recorder | start (again) | stall-propagation | B | assumed | AI-inferred-expansion |
| CH-REC-B-007 | S2 (`onPostCaptureStopped`) | Recorder | stop | stall-propagation | B | speculative (A-05) | AI-inferred-expansion |
| CH-REC-B-008 | S2 (`_start` first-frame wait, `requestFrameCapture`); Stage 3.7 runs 1–8 | Recorder | start, waitForTimeout | stall-propagation | B | assumed | AI-inferred-expansion (v1.8, design DD-12) |
| CH-REC-B-009 | S2 (`detach()` takes no lock) | Recorder | detach | stall-propagation | B | assumed | AI-inferred-expansion (v1.8, design DD-13) |
| CH-REC-Q-001 | S1 F6 | Recorder | — | stall-propagation | Q | assumed | AI-inferred-expansion |
| CH-REC-Q-002 | S3 E4 | Recorder | — | stall-propagation | Q | assumed | AI-inferred-expansion |
| CH-ERR-I-001 | S1 F4 (error-class pattern), F6 | StallError | construct | stall-diagnostics | I | validated need | council-added |
| CH-ERR-I-002 | Scope brief (observability); S3 E1–E3 | StallError | read fields | stall-diagnostics | I | assumed | AI-inferred-expansion |
| CH-FRQ-C-001 | S1 F6 | FrameRequest | — | retry-path-investigation | C | validated | council-added |
| CH-FRQ-C-002 | S1 F5 | FrameRequest | retry | retry-path-investigation | C | assumed | AI-inferred-expansion |
| CH-FRQ-C-003 | S1 F5, F9 | FrameRequest | retry | retry-path-investigation | C | assumed | AI-inferred-expansion |
| CH-DOC-C-001…004 | Scope brief (docs and release note) | ReleaseDocs | publish | release-documentation | C | assumed | AI-inferred-expansion |
| CH-TST-C-001 | S1 F6 | StallTestSuite | drive stall | frame-watchdog | C | validated | council-added |
| CH-TST-C-002 | S1 F1–F3 | StallTestSuite | drive stall | frame-watchdog | C | assumed | AI-inferred-expansion |
| CH-TST-C-003 | S4 E5; S2 | StallTestSuite | drive stall | stall-propagation | C | assumed | AI-inferred-expansion |
| § 15.4 check | S2 (one timer per frame, no added CDP call); D-14 | FrameRequest | arm watchdog | frame-watchdog | Q | assumed | AI-inferred-expansion |

### 14b. Cross-Repository References

| PRD Req | Implementation repo | Spec or item | Status |
|---|---|---|---|
| CH-REC-B-001, B-002 (rejected frame), B-005, B-006, B-008 (a failure recorded before the wait), Q-001, FRQ-C-001, TST-C-001, TST-C-003a | alexey-pelykh/puppeteer-capture | #339 | open |
| CH-FRQ-B-*, CH-OPT-*, CH-REC-B-001, B-002, B-005, B-006, B-008 (a frame request that cannot be sent), Q-001, Q-002, CH-ERR-*, FRQ-C-001, FRQ-C-002, TST-C-001, TST-C-002, TST-C-003b, § 15.4 | alexey-pelykh/puppeteer-capture | #340 | open |
| CH-REC-B-001 (close during a stalled start()), B-002 (first cause, internal stop), B-003, B-004, B-005 (failure during a drain), B-006 (cleanup that never answers), B-007, B-008, B-009, Q-001, FRQ-C-001, TST-C-001 | alexey-pelykh/puppeteer-capture | #341 | open |
| CH-DOC-C-001…004 | alexey-pelykh/puppeteer-capture | #342 | open |
| CH-FRQ-C-002, C-003 | alexey-pelykh/puppeteer-capture | #343 | open |

## 15. Cross-Cutting and Non-Functional Concerns

### 15.1 Security

N/A — the change adds no trust boundary, input surface, credential or data flow; it bounds a wait on an existing CDP call. One constraint carries over: the StallError holds no screenshot data, page content or URL (CH-ERR-I-002). This is a liveness defect, not a vulnerability, and is documented as such (CH-DOC-C-002).

### 15.2 Compliance and Regulatory

N/A — no personal data, regulated processing or licence change; MIT licence unchanged.

### 15.3 Reliability and Observability

Covered by CH-REC-Q-001 (bounded rejection), CH-REC-Q-002 (no false stalls), CH-ERR-I-002 (diagnostic fields), and § 7 (CI keeps `DEBUG: "puppeteer:protocol:*"`). The library adds no logging dependency; diagnostics travel on the error and the `frameCaptureFailed` event.

### 15.4 Performance and Scalability

Requirement: the watchdog adds no CDP call and no wait to a healthy frame. It arms one timer per logical frame and clears it when the frame settles. Check: in a healthy capture of three or more frames, the mocked session's call log shows the same sequence of CDP methods as at `185a1ad`, and the number of watchdog timers armed equals the number of logical frames (#340 AC-15). Wall-clock integration job durations are not a requirement: on shared CI runners they vary more from run to run than one timer per frame could change them, so a duration meter could not detect this regression (D-14, ratification pending).

### 15.5 Operational

The watchdog duration is the one operational knob (CH-OPT-I-001). Troubleshooting guidance lives in KNOWN_ISSUES (CH-DOC-C-002). No deployment, runbook or on-call surface: this is a library.

### 15.6 Lifecycle

Backward compatible at the API level: one new optional option and one new exported class. The behaviour change (hang → rejection) is announced in CHANGELOG and the release note (CH-DOC-C-003, CH-DOC-C-004). Version bump class: D-09. No deprecation. The `HeadlessExperimental` platform risk documented in the README is unchanged by this work.

## 16. Change Log

| Version | Date | Change | Rationale | Impact |
|---|---|---|---|---|
| 1.0 | 2026-11-14 | Created from fact sheet F1–F9, code read at `185a1ad`, two latency measurements and one lock-ordering model | gap-capture-hang scoping, Stage 1 | New PRD; ratification pending |
| 1.1 | 2026-11-14 | CH-OPT-B-002 and D-07 bound the option to 1…2 147 483 647 ms | Stage 2 product-lens finding: Node.js clamps a larger `setTimeout` delay to 1 ms (measured on Node v26.13.0) | Valid range narrowed; still ratification pending |
| 1.2 | 2026-11-14 | CH-REC-B-004 bound moved to CH-REC-B-007's; first-cause rule added to B-004; CH-FRQ-B-004 asserts timers directly; CH-TST-C-003 split into 003a/003b; CH-OPT-B-002 says an explicit `undefined`/`null` means the default; CH-REC-Q-001 MUST names ffmpeg finalisation of queued frames | Stage 2 product-lens re-grade and the test-plan findings: an internal stop that includes cleanup cannot meet the 1× bound; `--detectOpenHandles` cannot fail a run (measured with Jest 30.5.2); a never-answering frame does not reach the deadlocking path at `185a1ad`; the product-lens second re-grade found Q-001 promised a bound a long capture's finalisation can exceed | Requirements corrected to what can be met and tested; still ratification pending |
| 1.3 | 2026-11-14 | § 4 "Serves" no longer claims CI reliability and names the meter owner (D-13); § 15.4 replaces the job-duration meter with a call-log and timer-count check (D-14), with a § 14 row; § 14b names #339–#343 | Stage 3.7 coverage gate: § 15.4 was not carried by any item, and the design says the fix does not lower the stall rate | One AC added to #340; still ratification pending |
| 1.4 | 2026-11-14 | CH-REC-B-001 "no other error type" carves out the first cause recorded (DD-08) | Stage 3.7 run 4: with a page close before the stall, `start()` rejects with `Page was closed` | Requirement aligned with DD-08; still ratification pending |
| 1.5 | 2026-11-14 | CH-REC-B-002 gains the first-cause carve-out; CH-REC-B-003 covers any frame failure during the drain and the event it fires (DD-09); CH-REC-B-004 covers a `waitForTimeout()` pending when the capture is stopped internally (DD-10) | Stage 3.7 run 5: a `waitForTimeout()` pending during a page close or disconnect never settles, and B-002 disagreed with DD-08 | Two ACs added to #341 (AC-1b, AC-4d) and AC-1 widened; still ratification pending |
| 1.6 | 2026-11-14 | CH-REC-B-006 says a restart is bounded only while the session answers its setup calls (DD-11), and counts the page `close` listener; D-10's rationale says the same | Stage 3.7 run 6: the setup calls a restart makes are bounded by nothing, and the `close` listener was unasserted | #339 AC-2 and #340 AC-16 widened; #341 and #342 narrowed; still ratification pending |
| 1.7 | 2026-11-14 | § 4 Serves names the two liveness exceptions; CH-REC-B-002 covers an ffmpeg error while `waitForTimeout()` is pending; § 14b adds CH-REC-B-001 to #340 and #341 | Stage 3.7 run 7: the ffmpeg error is a third internal stop, and § 4 promised more than the design | #341 AC-4d and AC-5b widened, AC-9 added; #340 AC-17 added; still ratification pending |
| 1.8 | 2026-11-14 | CH-REC-B-008 adds the rule every wait follows: it settles on the recorder's recorded state, never only on a frame event (DD-12); CH-REC-B-009 makes `detach()` wait for the lock and refuse while capturing (DD-13); § 4 names the setup exception for any `start()` | Stage 3.7 run 8: a page close, disconnect or ffmpeg error in the screenshot-less retry gap left a waiting `start()` hung, and a caller's `detach()` was a trigger no cell owned. Eight runs each found one more cell, so the rule moved from the cells to the writer and the waits | #341 AC-10 and AC-11 added, AC-4b bounded; #340 AC-18 added; #339 Specification point 1 reads a failure recorded before the wait; #342 documents both behaviour changes; after Stage 3.7 run 9, B-008 also covers every unsendable frame request and a failure recorded during `start()`'s own awaits (#341 AC-10 and #340 AC-18 widened); still ratification pending |

## Ratification-pending decisions

Run in autonomous mode: each value below was chosen by this capture run, recorded here, and is not settled until the maintainer ratifies or changes it. Each stands alone.

| ID | Decision | Recommendation | Alternative(s) | Why the recommendation |
|---|---|---|---|---|
| D-01 | Default watchdog duration | 10 000 ms | 5 000 ms; 30 000 ms | About 60× the highest observed `beginFrame` latency (165 ms, E4) and well under Jest's 30 000 ms, so tests see the named error rather than a Jest timeout. 30 000 ms collides with the Jest timeout; 5 000 ms leaves less headroom for large viewports (A-04). |
| D-02 | Is the duration user-configurable? | Yes, as a capture option | Fixed internal constant | User hardware and viewport sizes vary beyond what CI measured (A-04). |
| D-03 | Option name | `frameCaptureTimeout` | `frameTimeout`; `beginFrameTimeout` | Matches the existing `frameCaptured` / `frameCaptureFailed` vocabulary and names what it bounds (the whole frame, not only `beginFrame`). |
| D-04 | Error class name | `FrameCaptureTimeout` | `FrameCaptureTimeoutError`; `BeginFrameStalled` | Follows the existing classes, which carry no `Error` suffix (`NotChromeHeadlessShell`, `MissingHeadlessExperimentalRequiredArgs`). |
| D-05 | Watchdog scope | One watchdog per logical frame, covering the in-page evaluations and every screenshot-less retry | One watchdog per `beginFrame` CDP call | A per-call watchdog never expires on an endless run of screenshot-less replies, and misses a stalled `Runtime.evaluate`. |
| D-06 | `stop()` when the outstanding request stalls | Finalise output, then reject with the StallError | Finalise and resolve, reporting only through the event | Matches the other two calls (hang → rejection) and the library's existing habit of reporting capture errors from `stop()`. |
| D-07 | Can the watchdog be disabled (`0` / `Infinity`)? | No; reject values outside 1…2 147 483 647 ms, and document the maximum (about 24.8 days) as the effectively-off value | Allow `Infinity` as an opt-out | An opt-out re-opens the forever-hang the PRD exists to close. |
| D-08 | Change the retry's `frameTimeTicks` now? | No; wait for the CH-FRQ-C-003 result | Advance `frameTimeTicks` on retry now | The mechanism is unverified (A-01…A-03); the watchdog fixes liveness either way. |
| D-09 | Release version class | Minor (new option and export, behaviour change from hang to rejection) | Major, treating the behaviour change as breaking | No caller can usefully depend on a hang; the API addition is additive. |
| D-10 | Recorder reusable after a stall | Yes; `start()` permitted again, bounded by the watchdog | Require `detach()` and re-attach first | Keeps the existing repeated start/stop support (CHANGELOG `Fixed`); a page whose frames still stall fails fast rather than hanging; a session that answers no setup call is not bounded (design DD-11), so the documented remedy there is a new page. |
| D-11 | Appetite | Small batch, one to two days, investigation spike half a day separately | Medium batch including the root-cause fix | The liveness fix is independent of the mechanism. |
| D-12 | Decision-gate threshold for root-cause work | One or more StallErrors in CI within 30 days with `screenshotlessReplies ≥ 1` | Two or more | n is already 2 before the fix; any recurrence with the same signature is enough to prioritise the investigation's follow-up. |
| D-13 | Who runs the post-merge meters in § 4 | The maintainer, as part of normal CI review; no tracked item | A tracked chore item due 30 days after merge | The meters read CI history the maintainer already watches. An item would sit open for 90 days with nothing to build. |
| D-14 | How § 15.4 checks that the watchdog costs nothing on a healthy frame | A call-log and timer-count assertion in a unit test (#340 AC-15) | Compare integration job durations before and after on each matrix cell | The unit check detects an added CDP call or wait exactly. Job durations on shared runners vary too much to show one timer per frame. |

## Readiness

Definition-of-ready gate, run 2026-11-14 by the capture run itself (self-graded, not independent):

| Check | Result | Note |
|---|---|---|
| 1 Validated problem statement | pass | § 2, traced to F1–F4, F9 and measurements E3–E5 |
| 2 Out-of-scope declarations | pass | § 3 lists deferrals with reopen triggers and exclusions with reasons |
| 3 Success and telemetry metrics | pass | § 4: leading, lagging, decision gates |
| 4 Cross-cutting concerns | pass | § 15: all six subsections carry content or a reasoned N/A |
| 5 Feature-completeness verdicts | pass | § 13: one INCOMPLETE feature with its gap documented |
| 6 Requirement provenance | **fail** | Every requirement is pipeline-authored (§ 14 Origin); none has been ratified by the maintainer one at a time. Autonomous run: ratification is pending, which this check does not accept as ratified. |

`dor_status: failed` — remediation: the maintainer ratifies each requirement in § 14 and each decision D-01…D-14 (or changes it), then the gate is re-run.
