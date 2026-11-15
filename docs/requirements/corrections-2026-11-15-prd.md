---
scope: Corrections to puppeteer-capture found on 2026-11-15 (capture-hang premise, error-name mismatch, untested Node 24, unverified claims in the 2026-11-14 scope documents)
created: 2026-11-15
profile: lean
formulation:
  technical-architecture: complete
  infrastructure: complete
  security-architecture: complete
  testing-architecture: complete
features:
  hang-premise: {stage: designed, tracks: [technical-architecture, testing-architecture]}
  error-name: {stage: designed, tracks: [technical-architecture, testing-architecture]}
  node-lines: {stage: designed, tracks: [infrastructure, testing-architecture]}
  claim-audit: {stage: designed, tracks: [technical-architecture, security-architecture, testing-architecture]}
artifacts:
  design-doc: docs/design/corrections-2026-11-15-solution-design.md
  design-brief: docs/design/corrections-2026-11-15-brief.md
dor_status: failed
---

# 2026-11-15 Corrections: Capture-Hang Premise, Error Naming, CI Node Lines, and Scope-Doc Claims — Product Requirements Document

**Version**: 1.0
**Created**: 2026-11-15
**Last Updated**: 2026-11-15
**Status**: Draft — ratification pending (captured in autonomous mode; see § 8, § 12 and § 14)
**Baseline**: `alexey-pelykh/puppeteer-capture` at `482eed3` (on `origin/main`), read 2026-11-15T07:55Z
**Sources**:
- S1 — scope working document `.tmp/scopes/findings-2026-11-15.md` (Stage 0, 2026-11-15): § Candidate findings, § Owner checkpoint, § Corpus Read.
- S2 — owner checkpoint answers of 2026-11-15, recorded in S1 § Owner checkpoint: the four selected findings, the corrective classification, the hold on the TypeScript 7 doc line.
- S3 — facts re-run by this stage on 2026-11-15 (commands and printed lines in § 2 Evidence).

S1 is local, gitignored scratch. Every fact this PRD relies on is restated in-band below, so the document does not
depend on it.

> **Provenance note.** No person was present during capture. The owner selected the four findings and confirmed
> them as corrective work (S2); that selection is the only owner-ratified input. Every requirement below is
> pipeline-authored (`AI-inferred-expansion`) and is ratification-pending. The problem statement and success
> criteria are normally the owner's to author; they were composed from the sources and are ratification-pending.

## 1. TL;DR

Four things in this repository are wrong or unchecked. (1) The capture-hang documents committed on 2026-11-14, and
issues #339, #340, #341 and #342, say that nothing bounds a frame request, so `start()`, `waitForTimeout()` and
`stop()` wait forever. That premise is false: puppeteer-core rejects every CDP call after `protocolTimeout`, which
defaults to 180 000 ms at every puppeteer version in the CI matrix. Some waits are still endless, for other reasons,
and the documents must say which. (2) The missing-arguments error is exported as `MissingRequiredArgs`, but its
`err.name` at runtime is `MissingHeadlessExperimentalRequiredArgs`; the README documents only the first. (3)
`engines.node` admits Node 22, 24 and 26, and CI tests 22 and 26 but not 24. (4) The six scope document sets
committed on 2026-11-14 contain claims about CI, runtime and tooling behaviour that nobody checked against their
source; two such claims are already known to be false. The deliverables are four tracked work items that correct
or check each of these. None of them decides any of the owner decisions still pending on the capture-hang,
dependency-alert or TypeScript 7 work.

## 2. Problem Statement

