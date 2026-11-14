---
scope: TypeScript toolchain (compiler, test transform, lint) of puppeteer-capture
created: 2026-11-14
profile: full
formulation:
  technical-architecture: complete
  testing-architecture: complete
features:
  diagnosis-correction:
    stage: designed
    tracks: [technical-architecture, testing-architecture]
  typescript-7-build-adoption:
    stage: designed
    tracks: [technical-architecture, testing-architecture]
artifacts:
  design-doc: docs/design/typescript-7-adoption-solution-design.md
  design-brief: docs/design/typescript-7-adoption-brief.md
dor_status: failed
---

# TypeScript 7 Toolchain — Product Requirements Document

**Version**: 1.1
**Created**: 2026-11-14
**Last Updated**: 2026-11-14
**Status**: Draft — readiness `failed` on requirement provenance only (see § 12 and the DoR note in § 16)
**Sources**:
- `src-dispatch` — the owner's 2026-11-14 decision that each council gap, this one included, is a validated, evidence-backed defect to scope on the corrective route.
- `src-synthesis` — the council synthesis, section `gap-typescript-7-blocked` (council-authored; its "Verified" line re-run by the orchestrator).
- `src-e7` — the council evidence pack, section E7: `ts-jest@latest` peer range, TypeScript dist-tags, the maintainer comments on PR #266.
- `src-spike` — the scoping spike run on 2026-11-14 against `main` at `185a1ad` (commands and their output in § 14 and the Evidence block of § 2).

## 1. TL;DR

PR #266 (Dependabot: `typescript` 6.0.3 → 7.0.2) has been open since 2026-07-11 on the diagnosis that it becomes mergeable once `ts-jest` widens its peer range. That diagnosis is wrong: the TypeScript 7 `typescript` package exposes no JavaScript compiler API at all, so `ts-jest` and `typescript-eslint` cannot run on it whatever their peer ranges say, and waiting will never unblock the PR. The project's triage records repeat the wrong diagnosis. This PRD asks for two things: correct the records, and adopt TypeScript 7 for the build while the test transform and the linter keep the TypeScript 6 compiler API, which the TypeScript team publishes for exactly this purpose as `@typescript/typescript6`. A spike shows the build, the unit tests and the lint all pass this way, and that TypeScript 7 emits a `lib/` byte-identical to TypeScript 6, so consumers see no change.

## 2. Problem Statement

- **Why this matters**: a false record steers every future triage of TypeScript updates toward a check (`npm view ts-jest@latest peerDependencies.typescript`) that can never flip to "unblocked", so the TypeScript major upgrade waits on an event that will not happen.
- **Who has this problem**: the maintainer and any agent triaging this repository's Dependabot PRs; indirectly, contributors who read the triage notes.
- **Current state**: PR #266 is open with two maintainer comments (2026-08-07, 2026-10-27) saying it is blocked upstream by `ts-jest`'s peer range `>=4.3 <7`. `.claude/memory/dependabot-triage-stale-base.md` line 21 and `.claude/memory/MEMORY.md` line 7 say the same. That diagnosis is wrong; the evidence below shows why. The build, tests and lint run on TypeScript 6.0.3.
- **Evidence** (re-run 2026-11-14):
  - `npm view typescript@7.0.2 exports --json` → `".": "./lib/version.cjs"` and `"./package.json"`; every other export is under `./unstable/*`.
  - `lib/version.cjs` of `typescript@7.0.2` exports only `version` and `versionMajorMinor`.
  - Under TypeScript 7.0.2, `ts-jest@29.4.15` fails with "The TypeScript compiler "typescript" (version 7.0.2) does not expose the JavaScript compiler API required by ts-jest", and `ts-standard@12.0.2` fails with "Failed to load plugin '@typescript-eslint' … Cannot read properties of undefined (reading 'Any')".
  - `npm view typescript-eslint version peerDependencies` → `8.72.2`, peer `typescript: ">=4.8.4 <6.1.0"`: no released `typescript-eslint` supports TypeScript 7 either.
  - `ts-jest`'s own error message names the remedy: alias `@typescript/typescript6` as `typescript` for ts-jest. It also names the TypeScript 7 package as `@typescript/native`, which does not exist on npm (`npm view @typescript/native` → E404).
  - Spike: with devDependencies `typescript: npm:@typescript/typescript6@6.0.2` and TypeScript 7.0.2 installed under a second alias, `npm install` resolves with no ERESOLVE, two ts-jest suites pass (4/4 and 18/18), `ts-standard` exits 0, and TypeScript 7 `tsc -p tsconfig.build.json --noEmit` exits 0.
  - Spike: TypeScript 6.0.3 and TypeScript 7.0.2 each emit 24 files from `tsconfig.build.json`; `diff -rq` reports 0 differing files.
