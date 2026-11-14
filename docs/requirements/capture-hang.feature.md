---
type: feature-file
scope: Capture liveness (frame-request watchdog)
created: 2026-11-14
prd: ./capture-hang-prd.md
design: ../design/capture-hang-solution-design.md
tier: B
---

# Capture liveness: executable scenarios

These scenarios formulate the acceptance criteria of three work items: the deadlock fix, the frame watchdog and the bounded stop. All three are **Tier B**. The scenarios are written in Gherkin. No step definitions are bound yet. Each item binds its scenarios to Jest tests when it is built. Each scenario names the acceptance criterion (AC) it covers in the item, and the PRD requirement behind it.

The repository has no feature-file convention, so this file sits beside the PRD it formulates. That location is a choice made during this scoping run and is waiting for the maintainer to ratify it.

Two items have no scenarios here:

- **The documentation item** has review-checked criteria and nothing for a test to execute.
- **The spike** is a typed exception (SPIKE), which formal scenarios do not fit.

**Work class.** These items ship library behaviour in prose-specified code, not deterministic output such as a golden file. So no oracle is written before the build. The independent check is the test plan's red-first gate: the stall tests must fail on the unfixed code before the fix lands (design § 11a, gate G0).

**Shared conditions.** Every timed scenario uses:

- real timers;
- a watchdog of `W` = 250 ms, unless the scenario says otherwise;
- elapsed time measured with `performance.now()`;
- a mocked page, CDP session and ffmpeg fixture (design § 11a);
- a session that answers the cleanup calls (`HeadlessExperimental.disable`, the in-page `deactivate` and ejector evaluates), unless a scenario says it never answers them. Until the bounded-stop item lands, nothing bounds a cleanup that never answers, so only scenarios that do not wait on it say so (design § 11a § 3d).

Owner decisions these scenarios rest on are ratification-pending:

- D-01, D-03, D-04, D-06, D-07 and D-10 in the PRD;
- DD-02, DD-03 and DD-05 to DD-13 in the design.

## Example maps

| Item | Rules | Examples | Questions |
|---|---|---|---|
| Deadlock fix | 5: no deadlock on a failed first frame; event order kept; one rethrow rule; delivery before cleanup; mutual exclusion and reuse | 10 | 1: ratify DD-02, DD-03, DD-06, D-06 and D-10 |
| Frame watchdog | 5: one deadline per logical frame, which only a real stall expires; an expired frame fails, stays failed and is delivered before the cleanup, and a later start() stays bounded; the error tells the two failure kinds apart; the option is bounded; every way a frame ends leaves nothing behind | 25 | 1: ratify D-01, D-03, D-04, D-07, DD-05 and DD-07 |
| Bounded stop | 5: the drain is bounded and reports a frame failure during it; the cleanup is bounded and keeps the first cause; internal stops are bounded and every pending wait hears them; the first cause wins; a healthy stop is unchanged, and detach() waits for it and refuses while capturing | 36 | 1: ratify D-06, DD-08 to DD-13 |

The question cards cannot be resolved in this autonomous run. They are owner decisions, so each item carries them as open owner decisions. No item exceeds three question cards or five rules.

## Feature: Deadlock fix (Tier B — pending binding in the deadlock-fix item)