- **Why this matters.** A design built on a false premise picks the wrong fix and the wrong urgency. The capture-hang
  work (#339–#342) is sized and ordered on "nothing bounds a frame request". A reader of the README cannot match
  the documented error name against the `err.name` they see. A Node line the package claims to support is never
  tested, so a break on it ships unseen. And the same unchecked-premise failure that produced (1) may sit in the
  other five scope document sets.
- **Who has this problem.** The maintainer, who is about to decide the pending capture-hang choices; any agent that
  executes #339–#342 from their bodies; library users who catch errors by name; users on Node 24.
- **Current state.** No tracked item covers any of the four findings (S1 § Corpus Read: lexical sweep for
  `protocolTimeout`, `MissingRequiredArgs`, `Node 24`/`krypton`/`node-version`; #352 names the export but not the
  mismatch).
- **Evidence** (S3, re-run 2026-11-15 at `482eed3` unless stated):
  - **protocolTimeout default.** `node_modules/puppeteer-core/package.json` printed `"version": "25.17.0"`;
    `src/cdp/Connection.ts:69` printed `this.#timeout = timeout ?? 180_000;`; `src/common/CallbackRegistry.ts:147`
    printed `if (timeout) {` (the rejection timer is armed only when the timeout is truthy, so `0` disables it).
    The oldest puppeteer in the CI matrix is `24.3.1` (`.github/workflows/ci.yml:100`). From the published tarball
    of `puppeteer-core@24.3.1`: `src/cdp/Connection.ts:54` printed `this.#timeout = timeout ?? 180_000;`,
    `src/common/CallbackRegistry.ts:133` printed `if (timeout) {`, and `src/node/BrowserLauncher.ts:334` printed
    `return new Connection('', transport, opts.slowMo, opts.protocolTimeout);`. `puppeteer-core@24.3.0` printed the
    same two lines (`Connection.ts:54`, `CallbackRegistry.ts:133`). This repository sets no `protocolTimeout`
    (`grep -rn protocolTimeout src/` printed nothing).
  - **The frame request is a CDP call.** `src/PuppeteerCaptureViaHeadlessExperimental.ts:151-159`: each frame is
    `frame.evaluate(...)` per frame, then `session.send('HeadlessExperimental.beginFrame', …)`. A rejection reaches
    the handler at `:181-188`, which calls `onFrameCaptureFailed`.
  - **The false claim, in committed documents.** `docs/requirements/capture-hang-prd.md:52`,
    `docs/design/capture-hang-brief.md:13` and `docs/briefs/2026-11-14-scope-capture-hang.md:12` each say
    "nothing bounds a frame request". `docs/requirements/capture-hang.feature.md:29` says "nothing bounds a cleanup
    that never answers"; the cleanup calls it names (`HeadlessExperimental.disable`, in-page evaluates) are CDP
    calls too. `grep -ci protocolTimeout` over the five capture-hang files printed `0` for each.
  - **Waits that are endless regardless of protocolTimeout** (code reading at `482eed3`, confidence 🟡 — to be
    confirmed by the item, REQ-002):
    - `start()` holds the start/stop lock (`PuppeteerCaptureBase.ts:135-137`) while it awaits its first frame
      (`:244-258`). On a frame failure, `onFrameCaptureFailed` (`:380-383`) awaits `stop()`, which waits for that
      lock (`:269`), and only then emits the event `start()` is waiting for. So `start()` never settles.
    - A `waitForTimeout()` listens only to `frameCaptured` and `frameCaptureFailed` (`:333-352`). When a stop ends
      the capture with no recorded failure, neither fires. The capture-hang design already records this
      (`docs/design/capture-hang-solution-design.md` R6, DD-10, line 406).
    - `_stop` awaits ffmpeg's exit (`PuppeteerCaptureBase.ts:301-305`); that is not a CDP call.
  - **The Stage 0 statement of this finding was itself too narrow.** S1 says "The only endless wait is `start()`".
    The `waitForTimeout()` case above contradicts "only". This PRD carries the wider statement.
  - **Error name.** `src/index.ts:6` printed
    `export { MissingHeadlessExperimentalRequiredArgs as MissingRequiredArgs } from './MissingHeadlessExperimentalRequiredArgs'`;
    `src/MissingHeadlessExperimentalRequiredArgs.ts:9` printed `this.name = this.constructor.name`; `README.md:181`
    printed `` **`MissingRequiredArgs`** — Thrown when the browser is missing one or more required Chrome ``.
  - **Node lines.** `package.json:74` printed `"node": ">=22.12.0"`. `.github/workflows/ci.yml:29-30` (job `build`)
    printed `node-version:` / `- lts/jod`; `ci.yml:169` (job `integration`) printed `node-version: lts/*`. CI job
    132360535486 printed `node: v26.13.1` (S1). `https://nodejs.org/dist/index.json`: the newest `v24.` entry is
    `v24.22.3 2026-11-10 Krypton` (LTS).
  - **Unchecked claims in scope documents.** The six 2026-11-14 sets (§ 10.4) total several thousand lines across
    `docs/requirements/`, `docs/design/`, `docs/briefs/` and `docs/features/`. Two claims in them are already known
    false: the hang premise above, and `docs/design/typescript-7-adoption-solution-design.md:25`, which says CI runs
    Node `lts/jod` in every integration cell (integration runs `lts/*`). The second is held (§ 3).
- **Why now.** The owner is about to decide the capture-hang watchdog default, its off-switch, the release type and
  #341's priority; each of those rests on the premise. Node 24 has been in maintenance since 2026-10-20 and is still untested.

## 3. Boundaries

- **Appetite**: small batch — three documentation corrections or small edits (premise, error name, Node lines) and
  one audit of several thousand lines of committed documents. Hours of hands-on work per item; the audit is the largest.
  Circuit breaker: if the audit finds that more than one doc set needs rework beyond line corrections, stop, record
  what was found, and return to the owner instead of rewriting the sets. (Proposed by the pipeline; ratification
  pending.)
- **Out of scope, not yet**:
  - The TypeScript 7 doc line (`docs/design/typescript-7-adoption-solution-design.md:25`). **Held** by the owner
    behind the TypeScript 7 decision (#335). No requirement here corrects it; the audit records it and leaves it.
  - Implementing the watchdog (#340), the start/stop deadlock fix (#339), bounding `stop()` (#341) or the
    documentation of the new error (#342). Those are existing items; this PRD only corrects their premise.
  - Amending the bodies or requirements of existing issues #332–#352. Corrections to #339–#342 are recorded as
    comments that link the corrected documents (REQ-003); their requirements stay as the owner left them.
  - A finding about a dangling section reference in the operator's own Claude configuration. It lives in another
    repository and is tracked there.
- **Explicitly not building**:
  - Setting `protocolTimeout` in `launch()` or changing any timeout. A premise correction changes documents, not
    behaviour.
  - Changing which puppeteer versions CI tests.
  - Rewriting the six scope document sets. The audit checks claims and routes corrections; it does not restyle.

## 4. Success Criteria

- **Serves**: the documents and the README say what the code and CI actually do, and every supported Node LTS line
  is tested.
- **Leading indicators (within two weeks of each item merging)**:
  - L1 `PremiseCorrected`: `grep -c protocolTimeout` over the five capture-hang files prints at least 1 for each,
    and `grep -n "nothing bounds a frame request"` over the same five files prints nothing.
  - L2 `ErrorNameConsistent`: a unit test asserts that the error thrown for missing arguments is an instance of the
    export and has the `name` the README documents; it passes in CI.
  - L3 `NodeLinesTested`: on the first CI run after the change, the logs print a Node 22, a Node 24 and a Node 26
    version.
  - L4 `AuditComplete`: each of the six sets has its own record under `docs/audits/`, and every row cites a source.
- **Lagging indicators (30 / 60 days)**:
  - G1 `FalseClaimsOpen`: number of claims the audit judged false that have neither a correction merged nor an
    open tracked item. Goal 0 at 30 days.
  - G2 `PremiseRepeated`: number of new issue bodies, comments or committed documents that assert an unbounded
    frame request without naming `protocolTimeout`. Goal 0. Meter: `gh search issues --repo
    alexey-pelykh/puppeteer-capture forever` plus `git log -p --since` on `docs/`, read by hand.
- **Decision gates**:
  - D1: if the audit judges false at least one claim in two or more sets other than capture-hang and TypeScript 7,
    the owner decides whether the scoping process needs a claim-verification step (a change outside this
    repository).
  - D2: the corrected premise is an input to the pending watchdog-default, off-switch, release-type and #341
    priority decisions (OQ-1 to OQ-4); this PRD does not answer them.

## 5. Proposed Solution

Sketch altitude; the design belongs to the solution design document.

1. **Premise correction**: edit the five capture-hang documents so each states the `protocolTimeout` bound, lists
   which waits stay endless and why, and cites the line or test behind each statement; post one comment on each of
   #339–#342 linking the corrected documents.
2. **Error name**: make the README, the export and `err.name` agree, by documentation or by code, with a test that
   holds them together.
3. **Node lines**: make CI test every Node LTS line inside `engines.node`, each named explicitly.
4. **Claim audit**: list every CI, runtime or tooling claim in the six sets with its source and verdict, and route
   each false one to a correction or a tracked item.

## 6. Risks and Mitigations

| ID | Risk | L | I | Mitigation |
|---|---|---|---|---|
| R1 | The premise correction is read as answering a pending owner decision (watchdog default, release type, #341 priority) | M | H | REQ-004: no requirement, value or decision in the capture-hang documents changes; the bearing on each pending decision is written as an open question |
| R2 | The corrected statement of which waits are endless is itself wrong (the Stage 0 statement already was, § 2) | M | M | REQ-002: every statement cites a source line or a test; the item confirms by test where it can |
| R3 | The error-name fix renames `err.name` and breaks callers who match the current name | L | M | REQ-011: any change to `err.name` or the exports is recorded as a public-API change; OQ-5 puts the approach to the owner |
| R4 | Adding a Node line to the `build` matrix adds check contexts while the required checks on `main` are being reworked (#333, #334) | M | L | REQ-020 asks only that a line be tested; the design places it with #333/#334 in view |
| R5 | The audit grows into a rewrite of six document sets | M | M | § 3 circuit breaker; REQ-031 routes corrections instead of applying them all |
| R6 | The audit edits a document whose correction waits on a pending owner decision | M | H | REQ-032 |
| R7 | The audit record discloses a security-sensitive finding in a public document | L | H | REQ-034 |

## 7. Dependencies

- #339, #340, #341, #342 (premise consumers). #343 (spike on the unanswered `beginFrame`).
- #352 (also edits `src/MissingHeadlessExperimentalRequiredArgs.ts` and the README area around § Error Classes).
- #333, #334 (required checks on `main`; a new `build` cell is a new check context).
- #335 (TypeScript 7; holds `docs/design/typescript-7-adoption-solution-design.md:25`).
- #332, #338, #347 (their doc sets are in the audit; their decisions are pending).
- Node's release schedule (`https://nodejs.org/dist/index.json`).

## 8. Open Questions

Each names the pending owner decision it touches. None is answered here.

| ID | Question | Pending decision it touches | Default if unanswered |
|---|---|---|---|
| OQ-1 | With `protocolTimeout` already rejecting a stalled `beginFrame` after 180 000 ms by default, what should the watchdog's default be, and is an off-switch still needed? | capture-hang watchdog default and off-switch (#340) | No default is chosen here; the corrected documents state the 180 000 ms bound as an input |
| OQ-2 | Does the corrected premise change the release type of the capture-hang change? | capture-hang release type | Unchanged; owner decides |
| OQ-3 | The cleanup CDP calls `stop()` makes are bounded by `protocolTimeout` too. Does that change #341's priority? | #341 priority | Unchanged; owner decides |
| OQ-4 | How should a `waitForTimeout()` settle when the caller's own `stop()` ends the capture? (Endless today, independent of `protocolTimeout`.) | waitForTimeout on stop | Stays out of scope, as #341 already carves it out |
| OQ-5 | Align the error by documentation only, by an additional export, or by changing `err.name`? | none pending; public-API choice | Design recommends; owner ratifies |
| OQ-6 | Should the audit correct false claims in its own change, or file one item per false claim? | none pending | Design recommends; owner ratifies |
| OQ-7 | Claims in the deepmerge, minimatch, TypeScript 7, capture-hang and bump-invariants sets whose correction would pre-empt a pending decision (#332, #338, #335, capture-hang calls, #347): record only, or also file? | #332, #338, #335, #347, capture-hang calls | Record only; leave the document unchanged |

## 10. Requirements

Object model omitted by the lean profile. Objects named here: the **capture-hang documents** (the five files in
REQ-001), the **capture-hang issues** (#339–#342), the **missing-arguments error** (the class in
`src/MissingHeadlessExperimentalRequiredArgs.ts`, exported as `MissingRequiredArgs`), the **CI Node matrix** (the
`node-version` values in `.github/workflows/ci.yml`), the **scope document sets** (§ 10.4), and the **audit record**.

EARS pattern noted after each statement.

### 10.1 Hang premise {#feature-hang-premise}

- **REQ-001**: Each of `docs/requirements/capture-hang-prd.md`, `docs/requirements/capture-hang.feature.md`, `docs/design/capture-hang-solution-design.md`, `docs/design/capture-hang-brief.md` and `docs/briefs/2026-11-14-scope-capture-hang.md` shall state that puppeteer-core rejects each CDP call this library makes after `protocolTimeout`, which defaults to 180 000 ms at every puppeteer version in the CI matrix and arms no timer when a caller sets it to `0`. *(ubiquitous)*
  - AC-001a: Given the five files after the change, When `grep -c protocolTimeout` runs on each, Then each prints at least `1`.
  - AC-001b: Given the five capture-hang files, When `grep -n "nothing bounds a frame request"` runs over them, Then it prints nothing, and every other sentence there that says a real-Chrome call waits without end is reworded or carries a note pointing at the bound table, BUT NOT a removal of the observed CI stalls (2026-09-19, 2026-11-14) from the documents, and BUT NOT an edit to a sentence that describes a mocked session.
- **REQ-002**: For each of `start()`, `waitForTimeout()` and `stop()`, the capture-hang documents shall state whether a stalled frame leaves it waiting without end under the default `protocolTimeout`, and under `protocolTimeout: 0`, and shall cite the source line or test result that supports each statement. *(ubiquitous)*
  - AC: Given the corrected `docs/design/capture-hang-solution-design.md`, When read, Then it holds one statement per call per setting (at least six statements; the bound table holds eight cells), each with a `file:line` at a named revision or a named test, BUT NOT a statement with no citation.
- **REQ-003**: When the capture-hang documents are corrected, each of #339, #340, #341 and #342 shall receive one comment that states the corrected premise in one or two sentences and links the corrected documents at the merged revision. *(event-driven)*
  - AC: Given the merged correction, When `gh issue view {N} --comments` runs for each N in 339–342, Then each shows one such comment, BUT NOT an edit to the issue body, title, labels or state.
- **REQ-004**: If a sentence in the capture-hang documents states or depends on a pending owner decision (watchdog default and off-switch, option and error names, `stop()` after a stall, release type, #341 priority, `waitForTimeout()` on stop), then the correction shall leave that decision unanswered and shall add the premise's bearing on it as an open question naming the decision. *(unwanted behaviour)*
  - AC: Given the diff of the correction, When read, Then no requirement ID, design-decision ID, acceptance criterion, option name, error name or numeric default is added, removed or changed, BUT NOT the absence of open-question rows carrying OQ-1 to OQ-4 of this PRD.

### 10.2 Error name {#feature-error-name}

- **REQ-010**: The README § Error Classes entry for the missing-arguments error shall name the identifier a caller imports and the value of `err.name` a caller observes, and the two shall match what the package exports and throws. *(ubiquitous)*
  - AC: Given the built package, When a unit test triggers the missing-arguments error (for example through `validateBrowserArgs` with a browser lacking a required argument), Then the error is `instanceof` the exported `MissingRequiredArgs` and its `name` equals the name the README states, BUT NOT a README that states one name while `err.name` holds another.
- **REQ-011**: If the fix changes the value of `err.name` or the set of exported names, then `CHANGELOG.md` `[Unreleased]` shall record it under `### Changed` as a public-API change. *(unwanted behaviour)*
  - AC: Given such a change, When `CHANGELOG.md` is read, Then `[Unreleased]` `### Changed` names the old and new values, BUT NOT an entry under `### Fixed` only.

### 10.3 Node lines {#feature-node-lines}

- **REQ-020**: While a Node LTS major line falls inside `engines.node`, the CI workflow shall run the unit test suite on that line for every pull request to `main`. *(state-driven)*
  - AC: Given the first pull-request run after the change, When `gh run view {RUN_ID} --log | grep -o "node: v2[246]\.[0-9.]*" | sort -u` runs (or the equivalent `node --version` step output), Then it prints a `v22.`, a `v24.` and a `v26.` version, BUT NOT the removal of `lts/jod` from `build`.
- **REQ-021**: The CI workflow shall name each tested Node line explicitly (by codename or major version), so the set of tested lines changes only through a commit. *(ubiquitous)*
  - AC: Given `.github/workflows/ci.yml`, When `grep -n "node-version" -A3 .github/workflows/ci.yml` runs, Then no tested line is selected by a moving alias (`lts/*`, `latest`, `current`) alone, BUT NOT a change to which puppeteer versions are tested.
- **REQ-022**: The `CLAUDE.md` § Testing "CI matrix" entry shall list the Node lines CI tests. *(ubiquitous)*
  - AC: Given `CLAUDE.md`, When § Testing is read, Then it names each Node line `ci.yml` tests, BUT NOT only `LTS jod`.

### 10.4 Scope-document claim audit {#feature-claim-audit}

The six sets, as committed at `482eed3`:

| Set | Files |
|---|---|
| bump-invariants-unchecked | `docs/requirements/bump-invariants-unchecked-prd.md`, `docs/design/bump-invariants-unchecked-solution-design.md`, `docs/design/bump-invariants-unchecked-design-brief.md`, `docs/briefs/2026-11-14-scope-bump-invariants-unchecked.md`, `docs/features/bump-invariants-checker.feature.md`, `docs/features/bump-puppeteer-precommit-check.feature.md` |
| minimatch-alert | `docs/requirements/minimatch-alert-prd.md`, `docs/requirements/minimatch-alert-requirements-brief.md`, `docs/design/minimatch-alert-solution-design.md`, `docs/design/minimatch-alert-brief.md`, `docs/briefs/2026-11-14-scope-minimatch-alert.md` |
| deepmerge-alert | `docs/requirements/deepmerge-alert-prd.md`, `docs/design/deepmerge-alert-solution-design.md`, `docs/design/deepmerge-alert-brief.md`, `docs/briefs/2026-11-14-scope-deepmerge-alert.md` |
| typescript-7 | `docs/requirements/typescript-7-toolchain-prd.md`, `docs/requirements/typescript-7-toolchain.feature.md`, `docs/design/typescript-7-adoption-solution-design.md`, `docs/design/typescript-7-adoption-brief.md`, `docs/briefs/2026-11-14-scope-typescript-7-blocked.md` |
| capture-hang | `docs/requirements/capture-hang-prd.md`, `docs/requirements/capture-hang.feature.md`, `docs/design/capture-hang-solution-design.md`, `docs/design/capture-hang-brief.md`, `docs/briefs/2026-11-14-scope-capture-hang.md` |
| phantom-required-checks | `docs/requirements/phantom-required-checks-prd.md`, `docs/requirements/phantom-required-checks.feature.md`, `docs/design/phantom-required-checks-solution-design.md`, `docs/design/phantom-required-checks-brief.md`, `docs/briefs/2026-11-14-scope-phantom-required-checks.md` |

- **REQ-030**: The audit record shall list every claim about CI, runtime or tooling behaviour in the six sets, each with its `file:line`, the claim quoted, the source checked (a `file:line` at a named revision, a command with the line it printed, or a vendor document with its version or retrieval date), and a verdict of `holds`, `false` or `unverifiable`. *(ubiquitous)*
  - AC: Given a set's audit record, When read, Then its header names the set, its scope commit and the audit baseline, and every row carries `file:line`, the claim quoted, its kind, the source checked, the version checked, the verdict and the routing, BUT NOT a `holds` or `false` verdict with no cited source.
- **REQ-031**: When the audit judges a claim `false`, the claim shall be corrected in a merged change, or covered by an open tracked item that quotes it, or — for a claim the owner holds — marked with that hold, and the audit record shall name which. *(event-driven)*
  - AC: Given the audit record, When each `false` row is read, Then it names the pull request that corrects it (`corrected in PR #N`), an open issue `#N`, the premise-correction item, or the owner's hold, BUT NOT a `false` row with none of these.
- **REQ-032**: If a claim belongs to a document whose correction would pre-empt a pending owner decision (#332, #335 including the held TypeScript 7 doc line, #338, #347, or the pending capture-hang decisions), then the audit shall record the claim and its verdict and leave the document unchanged. *(unwanted behaviour)*
  - AC: Given an audit pull request, When `git diff --stat` against its base runs, Then it modifies only its own record under `docs/audits/` and, for the phantom-required-checks set alone, lines of that set's files, BUT NOT the omission of the other sets' false claims from their records.
- **REQ-033**: Where a claim concerns a tool, library or service whose behaviour depends on its version, the audit shall check it at the version the subject uses at the audit's baseline, and at the oldest version the subject supports when the claim covers a range. *(optional feature)*
  - AC: Given a row about puppeteer, Node or a GitHub Action, When read, Then it names the version(s) checked, BUT NOT only the newest version for a claim that covers the CI matrix.
- **REQ-034**: If the audit finds a claim about a GitHub Actions workflow other than `.github/workflows/ci.yml`, whatever its verdict, or a claim whose correction would describe a security weakness, then the audit record and every issue the audit files shall leave it out, and the claim shall be reported through the private channel `SECURITY.md` names. *(unwanted behaviour)*
  - AC: Given the audit record, When read, Then it states that security-relevant findings were routed per `SECURITY.md`, BUT NOT any such finding itself.
- **REQ-035**: The capture-hang premise claims and the TypeScript 7 doc line shall appear in the audit record by reference to the item or hold that owns them, not as new correction items. *(ubiquitous)*
  - AC: Given the capture-hang and typescript-7-blocked records, When read, Then those rows name the premise-correction item and the hold respectively, BUT NOT a second item for the same claim.

## 12. Assumption Registry

| ID | Assumption | Type | Confidence | Evidence | Validation plan | Risk if wrong |
|---|---|---|---|---|---|---|
| A-1 | Every CDP call the library makes goes through a puppeteer-core `Connection` created with the launch/connect `protocolTimeout` | technical | 🟡 | `BrowserLauncher.ts:334` (24.3.1); the `CDPSession.send` path is not yet traced at every version | The REQ-002 item traces `session.send` to `CallbackRegistry` at 24.3.1 and 25.17.0 | Some call stays unbounded and REQ-001's statement is too broad |
| A-2 | The two CI stalls (2026-09-19, 2026-11-14) are the `start()` deadlock and not an unbounded CDP call | technical | 🟡 | Both hit the first frame of a capture (capture-hang PRD § 1); the deadlock path is in § 2 | #343 spike, or a log of a stalled run showing a `protocolTimeout` rejection | The premise correction understates the problem |
| A-3 | Node 26 is an LTS line on 2026-11-15 (`lts/*` resolved to `v26.13.1`) | technical | 🟢 | CI job 132360535486 log (S1) | `https://nodejs.org/dist/index.json` `lts` field for `v26.` | REQ-020's list of lines is wrong |
| A-4 | A tested Node line need not be tested on both OSes | scope | 🟡 | pipeline-proposed | owner ratification | under- or over-testing |
| A-5 | The six sets hold few enough CI/runtime/tooling claims for one audit item | scope | 🟡 | several thousand lines; claim density unknown | Stage 3 granularity evaluation | the audit item splits; falsified at Stage 3, split into one item per set (#357–#362) |
| A-6 | The appetite (small batch) holds | scope | 🟡 | pipeline-proposed | owner ratification | rescoping |

## 14. Source Traceability

`user-stated` is reserved for the owner's 2026-11-15 checkpoint answers (S2). Every requirement below is
pipeline-authored and needs the owner's one-at-a-time ratification.

| Req ID | Source | Object | Feature | Layer | Confidence | Origin | Ratified |
|---|---|---|---|---|---|---|---|
| REQ-001 | S1 F-hang-premise, S3 | capture-hang documents | hang-premise | functional | 🟢 | AI-inferred-expansion | pending |
| REQ-002 | S3 (code reading; S1's narrower claim corrected) | capture-hang documents | hang-premise | functional | 🟡 | AI-inferred-expansion | pending |
| REQ-003 | S1 § Corpus Read, S2 | capture-hang issues | hang-premise | functional | 🟢 | AI-inferred-expansion | pending |
| REQ-004 | S2 (pending decisions) | capture-hang documents | hang-premise | constraint | 🟢 | AI-inferred-expansion | pending |
| REQ-010 | S1 F-error-name, S3 | missing-arguments error | error-name | functional | 🟢 | AI-inferred-expansion | pending |
| REQ-011 | R3 | missing-arguments error | error-name | constraint | 🟢 | AI-inferred-expansion | pending |
| REQ-020 | S1 F-node24, S3 | CI Node matrix | node-lines | functional | 🟢 | AI-inferred-expansion | pending |
| REQ-021 | S3 (`lts/*` moved from 24 to 26 with no commit) | CI Node matrix | node-lines | constraint | 🟡 | AI-inferred-expansion | pending |
| REQ-022 | S3 (`CLAUDE.md` § Testing names only `LTS jod`) | CI Node matrix | node-lines | functional | 🟢 | AI-inferred-expansion | pending |
| REQ-030 | S1 § Seed enrichment Bucket 3, S2 | audit record | claim-audit | functional | 🟢 | AI-inferred-expansion | pending |
| REQ-031 | S2 | audit record | claim-audit | functional | 🟢 | AI-inferred-expansion | pending |
| REQ-032 | S2 (hold; pending decisions) | audit record | claim-audit | constraint | 🟢 | AI-inferred-expansion | pending |
| REQ-033 | S3 (the Stage 0 finding cited only 25.17.0) | audit record | claim-audit | constraint | 🟢 | AI-inferred-expansion | pending |
| REQ-034 | `SECURITY.md` | audit record | claim-audit | constraint | 🟢 | AI-inferred-expansion | pending |
| REQ-035 | S2 | audit record | claim-audit | constraint | 🟢 | AI-inferred-expansion | pending |

## 15. Cross-Cutting and Non-Functional Concerns

### 15.1 Security
- REQ-034 keeps security-relevant findings out of public documents and routes them per `SECURITY.md`.
- No item touches secrets, permissions or workflow triggers. The Node-line change adds matrix values to an existing
  job under the workflow's existing `contents: read` permission.

### 15.2 Compliance and Regulatory
N/A — open-source documentation, a public error name and CI configuration; no regulated data or obligation is
touched.

### 15.3 Reliability and Observability
- Claim fidelity — TAG `FalseClaimsOpen`; SCALE: claims judged false with no merged correction and no open item;
  METER: the audit record's `false` rows checked against `gh issue view` and `git log`; GOAL: 0 at 30 days.
- The Node-line change surfaces a Node 24 break in CI instead of in a user's install.

### 15.4 Performance and Scalability
- One more Node line multiplies the cells of whichever job carries it. Budget: no more than two added cells; the
  design states the count.

### 15.5 Operational
- Every item is executed by `/do` in a pull request; `/scope` edits none of the affected files.
- Rollback: each item is a revert of its own commit.

### 15.6 Lifecycle
- Node lines enter and leave the LTS window on Node's schedule; REQ-021 makes each such change a visible commit,
  and REQ-020 states the rule the commit follows.
- The audit record is a dated snapshot at its baseline; it is not maintained after the corrections land.

## 16. Change Log

| Version | Date | Change | Rationale | Impact |
|---|---|---|---|---|
| 1.0 | 2026-11-15 | Created from the 2026-11-15 findings and the owner's checkpoint answers | Corrective route (owner-confirmed) | New PRD; feeds `/design-solution` |

## Readiness (Definition of Ready, `/capture-requirements` § dor-gate)

| Check | Result | Note |
|---|---|---|
| 1 Validated problem statement | pass (content) | § 2, evidence re-run at `482eed3`; framing composed autonomously, ratification pending |
| 2 Explicit out-of-scope | pass | § 3, four deferrals and three never-builds |
| 3 Success and telemetry metrics | pass | leading L1–L4, lagging G1–G2, gates D1–D2 |
| 4 Non-functional concerns | pass | § 15, every subsection content or N/A with rationale |
| 5 Feature completeness | N/A | lean profile omits § 13 by declaration |
| 6 Requirement provenance | **FAIL** | all fifteen requirements are pipeline-authored and await the owner's one-at-a-time ratification; this run was autonomous |

Verdict: `failed` on check 6 only. Remediation: the owner ratifies or rejects each row in § 14, then the gate is
re-run and `dor_status` rewritten.