- **Why now**: `typescript@latest` is 7.0.2 (`npm view typescript dist-tags`). The record has already misdirected two triage passes (the two PR comments), and a third is due at every weekly Dependabot run.
- **Cost of doing nothing**: PR #266 stays open indefinitely; the triage note keeps instructing a check that cannot succeed; the build stays one TypeScript major behind. The published package is unaffected either way.

**Reframing applied**: the observed symptom is "PR #266 is stuck"; the cause is (a) a wrong diagnosis recorded as fact, and (b) the test transform and the linter depending on the compiler API through the package name `typescript`, which TypeScript 7 no longer provides. Treating only the symptom (waiting, or closing #266) leaves both causes in place. This reframing is ratification-pending (autonomous run).

## 3. Boundaries

- **Appetite**: small batch — at most one working day of maintainer time across both features. Proposed by the pipeline from the de-risked spike; ratification-pending. The `lean` route was not taken because nobody could accept it mid-run; the full route ran.
- **Out of scope, not yet**:
  - Replacing `ts-standard` / `eslint@8` with a maintained linter stack. Deferred: not needed for TypeScript 7 (the alias keeps it running) and it changes the project's declared lint convention. Reopens when `ts-standard` or `eslint@8` stops installing or running on the supported Node.js, or when the owner decides to move off `ts-standard`.
  - Switching the Jest transform to `@swc/jest` or `babel-jest`. Deferred: the alias keeps `ts-jest` working, and the linter needs the TypeScript 6 API regardless, so a transform switch removes no dependency. Reopens if `@typescript/typescript6` stops being published or updated.
  - Removing the `@typescript/typescript6` alias. Deferred until both `ts-jest` and `typescript-eslint` (via the project's lint) run against the TypeScript 7 package; that event is the reopen trigger.
- **Explicitly not building**:
  - Use of TypeScript 7's `./unstable/*` API by this project. Why never: no project code calls the compiler API; only third-party tools do.
  - Changes to `tsconfig` targets, module settings or published output. Why never: the emit is identical; changing it is unrelated work.
  - Waiting for a `ts-jest` peer-range change as the unblocking event. Why never: it is the wrong diagnosis this PRD corrects.

## 4. Success Criteria

- **Serves**: keeping the development toolchain current and the project's triage records true (the owner's fix-validated-findings rule).
- **Leading indicators** (measurable within two weeks of the change landing):
  - L1: no file under `.claude/` and no open PR thread of this repository states that PR #266 becomes mergeable once `ts-jest` widens its peer range (meter: `git grep -n` over the tracked files under `.claude/memory/`, read of #266's latest comment).
  - L2: CI's build job logs a TypeScript compiler version whose major is 7 for the `lib/` build (meter: CI log line).
  - L3: the build, test and lint CI jobs pass on the adoption PR (meter: CI checks).
- **Lagging indicators**:
  - G1 (30 days): Dependabot PRs touching `typescript` or `@typescript/typescript6` are mergeable or closed within 14 days of opening, with no PR left open on an untrue blocker.
  - G2 (90 days): no regression report from consumers attributable to the compiler change (meter: GitHub issues).
- **Decision gates**:
  - If the TypeScript 6 vs 7 emit diff is non-empty at implementation time, stop and review every differing file before merging.
  - The adoption ships an `ignore` rule so Dependabot never proposes `typescript >=7` for the aliased `typescript` dependency (the harmful case). Whether Dependabot updates the aliased packages at all (assumption A3) is checked after the adoption merges, in #337; if it does not, #337 adds a manual bump procedure. (Changed at Stage 3.7 to match design decision D4 and OQ-2.)

## 5. Proposed Solution

Scenario 1 — a maintainer triages the next Dependabot `typescript` PR: the triage note tells them TypeScript 7 removed the compiler API from the `typescript` package, that the project builds with TypeScript 7 and gives `ts-jest` and `ts-standard` the TypeScript 6 API through `@typescript/typescript6`, and which check decides whether that arrangement can be retired.

Scenario 2 — a contributor runs `npm run build`, `npm test` and `npm run lint`: the build compiles with TypeScript 7 and fails loudly if any other compiler runs; tests and lint run as before.

Scenario 3 — a reader of PR #266 sees a corrective comment and, once the adoption change lands, the PR closed as superseded (the #228 → #260 precedent).

Technical design belongs to the solution design document.

## 6. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| The build silently runs TypeScript 6: in the spike `node_modules/.bin/tsc` linked to `@typescript/old/bin/tsc` (6.0.3, a transitive dependency of `@typescript/typescript6`) rather than to TypeScript 7 | High (observed) | Medium — the adoption would be fake | REQ-TC-002: the build fails unless the compiler that ran reports major 7 |
| Dependabot does not update npm-aliased devDependencies, so both TypeScript copies freeze | Medium | Medium — the toolchain goes stale silently | A3 validation plan; design names the fallback |
| `@typescript/typescript6` stops being updated | Low | Medium | Deferral trigger in § 3 (switch transform / replace linter) |
| `ts-standard` (last published 2023-07-13) and `eslint@8` (deprecated) break on a future Node.js | Medium | Medium | Out of scope here; reopen trigger in § 3 |
| Emit differences appear in a later TypeScript 7 patch | Low | Medium | Decision gate in § 4; REQ-TC-004 |

## 7. Dependencies

- `@typescript/typescript6` (npm; maintainers identical to `typescript`; repository `microsoft/TypeScript`; created 2026-04-16).
- `typescript@7.x` native compiler binaries for the CI platforms (`@typescript/typescript-linux-x64`, `@typescript/typescript-win32-x64` among its dependencies).
- PR #260 "(imp) typescript v6.0.3" — the repository's precedent for a maintainer-authored TypeScript-major adoption superseding Dependabot's bare bump (#228).
- Sibling council gaps (no relation to the toolchain beyond shared files): gap-bump-invariants-unchecked and gap-phantom-required-checks also edit `.github/workflows/ci.yml`; gap-minimatch-alert concerns transitive `minimatch` copies that include `minimatch@3.1.5` under `ts-standard` / `eslint@8`.

## 8. Open Questions

| ID | Question | Owner | Relates to |
|---|---|---|---|
| Q1 | Does Dependabot open update PRs for an npm-aliased devDependency (`"x": "npm:pkg@ver"`), and does it group or ignore them? | maintainer (answered after the adoption merges, by observing Dependabot's first weekly run — #337) | REQ-DEP-001, A3 |
| Q2 | Which package name holds TypeScript 7 in `devDependencies`, given `typescript` is taken by the TypeScript 6 alias? | design (Stage 2) | REQ-TC-001 |
| Q3 | Is a corrective comment on PR #266 still wanted when the adoption PR will close #266 shortly after? | owner | REQ-REC-003 |

## 9. Object Model

- **Objects**:
  - `TriageRecord` — a durable statement about why a dependency PR is blocked: `.claude/memory/dependabot-triage-stale-base.md`, its index line in `.claude/memory/MEMORY.md`, and the maintainer comments on PR #266. Lifecycle: written → corrected.
  - `BuildCompiler` — the TypeScript compiler that produces the published `lib/`. Lifecycle: TypeScript 6 → TypeScript 7.
  - `CompilerApiProvider` — the package that answers `require('typescript')` for `ts-jest` and `typescript-eslint`. Lifecycle: `typescript@6` → `@typescript/typescript6` aliased as `typescript` → removed once tools support TypeScript 7.
  - `DependencyUpdate` — a Dependabot PR such as #266. Lifecycle: open → superseded and closed.
- **Relationships**: `TriageRecord` describes 1 `DependencyUpdate`; `BuildCompiler` and `CompilerApiProvider` are both installed by `package.json` (1:1 each); `DependencyUpdate` targets `BuildCompiler` or `CompilerApiProvider`.
- **CTA inventory**:
  - `TriageRecord`: Correct (diagnosis-correction).
  - `BuildCompiler`: Adopt, AssertVersion, ProveEmitParity (typescript-7-build-adoption).
  - `CompilerApiProvider`: Provide (typescript-7-build-adoption).
  - `DependencyUpdate`: Supersede, KeepCurrent (typescript-7-build-adoption).
- **Attribute priority**: `BuildCompiler.version` (must), `CompilerApiProvider.version` (must), `TriageRecord.checkThatDecides` (must).
- **Entity-Feature Matrix**:

| Object | diagnosis-correction | typescript-7-build-adoption |
|---|---|---|
| TriageRecord | 1 | — |
| BuildCompiler | — | 3 |
| CompilerApiProvider | — | 1 |
| DependencyUpdate | — | 2 |

## 10. Requirements

### 10.1 Diagnosis correction {#feature-diagnosis-correction}

**REQ-REC-001** (TriageRecord · Correct · event-driven · origin `user-stated` — the owner ratified this gap's finding "the existing diagnosis is wrong" as a defect, `src-dispatch`)
When a triage record of this repository explains why a TypeScript-major Dependabot PR is blocked, the record shall state that the TypeScript 7 `typescript` package exposes no JavaScript compiler API (its `.` export is `./lib/version.cjs`, exporting only `version` and `versionMajorMinor`), so a widened `ts-jest` peer range alone does not make the PR mergeable.
- AC: Given `.claude/memory/dependabot-triage-stale-base.md` and `.claude/memory/MEMORY.md`, When they are read, Then neither says PR #266 becomes mergeable once `ts-jest` widens its peer range, and the dependabot note states the compiler-API fact with the command that shows it, BUT NOT by deleting the note's other, still-valid triage guidance (stale-base classification, lockfile-supersede behaviour).

**REQ-REC-002** (TriageRecord · Correct · ubiquitous · origin `AI-inferred-expansion`)
The corrected triage record shall name the check that decides whether TypeScript 7 support is available to a tool: whether the tool runs against that TypeScript release installed without an alias (for this repository: the `ts-jest` unit suites and `npm run lint` pass in a scratch copy). A widened peer range or a release note is a signal to re-run the check, never the decision.
- AC: Given the corrected note, When a reader looks for the pre-merge check for a TypeScript-major PR, Then it names a check that would report "unsupported" for `typescript@7.0.2` today, BUT NOT `npm view ts-jest@latest peerDependencies.typescript` as the decision, alone or as the first step.

**REQ-REC-003** (TriageRecord · Correct · event-driven · origin `council-added`)
When the corrected diagnosis is recorded in the repository and the owner has confirmed a public comment (Q3), PR #266 shall carry a comment that supersedes the 2026-08-07 and 2026-10-27 diagnosis, quotes the evidence of REQ-REC-001, and points to the adoption work. If the owner declines or has not answered, the correction records that and a tracked follow-up item holds the comment.
- AC: Given PR #266, When the comment the correction posted is read, Then it states the compiler-API fact and links the adoption issue, BUT NOT by editing or deleting the earlier comments (the history stays readable).

### 10.2 TypeScript 7 build adoption {#feature-typescript-7-build-adoption}

**REQ-TC-001** (BuildCompiler · Adopt · ubiquitous · origin `council-added`)
The project shall compile its published `lib/` with TypeScript 7.x.
- AC: Given a clean checkout and `npm ci`, When `npm run build` runs, Then the compiler that produced `lib/` reports a version whose major is 7, BUT NOT a TypeScript 6 compiler reached through `node_modules/.bin/tsc`.

**REQ-TC-002** (BuildCompiler · AssertVersion · unwanted-behaviour · origin `AI-inferred-expansion`)
If the compiler that the build invokes is not TypeScript major 7, then the build shall fail with a message naming the version it found.
- AC: Given the build pointed at a TypeScript 6 compiler, When `npm run build` runs, Then it exits non-zero and prints the found version, BUT NOT exit 0 with a warning.

**REQ-TC-003** (CompilerApiProvider · Provide · ubiquitous · origin `council-added`)
While the test transform and the linter require the TypeScript JavaScript compiler API, the project shall provide them a TypeScript 6 compiler API so that `npm test` and `npm run lint` keep running.
- AC: Given the adoption change, When `npm ci`, `npm run lint` and `npm test` run in CI, Then `npm ci` reports no ERESOLVE, lint exits 0, and every test that passed on `main` at the adoption's base passes, BUT NOT by passing `--legacy-peer-deps` or `--force` to npm.

**REQ-TC-004** (BuildCompiler · ProveEmitParity · event-driven · origin `AI-inferred-expansion`)
When the build compiler changes major version, the change shall show that the emitted `lib/` (JavaScript and `.d.ts`) is identical to the previous compiler's output, or list and justify every differing file.
- AC: Given `tsconfig.build.json` compiled once by the previous and once by the new compiler, When the outputs are compared with `diff -rq`, Then the PR records zero differences or a reviewed list of them, BUT NOT an unrecorded comparison.

**REQ-TC-005** (BuildCompiler · AssertVersion · ubiquitous · origin `council-added`)
CI shall type-check the sources and the tests with TypeScript 7 (`tsc --noEmit` over `tsconfig.json`).
- AC: Given a PR, When CI runs, Then a step type-checks `tsconfig.json` with the TypeScript 7 compiler and fails the job on a type error, BUT NOT relying only on `ts-jest`'s TypeScript-6 type-check of the tests.

**REQ-DEP-001** (DependencyUpdate · KeepCurrent · ubiquitous · origin `AI-inferred-expansion`)
The dependency-update configuration shall keep both the TypeScript 7 compiler and the TypeScript 6 API provider receiving update PRs that can merge.
- AC: Given the adoption merged, When the next Dependabot npm run happens, Then an available update to either package yields a PR whose CI can pass, or the design's documented fallback route covers it, BUT NOT a Dependabot PR that replaces the `typescript` alias with `typescript@7` (which would re-create #266).

**REQ-DEP-002** (DependencyUpdate · Supersede · event-driven · origin `council-added`)
When the adoption change merges, PR #266 shall be closed as superseded by it.
- AC: Given the adoption PR merged, When #266 is read, Then it is closed with a comment naming the superseding PR, BUT NOT merged.

**REQ-DOC-001** (CompilerApiProvider · Provide · ubiquitous · origin `AI-inferred-expansion`)
The project instructions shall explain why two TypeScript packages are installed and what retires the TypeScript 6 one.
- AC: Given `CLAUDE.md` (Dependencies or Testing) and `CONTRIBUTING.md`, When read, Then they state that the build uses TypeScript 7 and `ts-jest` / `ts-standard` use `@typescript/typescript6`, and name the retirement trigger, BUT NOT by changing the documented commands `npm run build`, `npm test`, `npm run lint`.

## 11. State Matrices

N/A — this PRD specifies no data-driven view; every object is a file, a package or a PR.

## 12. Assumption Registry

| ID | Assumption | Type | Confidence | Evidence | Validation plan | Risk if wrong |
|---|---|---|---|---|---|---|
| A1 | `@typescript/typescript6` is the TypeScript team's supported way to keep the TS 6 API beside TS 7 | technical | green | same npm maintainers as `typescript`; repository `microsoft/TypeScript`; `ts-jest`'s own error names it | — | tool breakage on a future update |
| A2 | The spike's results (build, two unit suites, lint, emit parity) hold for the full suite in CI on Ubuntu and Windows | technical | yellow | spike ran on macOS with unit suites only; integration suites need Chrome | the adoption PR's CI run (build job and the integration matrix) | a platform-specific failure found late |
| A3 | Dependabot updates npm-aliased devDependencies | technical | red | unverified | observe Dependabot's first weekly run after the adoption merges, or an alias-specific statement in GitHub's Dependabot documentation (#337) | both TypeScript copies freeze silently |
| A4 | No consumer depends on which compiler built `lib/` | product | green | emit diff of 0 files (spike) | REQ-TC-004 re-checks at implementation | consumer-visible change |
| A5 | The owner wants TypeScript 7 adopted now rather than staying on 6 until the tools support 7 | product | yellow | the owner ratified the finding as a defect; the panel kept #266 open; adoption itself is council-proposed | owner ratification of decision D1 (see § 16 note) | work done the owner would not have chosen |

## 13. Feature Completeness

| Feature | Requirement IDs | Object sections | Entity coverage | CTA coverage | Specification depth | Open questions | Verdict |
|---|---|---|---|---|---|---|---|
| diagnosis-correction | REQ-REC-001..003 | TriageRecord | 1/1 | 1/1 | 3/3 | 1 (Q3) | NEAR-COMPLETE |
| typescript-7-build-adoption | REQ-TC-001..005, REQ-DEP-001..002, REQ-DOC-001 | BuildCompiler, CompilerApiProvider, DependencyUpdate | 3/3 | 6/6 | 8/8 | 2 (Q1, Q2) | NEAR-COMPLETE |

Gap documentation: diagnosis-correction is open on Q3 only; typescript-7-build-adoption is open on Q1 (Dependabot alias behaviour, assumption A3 red) and Q2 (package name, a design decision).

## 14. Source Traceability

| Req ID | Source | Object | CTA | Feature | Layer | Confidence |
|---|---|---|---|---|---|---|
| REQ-REC-001 | src-dispatch; src-synthesis "The existing diagnosis is wrong"; src-spike `npm view typescript@7.0.2 exports` | TriageRecord | Correct | diagnosis-correction | behaviour | high |
| REQ-REC-002 | src-spike; inferred from the record's own "check `npm view ts-jest@latest …`" line | TriageRecord | Correct | diagnosis-correction | behaviour | high |
| REQ-REC-003 | src-e7 (#266 comments); dispatch note "Correcting that note and the PR comment is work your items may scope" | TriageRecord | Correct | diagnosis-correction | behaviour | medium |
| REQ-TC-001 | src-synthesis "keep `tsc` 7 for the build" | BuildCompiler | Adopt | typescript-7-build-adoption | behaviour | high |
| REQ-TC-002 | src-spike `.bin/tsc` → `@typescript/old/bin/tsc` | BuildCompiler | AssertVersion | typescript-7-build-adoption | constraint | high |
| REQ-TC-003 | src-synthesis "or use `@typescript/typescript6`"; src-spike alias run | CompilerApiProvider | Provide | typescript-7-build-adoption | behaviour | high |
| REQ-TC-004 | src-spike emit diff | BuildCompiler | ProveEmitParity | typescript-7-build-adoption | quality | high |
| REQ-TC-005 | src-synthesis "plus a CI `tsc --noEmit`" | BuildCompiler | AssertVersion | typescript-7-build-adoption | behaviour | high |
| REQ-DEP-001 | inferred from `.github/dependabot.yml` (npm weekly, no ignore rules) | DependencyUpdate | KeepCurrent | typescript-7-build-adoption | behaviour | medium |
| REQ-DEP-002 | src-e7; precedent #228 → #260 | DependencyUpdate | Supersede | typescript-7-build-adoption | behaviour | high |
| REQ-DOC-001 | inferred from CLAUDE.md "Testing — Framework: Jest with ts-jest" | CompilerApiProvider | Provide | typescript-7-build-adoption | constraint | medium |

### 14b. Cross-Repository References
| PRD Req | Implementation repo | Spec or item | Status |
|---|---|---|---|
| #335, #336, #337 | alexey-pelykh/puppeteer-capture | work items created at `/scope` Stage 3 | — |

## 15. Cross-Cutting and Non-Functional Concerns

### 15.1 Security
The change adds one devDependency publisher identity: `@typescript/typescript6`, published by the same npm maintainers as `typescript`. It ships nothing to consumers (devDependencies only; runtime dependencies stay `async-mutex`, `fluent-ffmpeg`, `which`, optional `ffmpeg-static`). No new secret, permission or workflow token.

### 15.2 Compliance and Regulatory
N/A — license unchanged: both TypeScript packages are Apache-2.0 devDependencies, not redistributed in the npm tarball (`files`: `lib/**/*`, `LICENSE`, `README.md`).

### 15.3 Reliability and Observability
REQ-TC-002 makes a wrong compiler a hard build failure; REQ-TC-005 surfaces type errors under TypeScript 7 in CI. The CI log carries the compiler version (success criterion L2).

### 15.4 Performance and Scalability
N/A — TypeScript 7's native compiler is expected to be faster; build time is not a requirement here.

### 15.5 Operational
The publish workflow runs `npm run lint` and `npm run test` before publishing, and `prepare` runs `npm run build`: REQ-TC-001..003 must hold there too, which they do because the workflow runs the same npm scripts.

### 15.6 Lifecycle
The `@typescript/typescript6` alias is temporary by design; § 3 records its retirement trigger and REQ-DOC-001 makes it visible to maintainers. `ts-standard` / `eslint@8` end-of-life is recorded as a deferral with its trigger.

## 16. Change Log

| Version | Date | Change | Rationale | Impact |
|---|---|---|---|---|
| 1.0 | 2026-11-14 | Created by `/scope` Stage 1 (`/capture-requirements`, autonomous) | council gap gap-typescript-7-blocked, owner-confirmed corrective route | new PRD |
| 1.1 | 2026-11-14 | `/scope` Stage 3.7 amendments: § 4 Dependabot decision gate and A3 moved after merge (matches design D4 / OQ-2); § 2 current state marks the old diagnosis wrong; REQ-REC-002 restated as a run-based check; Q1 and § 14b updated; REQ-REC-003 made conditional on the owner's Q3 answer; L1 meter limited to tracked `.claude/memory/` files | Coverage Quality Gate findings | REQ-REC-002 wording; REQ-REC-003 condition; A3 timing |

**Readiness note (`dor_status: failed`)**: checks 1–5 pass (problem statement § 2, out-of-scope § 3, leading + lagging indicators and decision gates § 4, every § 15 subsection filled or `N/A — {rationale}`, a verdict per feature in § 13 with its gap documented). Check 6 fails: REQ-REC-002, REQ-REC-003, REQ-TC-001..005, REQ-DEP-001..002 and REQ-DOC-001 are pipeline-authored (`council-added` or `AI-inferred-expansion`) and await the owner's one-at-a-time ratification; this run was autonomous, so nobody could ratify them. Re-run the readiness gate after ratification. Ratification-pending decisions: the reframing in § 2; the appetite in § 3; D1 — adopt TypeScript 7 now through the `@typescript/typescript6` alias rather than staying on TypeScript 6 or switching the Jest transform (assumption A5); the deferrals in § 3.