```gherkin
Feature: start() rejects when its first frame fails, instead of deadlocking
  At 185a1ad, start() holds the start/stop lock while it waits for the first
  frame, and the failure handler awaits stop(), which needs the same lock.

  Rule: A failed first frame rejects start() and never deadlocks it

    Scenario: First frame request rejects during start()            # AC-1, CH-REC-B-001, CH-TST-C-003a
      Given a recorder on a page whose first frame request rejects with an error
      When the caller starts a capture that waits for the first frame
      Then start() rejects with that same error within 1 000 ms
      And the recorder is not capturing
      But NOT by reaching the test runner's 30 000 ms timeout

    Scenario: The failed start leaves a clean recorder              # AC-2, CH-REC-B-006
      Given start() rejected because its first frame failed
      Then the capture stopped event was emitted once
      And no frame listener that start() added is still registered
      And the page holds as many close handlers as it did before start()

  Rule: The failure event keeps its public order

    Scenario: Event after the output is final                       # AC-3, CH-REC-B-005
      Given a listener on the frame-capture-failed event
      When the first frame fails during start()
      Then the listener is called exactly once with the error start() rejected with
      And the capture stopped event was emitted before it

  Rule: The next stop() rethrows the same failure once

    Scenario Outline: One rethrow after any delivery                # AC-5, AC-5b, DD-03
      Given a capture whose frame failed and <call> rejected with the failure
      When the caller calls stop()
      Then stop() rejects with the same error instance
      And a second stop() rejects with "Capture is not in progress"

      Examples:
        | call             |
        | start()          |
        | waitForTimeout() |

  Rule: Delivery comes before the browser-side cleanup

    Scenario: Cleanup that never answers does not delay start()     # AC-5c, DD-06, CH-REC-Q-001
      Given a session that rejects the first frame request
      And never answers the in-page deactivation or the disable command
      When the caller starts a capture that waits for the first frame
      Then start() rejects within 1 000 ms
      And the frame-capture-failed event fires once
      But NOT after waiting on the cleanup calls

    Scenario: Cleanup that never answers does not delay waitForTimeout()  # AC-5d, DD-06, CH-REC-B-002
      Given a capturing recorder with waitForTimeout(1000) pending
      And a session that never answers the in-page deactivation or the disable command
      When a later frame request rejects
      Then waitForTimeout() rejects within 1 000 ms, after the capture stopped
      And the frame-capture-failed event fires once
      But NOT after waiting on the cleanup calls

    Scenario: No stray rejection                                    # AC-4
      Given start() rejected because its first frame failed
      When the test ends
      Then no unhandled promise rejection was reported

  Rule: start() and stop() stay mutually exclusive, and the recorder is reusable

    Scenario: A concurrent stop() waits for start()                 # AC-6
      Given start() is in progress
      When the caller calls stop()
      Then stop() runs only after start() settles

    Scenario: Start again after a failed first frame                # AC-7, D-10
      Given a recorder whose first frame failed
      And a session that now answers frame requests
      When the caller starts a capture again on the same page
      Then the second start() resolves and frames are captured
```

## Feature: Frame watchdog (Tier B — pending binding in the frame-watchdog item)

```gherkin
Feature: Every frame capture is bounded by a watchdog
  Chrome may never answer HeadlessExperimental.beginFrame. A per-frame
  deadline turns that hang into a FrameCaptureTimeout.

  Rule: One deadline covers a whole logical frame, retries included, and only a real stall expires it

    Scenario: Stalled first frame rejects start()                   # AC-1, CH-FRQ-B-002, CH-TST-C-003b
      Given a session whose first frame request never answers
      When the caller starts a capture that waits for the first frame
      Then start() rejects with a FrameCaptureTimeout within W + 1 000 ms
      And the recorder is not capturing
      And the frame capture failed event fired once, after the capture stopped event, with the same instance
      And the next stop() rejects with that same instance, and a second stop() throws "Capture is not in progress"

    Scenario: Stall mid-capture rejects waitForTimeout()            # AC-2, CH-REC-B-002
      Given a session that answers 2 or more frames with a screenshot and then never answers
      And the caller is waiting with waitForTimeout(1000)
      When the next frame stalls
      Then waitForTimeout() rejects with a FrameCaptureTimeout within W + 1 000 ms of that frame's start
      And the output holds exactly the frames captured before the stall
      And the frame capture failed event fired once with the same instance
      And a following stop() rejects with that same instance

    Scenario: Endless screenshot-less replies still expire          # AC-4, CH-FRQ-B-003
      Given a session that answers every frame request without a screenshot
      When W passes from the frame's start
      Then exactly one FrameCaptureTimeout is raised
      But NOT a deadline restarted per retry

    Scenario: A reply that arrived while the event loop was blocked wins  # AC-10b, DD-05, CH-REC-Q-002
      Given a session whose frame reply is delivered through a real loopback socket
      And the reply bytes were written to the socket
      And the event loop was then blocked for W + 100 ms, past the deadline
      When the loop resumes
      Then the frame is captured
      And no FrameCaptureTimeout is raised

  Rule: An expired frame fails, stays failed and is delivered before the cleanup; a later start() stays bounded

    Scenario Outline: Delivery does not wait on cleanup that never answers  # AC-1b, AC-2b, DD-06, R-T4
      Given a deadline of 1500 ms
      And a session whose <frame> never answers
      And that never answers the in-page deactivation or the disable command
      When <call> is waiting
      Then <call> rejects with a FrameCaptureTimeout within 1500 + 1 000 ms of the stalled frame's start
      And the frame-capture-failed event fires once
      But NOT after waiting on the cleanup calls

      Examples:
        | frame                      | call                  |
        | first frame request        | start()               |
        | frame request after 2 good | waitForTimeout(1000)  |


    Scenario: No frame request after expiry                         # AC-6, CH-FRQ-B-002
      Given a frame whose request never answers
      When its deadline expires
      Then no further frame request is sent for that capture

    Scenario: A late reply is dropped                               # AC-7, CH-FRQ-B-005
      Given a frame that already failed by its deadline
      When its frame request later answers with a screenshot
      Then no frame is captured or recorded from it
      And the frame-capture-failed event has fired exactly once

    Scenario: A second start() after a stall stalls again           # AC-16, CH-REC-B-006, D-10
      Given a recorder whose first frame stalled
      When the caller calls start() again, the session answers its setup calls and again never answers the frame request
      Then the second start() rejects with a new FrameCaptureTimeout within 2 × W + 1 000 ms
      And after the first stall the page held as many close handlers as it did before the first start()
      But NOT a hang
      And NOT "Capture is in progress"

  Rule: The error tells the two failure kinds apart

    Scenario: The signature seen in CI                              # AC-3, CH-TST-C-002, CH-ERR-I-002
      Given a session that answers the first frame request without a screenshot
      And never answers the second
      When the deadline expires
      Then the error reports capture timestamp 0, frame ticks 0, stage "beginFrame" and 1 screenshot-less reply
      And it reports a timeout of W and an elapsed time of at least W
      And its message points at KNOWN_ISSUES
      But NOT a suggestion to raise the timeout
      And NOT the page URL or any screenshot data, in the message or in any field of the error

    Scenario: The in-page evaluation stalls                         # AC-5
      Given a frame whose in-page process evaluation never settles
      When the deadline expires
      Then the error reports stage "evaluate"
      And its message suggests raising the timeout if frames are legitimately slow

  Rule: The option has a default and a bounded range

    Scenario Outline: Default and override                          # AC-9, CH-OPT-I-001, DD-07
      Given a recorder created with the timeout option <setting>
      Then its frame deadline is <duration> ms
      But NOT a duration read from an environment variable or a global

      Examples:
        | setting        | duration |
        | left out       | 10000    |
        | set undefined  | 10000    |
        | set null       | 10000    |
        | set to 250     | 250      |

    Scenario Outline: Out-of-range values are refused               # AC-10, CH-OPT-B-002, DD-04
      Given the timeout option set to <value>
      When the recorder is created
      Then creation fails with a message naming the option and <value>
      But NOT a silent fall-back to the default

      Examples:
        | value      |
        | 0          |
        | -1         |
        | NaN        |
        | Infinity   |
        | 2147483648 |

  Rule: Every way a frame ends leaves nothing behind

    Scenario: No deadline outlives its frame                        # AC-8, CH-FRQ-B-004
      Given a healthy capture of 3 or more frames followed by stop()
      When the test ends
      Then every deadline the recorder armed was cleared, as the test itself asserts
      And no FrameCaptureTimeout was raised

    Scenario: A frame abandoned in the retry gap leaves no deadline  # AC-17, CH-FRQ-B-004
      Given the first frame request answered with no screenshot
      When the caller calls stop() before the retry is sent
      Then stop() resolves and every deadline armed was cleared
      And no frame capture failed event fires within 2 × W
      But NOT a FrameCaptureTimeout raised into a stopped recorder

    Scenario: A retry that cannot be sent fails the frame            # AC-18, CH-FRQ-B-004, CH-REC-B-008, DD-12
      Given the first frame request answered with no screenshot
      And the session reports no connection from then on, without a disconnect event
      When the retry runs
      Then start() rejects with "Session disconnected" within W + 1 000 ms of the frame's start
      And the frame capture failed event fires once, with that same instance
      And every deadline armed was cleared
      But NOT a FrameCaptureTimeout, and NOT an exception thrown from the retry's timer

    Scenario: A later frame request that cannot be sent settles a pending wait  # AC-18, CH-REC-B-008, DD-12
      Given three healthy frames and waitForTimeout(1000) pending
      And the session reports no connection before frame 4's request, without a disconnect event
      When frame 4's request runs
      Then waitForTimeout() rejects with "Session disconnected" within W + 1 000 ms of frame 3's capture
      And the frame capture failed event fires once, with that same instance
      But NOT a waitForTimeout() that never settles

    Scenario: The watchdog adds no protocol traffic                 # AC-15, PRD § 15.4
      Given a healthy capture of 3 or more frames
      When it runs
      Then the session receives the same sequence of CDP methods as at the baseline revision
      And one deadline was armed per logical frame
```

## Feature: Bounded stop (Tier B — pending binding in the bounded-stop item)

```gherkin
Feature: stop() and its cleanup finish in bounded time after a stalled frame

  Rule: The drain is bounded and a frame failure during it is reported

    Scenario Outline: stop() with an outstanding frame that fails   # AC-1, CH-REC-B-003, CH-REC-B-005, D-06, DD-09
      Given a capturing recorder whose current frame request <fails>
      And a listener on the frame capture failed event
      When the caller calls stop()
      Then the capture stopped event is emitted, the frames stream is ended and ffmpeg has exited
      And the listener is called once, after the capture stopped event and before stop() settles
      And stop() rejects with <error>, the same instance the listener received
      But NOT a resolution of stop()

      Examples:
        | fails          | error                         |
        | never answers  | a FrameCaptureTimeout         |
        | rejects        | the error the request rejected with |

    Scenario Outline: A close while stop() drains a stalled frame   # AC-1b, CH-REC-B-004, DD-08
      Given a session that answers no cleanup call
      And stop() is draining a frame that never answers
      When <event> happens before the deadline
      Then stop() rejects with "<error>" within 2 × W + 1 000 ms of the frame's start
      And the detach the close queued completes within a further W + 1 000 ms
      But NOT a hang
      And NOT the FrameCaptureTimeout

      Examples:
        | event                     | error                    |
        | the page closes           | Page was closed          |
        | the session disconnects   | Session was disconnected |

    Scenario: A close while stop() drains a healthy frame            # AC-1b
      Given stop() is draining a frame that answers
      When the page closes
      Then stop() resolves
      And a later stop() rejects with "Page was closed"

  Rule: The cleanup is bounded and keeps the first cause

    Scenario: Cleanup calls never answer                            # AC-2, AC-3, CH-REC-B-007
      Given a session that answers no cleanup call after the stall
      When the caller calls stop()
      Then stop() settles within 2 × W + 1 000 ms, plus ffmpeg finalisation
      And it rejects with the FrameCaptureTimeout
      But NOT with a cleanup timeout or a cleanup error

    Scenario: The cleanup is raced as one block                     # AC-2, design § 13
      Given W = 1 500 ms, one page frame and a session that answers no cleanup call after the stall
      When the caller calls stop() while that frame stalls
      Then stop() settles within 4 000 ms of the frame's start
      But NOT after one race per cleanup call, which would take at least 6 000 ms

    Scenario Outline: The cleanup left by a rejected call is bounded  # AC-4c, DD-06, CH-REC-B-007
      Given a session that answers no cleanup call
      And <call> rejected with a FrameCaptureTimeout on a frame that never answered
      When the caller calls stop() twice
      Then the first stop() rejects at once with the same FrameCaptureTimeout
      And the second throws "Capture is not in progress" within W + 1 000 ms of the rejection
      But NOT a wait on the pending cleanup longer than W

      Examples:
        | call            |
        | start()         |
        | waitForTimeout() |

    Scenario: A healthy restart waits on the cleanup at most W      # AC-4c, DD-06, CH-REC-B-006
      Given a session that answers no cleanup call
      And start() rejected with a FrameCaptureTimeout
      When the caller calls start() again, the session answers its setup calls and the frames now answer
      Then the second start() resolves
      And its first frame starts within W + 1 000 ms of the first start()'s rejection

    Scenario: A second stall behind a cleanup that never answers     # AC-4c, CH-REC-B-006
      Given a session that answers no cleanup call
      And start() rejected with a FrameCaptureTimeout
      When the caller calls start() again, the session answers its setup calls and again never answers the frame request
      Then the second start() rejects with a new FrameCaptureTimeout within 2 × W + 1 000 ms of the call
      But NOT a hang
      And NOT "Capture is in progress"

    Scenario: The earlier cleanup tests gain their full ending      # AC-8, DD-03
      Given the tests of the two earlier items whose session never answers the cleanup calls
      And the deadlock-fix tests among them now set W = 250 ms, while the frame-watchdog tests keep W = 1 500 ms
      When the bounded stop lands
      Then each ends with a stop() that rethrows and a second stop() that throws "Capture is not in progress"
      And each ends within W + 1 000 ms of its rejection
      And every timer the cleanup race armed was cleared before the test ends

    Scenario: stop() after stop() rejected                          # AC-3b, DD-03
      Given stop() rejected with a FrameCaptureTimeout
      When the caller calls stop() again
      Then it rejects with the same FrameCaptureTimeout instance
      And a third stop() throws "Capture is not in progress"

    Scenario: A caller's detach() after a stall is bounded           # AC-9, CH-REC-B-007
      Given start() rejected with a FrameCaptureTimeout and both DD-03 stop() calls have run
      And a session that answers no further command
      When the caller calls detach()
      Then it settles within W + 1 000 ms and the recorder holds no page
      But NOT a hang

  Rule: Internal stops are bounded, and every pending wait hears them

    Scenario Outline: Internal stop during a stall                  # AC-4, AC-5, CH-REC-B-004
      Given a session that answers no cleanup call
      And a capturing recorder with a frame that never answers
      When <event> happens
      Then the internal stop and detach complete within 2 × W + 1 000 ms, plus ffmpeg finalisation
      And a later stop() rejects with "<error>"

      Examples:
        | event                     | error                    |
        | the page closes           | Page was closed          |
        | the session disconnects   | Session was disconnected |

    Scenario: The internal stop shares one cleanup deadline         # AC-4, CH-REC-B-004, design § 13
      Given W = 1 500 ms, one page frame and a session that answers no cleanup or detach call
      And a capturing recorder whose frame never answers
      When the page closes
      Then the internal stop and detach complete within 4 000 ms of the frame's start
      But NOT after separate races for the stop's cleanup and the detach, which would take at least 4 500 ms

    Scenario Outline: A close while start() waits on a stalled first frame  # AC-4b, CH-REC-B-004, DD-08
      Given a session that answers no cleanup call
      And start() is waiting on a first frame that never answers
      When <event> happens before the deadline
      Then start() rejects with "<error>", the first cause recorded, within W + 1 000 ms of the frame's start
      And the internal stop and detach complete within 2 × W + 1 000 ms, plus ffmpeg finalisation
      And a later stop() rejects with that same error
      But NOT an internal stop queued forever behind the lock start() holds

      Examples:
        | event                     | error                    |
        | the page closes           | Page was closed          |
        | the session disconnects   | Session was disconnected |

    Scenario Outline: A close while waitForTimeout() is pending     # AC-4d, CH-REC-B-002, CH-REC-B-004, DD-09, DD-10
      Given a session that answers no cleanup call
      And waitForTimeout(1000) is pending while the current frame <frame>
      When <event> happens
      Then waitForTimeout() rejects with "<error>" after the capture stopped event, within <bound>
      And the frame capture failed event <event count>
      And a later stop() rejects with that same error
      But NOT a waitForTimeout() that never settles

      Examples:
        | frame          | event                   | error                    | bound                               | event count                         |
        | never answers  | the page closes         | Page was closed          | W + 1 000 ms of the frame's start   | fires once, with that same instance |
        | never answers  | the session disconnects | Session was disconnected | W + 1 000 ms of the frame's start   | fires once, with that same instance |
        | answers        | the page closes         | Page was closed          | 1 000 ms of the close               | does not fire                       |
        | answers        | the session disconnects | Session was disconnected | 1 000 ms of the disconnect          | does not fire                       |
        | answers        | ffmpeg fails            | the ffmpeg error         | 1 000 ms of the failure             | does not fire                       |

    Scenario Outline: A failure recorded in the retry gap reaches start()  # AC-10, CH-REC-B-008, DD-12
      Given start() is waiting on a first frame whose request answered with no screenshot
      When <event> happens before the retry runs
      Then start() rejects with "<error>" within W + 1 000 ms of the frame's start
      And a later stop() rejects with that same error
      But NOT a start() that waits forever on a retry that returned without sending

      Examples:
        | event                   | error                    |
        | the page closes         | Page was closed          |
        | the session disconnects | Session was disconnected |
        | ffmpeg fails            | the ffmpeg error         |

    Scenario: A close before a healthy first frame rejects start()    # AC-10, CH-REC-B-008, DD-12
      Given start() is waiting on a first frame that answers 50 ms later
      When the page closes before that answer
      Then start() rejects with "Page was closed" within W + 1 000 ms of the frame's start
      And no frame captured event fires
      But NOT a resolution of start()

    Scenario: A close during start()'s setup is heard once setup ends  # AC-10, CH-REC-B-008, DD-12
      Given a session that answers start()'s setup calls after 50 ms
      When the page closes while the first setup call is pending
      Then start() rejects with "Page was closed" within W + 1 000 ms of the setup's end
      But NOT a resolution of start()

    Scenario: A disconnect during start()'s own awaits is kept and heard   # AC-10, CH-REC-B-008, DD-12
      Given a customFfmpegConfig callback that awaits 50 ms
      When the session disconnects during that await
      Then start() rejects with "Session was disconnected" within W + 1 000 ms of the call
      But NOT a start() that waits forever with no frame requested

  Rule: The first recorded failure is the one reported

    Scenario Outline: Two failures in either order                  # AC-5b, DD-08
      Given a session that answers no cleanup call
      And <first> happened
      And then <second> happened
      When the caller calls stop()
      Then stop() rejects with <reported>

      Examples:
        | first             | second                   | reported                |
        | a frame stalled   | the session disconnected | the FrameCaptureTimeout |
        | the page closed   | a frame stalled          | Page was closed         |
        | a frame stalled   | ffmpeg failed            | the FrameCaptureTimeout |

  Rule: A healthy stop is unchanged, and detach() waits for it and refuses while capturing

    Scenario: detach() refuses while a capture runs                   # AC-11, CH-REC-B-009, DD-13
      Given a capture in progress with waitForTimeout(1000) pending
      When the caller calls detach()
      Then it rejects with "Capture is in progress" and the recorder still holds its page
      And waitForTimeout() later resolves, and a following stop() resolves
      But NOT a detached session under a running frame loop

    Scenario: detach() waits for a draining stop()                    # AC-11, CH-REC-B-009, DD-13
      Given stop() draining a frame that never answers
      When the caller calls detach()
      Then detach() settles after stop() does, within 2 × W + 1 000 ms of the frame's start
      And the recorder holds no page
      But NOT a TypeError from the stop once the page is gone


    Scenario: Healthy stop                                          # AC-6
      Given a healthy capture
      When the caller calls stop()
      Then stop() resolves
      And every timer armed for the cleanup was cleared, as the test itself asserts
```

## Coverage

| Item | Scenarios (outline rows counted) | Item ACs covered | Not formulated, and why |
|---|---|---|---|
| Deadlock fix | 10 | AC-1 to AC-7, AC-5b, AC-5c, AC-5d | AC-8 is a suite-wide constraint: lint, test and an unchanged `testTimeout`. It is checked by review and by the CI run. |
| Frame watchdog | 25 | AC-1 to AC-10, AC-1b, AC-2b, AC-10b, AC-15, AC-16, AC-17, AC-18 | AC-11 (export) is checked by a type-level import test in the item. AC-12 (retry path unchanged) is a diff review. AC-13 (no masking) is a review and CI check. AC-14 (large-viewport run) is a manual measurement, not a test. The "under 5 s" clause of AC-13 is read from Jest's per-test times on the CI run. |
| Bounded stop | 36 | AC-1 to AC-6, AC-1b, AC-3b, AC-4b, AC-4c, AC-4d, AC-5b, AC-8, AC-9, AC-10, AC-11 | AC-7 (no masking) is a review and CI check. |
