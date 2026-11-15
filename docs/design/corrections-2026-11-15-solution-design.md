# Solution Design: 2026-11-15 Corrections (capture-hang premise, error name, CI Node lines, scope-doc claim audit)

**Created**: 2026-11-15
**PRD**: [`docs/requirements/corrections-2026-11-15-prd.md`](../requirements/corrections-2026-11-15-prd.md) (`dor_status: failed` — DoR check 6 only: all fifteen requirements are pipeline-authored and await owner ratification)
**Baseline**: `482eed3` (on `origin/main`), 2026-11-15
**Mode**: autonomous (no person present). Every decision below is an author-chosen default awaiting the owner's
ratification unless it says otherwise. The design was put to the two ratification lenses (§ 17).

Tracks run: Technical Architecture, Infrastructure (CI pipeline only), Security Architecture (disclosure only),
Testing Architecture. Not run, with the signal absent: Data Architecture (no persistent data), UX/IA, UX Prototype and
UI/Visual (no interface), API Design (no API change on the recommended route; § 12 D-2), Performance Architecture (no
latency target), Integration (no external system).

## 1. Goals and Drivers

- G1: the five capture-hang documents state the `protocolTimeout` bound and, per public call, which waits stay
  endless and why, each with a citation (REQ-001, REQ-002); #339–#342 each carry one linking comment (REQ-003).
- G2: the README, the export and `err.name` of the missing-arguments error agree, held by a test (REQ-010, REQ-011).
- G3: CI tests Node 22, 24 and 26, each named explicitly, and `CLAUDE.md` says so (REQ-020–REQ-022).
- G4: one audit record lists every CI, runtime and tooling claim in the six 2026-11-14 sets with source and
  verdict, and every false claim is corrected, tracked or held (REQ-030–REQ-035).
- Driver: the owner's pending capture-hang decisions (watchdog default and off-switch, release type, #341
  priority) rest on the premise G1 corrects. The design supplies facts to those decisions; it decides none of them.

## 1b. Non-Goals

- Any change to capture behaviour, timeouts, the watchdog (#340), the deadlock fix (#339) or `stop()` (#341).
- Any answer to a pending owner decision: watchdog default and off-switch, option and error names, `stop()` after a
  stall, release type, #341 priority, `waitForTimeout()` on stop, #332, #335, #338, #347.
- Editing existing issue bodies, titles, labels or states.
- Correcting `docs/design/typescript-7-adoption-solution-design.md:25` (held by the owner behind #335).
- Changing which puppeteer versions CI tests, or touching any workflow other than `.github/workflows/ci.yml`.

## 2. Constraints

- `/scope` writes planning documents only; every change here is executed later by `/do` in a pull request.
- The repository is public and `SECURITY.md` forbids public disclosure of vulnerabilities (REQ-034).
- Commit messages `(type) description`, no issue numbers; `Closes #N` in PR bodies (project `CLAUDE.md`).
- The CI matrix keeps one `puppeteer-version` entry per (major, minor) (project `CLAUDE.md`, bump procedure).
- Required checks on `main` are being reworked by #333/#334; a new `build` cell adds a check context but must not
  be made required here.

## 3. Context and Scope

Four independent changes, each one pull request:

| Change | Files touched | External systems |
|---|---|---|
| C1 premise correction | the five capture-hang documents | GitHub Issues (four comments) |
| C2 error name | `README.md`, one unit test file (`src/*.unit.test.ts`); `CHANGELOG.md` only on the code-change route | none |
| C3 Node lines | `.github/workflows/ci.yml`, `CLAUDE.md` | GitHub Actions, `actions/setup-node` |
| C4 claim audit | one new audit record; line corrections in free sets; new issues for claims in held or pending sets | GitHub Issues |

C1 and C4 both read the capture-hang set; C4 references C1 for that set (REQ-035) and edits none of its files.

## 4. Solution Strategy

### C1 — premise correction

1. Confirm the bound before writing it (assumption A-1): trace `CDPSession.send` → `Connection._rawSend` →
   `CallbackRegistry.create` at `puppeteer-core@24.3.1` and `25.17.0`, and confirm `frame.evaluate` takes the same
   path (Runtime domain over the page session). Record the `file:line` at each version.
2. Write one shared paragraph. It states: puppeteer-core rejects each CDP call after `protocolTimeout`,
   180 000 ms by default at every puppeteer version in the CI matrix (24.3.1 … 25.17.0), and arms no timer when the
   caller sets `0`; this library sets none, and `launch()` passes the caller's value through. It states which waits
   that bounds and which it does not, per the bound table: a mid-capture `waitForTimeout()` and a caller's `stop()`
   end about 180 s after the stalled call, while `start()` on a stalled first frame stays endless at any setting,
   because of the start/stop lock (#339), not because the frame request is unbounded. It also states that the bound
   is longer than the 30 000 ms Jest `testTimeout` (`jest.config.js`), so the two CI stalls (2026-09-19 and
   2026-11-14) ended at the test timeout before any protocol rejection, and their evidence stands unchanged.
3. Build the premise inventory before editing anything, by reading, not by search. A text search shows where a word
   occurs, never whether a sentence claims a wait is endless, so a search is only the seed. Record the commit the
   inventory was taken at, because line numbers move as the files are edited.
   a. Seed: run `grep -n -i -E 'forever|unbounded|never (settle|answer|resolve)|without end|nothing bounds|indefinite|no bound|hang|hung|waits? until|bounded only'`
      over the five files.
   b. Read in full, sentence by sentence, every problem, motivation, use-case, decision, risk, assumption and
      requirement section of the five files and the feature file's descriptions, and add every sentence that says or implies
      how long a call waits after a stall, whatever its wording.
   c. Give each sentence one of five kinds:
      - **bounded-call claim** — it says `waitForTimeout()`, `stop()` or a CDP call (setup, frame or cleanup)
        against real Chrome waits without end, where the bound table says the default `protocolTimeout` ends it;
      - **wrong-reason claim** — its conclusion holds but its reason does not, such as "`start()` waits forever
        because nothing bounds a frame request" (the wait is endless because of the lock);
      - **true unbounded wait** — it names a wait the table calls endless at the default: `start()` on a stalled
        first frame, including the default `waitForFirstFrame: true` path and measures of the two CI stalls; a
        `waitForTimeout()` pending when any stop ends the capture with no recorded frame failure (the caller's
        `stop()`, or a page close, disconnect or ffmpeg error, per the capture-hang design's R6 and DD-10); and
        `_stop`'s wait on ffmpeg's exit;
      - **fixture statement** — it describes a mocked session or a scenario precondition ("a session that never
        answers"), which no `protocolTimeout` reaches;
      - **exclusion clause** — a `BUT NOT` clause or a "not" outcome the fix must avoid, which claims nothing about
        current behaviour.
   d. Treat them so. True unbounded waits, fixture statements and exclusion clauses stay unchanged. A bounded-call
      or wrong-reason claim in prose that is not requirement, decision, AC, measure, assumption or risk text (the
      last two are protected beyond what REQ-004 asks, deliberately: they record what was believed and why) is
      reworded to carry the bound and links the bound table row. A bounded-call or wrong-reason claim inside such
      text (REQ-004) keeps its line byte-identical, and a note goes on its own line directly after the line, the
      table or the Gherkin step that holds it. The note names its call and its row:
      - for `waitForTimeout()`: "Note (2026-11-15 correction): with the default `protocolTimeout`, this call
        rejects about 180 000 ms after the stalled CDP call, and waits without end only with `protocolTimeout: 0`.
        See the bound table, row 2.";
      - for `stop()`: the same, with "settles" for "rejects" and row 3;
      - for a setup CDP call of `start()` (DD-11): the same, with "this CDP call rejects after `protocolTimeout`,
        and `start()` rejects with that protocol error", and row 4;
      - for a cleanup CDP call: the same, with "this CDP call rejects after `protocolTimeout`", and row 3;
      - for a wrong-reason `start()` claim: "Note (2026-11-15 correction): when `protocolTimeout` is not `0`, the
        stalled CDP call rejects after it, but `start()` still waits without end, because of the start/stop lock (#339). See the
        bound table, row 1."
      A note states the bound and nothing else: where the sentence carries a pending decision (the release type,
      #341's priority, the watchdog default), the note does not say what the decision should become, and the
      decision's bearing goes into the open-question row of step 5 instead.
   e. The inventory is committed as an appendix of `docs/design/capture-hang-solution-design.md`, beside the
      bound table, and copied into the PR body: each sentence's `file:line` at the recorded commit, its kind, its
      treatment and, for a note, the note's text. The seed's `hang` term also matches every `capture-hang` file
      name; drop hits whose only match is that name.
   Candidate lines at `482eed3`, an incomplete seed and unclassified (the executor classifies every one): scope
   brief `:12`, `:45`, `:48`, `:49`; design brief `:13`, `:27`, `:28`; PRD `:52`, `:56`, `:67`, `:80`, `:125`,
   `:128`, `:223`, `:308`, `:318`, `:321`, `:345`, `:346`, `:433`, `:484`, `:507`, `:510`, `:593`, `:621`, `:623`;
   solution design `:117`, `:177`, `:220`, `:226`, `:363`, `:406`, `:580`, `:581`, `:650`; feature file `:29`,
   `:130`, `:131`, `:278`, `:420`, `:434`.
4. Add the bound table (below) to the solution design, with citations, and link it from the other four files at
   each reworded or annotated line.
5. Leave every requirement ID, decision ID, AC, option name, error name and numeric default untouched (REQ-004).
   Append to the capture-hang PRD § 8 and design § 14 one open-question row per pending decision the premise bears
   on, naming the decision (this PRD's OQ-1 to OQ-4).
6. After merge, post one comment on each of #339–#342 (REQ-003). Each comment quotes the body sentences it
   overrides (for #340, its opening "A frame capture can wait forever. Nothing bounds the wait…"), states the bound
   in two sentences and links the bound table at the merge commit. No body edit. Whether the owner also wants a
   one-line notice at the top of each body is open question Q-9; until it is answered, comments only.

The bound table C1 writes (statements to confirm against source, § 2 Evidence of the PRD; the executor corrects any
cell its trace contradicts):

| Call | Default `protocolTimeout` (180 000 ms) | `protocolTimeout: 0` |
|---|---|---|
| `start()` with `waitForFirstFrame: true`, first frame stalls | endless: the failure path awaits `stop()`, which waits for the start/stop lock `start()` holds (`PuppeteerCaptureBase.ts:135-137`, `:244-258`, `:269`, `:380-383`) | endless: no rejection ever arrives (`CallbackRegistry.ts:147` at 25.17.0, `:133` at 24.3.1: the timer is armed only `if (timeout)`) |
| `waitForTimeout()`, a frame stalls mid-capture | rejects about 180 s after the stalled call, once the failure path's `stop()` has run (`:333-352`, `:380-383`) | endless (same citation) |
| `stop()` by the caller while a frame is stalled | settles about 180 s after the stalled call, when the drain's awaited request rejects (`:282-283`, `PuppeteerCaptureViaHeadlessExperimental.ts:181-185`); cleanup CDP calls are bounded the same way | endless (same citation) |
| `start()`, a setup call stalls (the injector and `activate()` evaluates, `HeadlessExperimental.enable`; DD-11) | rejects about 180 s after the stalled call with that protocol error, which `onPostCaptureStarted` propagates out of `_start` and so out of the lock (`PuppeteerCaptureBase.ts:242`, `PuppeteerCaptureViaHeadlessExperimental.ts:192-204`) | endless (same citation) |

The 180 000 ms default is `Connection.ts:69` at 25.17.0 and `:54` at 24.3.1 (`this.#timeout = timeout ?? 180_000;`).

Plus the wait that no `protocolTimeout` setting bounds, already in the capture-hang design (R6, DD-10): a
`waitForTimeout()` pending when a stop ends the capture with no recorded frame failure; and `_stop`'s wait on ffmpeg's exit
(`PuppeteerCaptureBase.ts:301-305`), which is not a CDP call.

### C2 — error name

Recommended route (D-2): documentation plus a test, no API change. The README § Error Classes entry names the
import (`MissingRequiredArgs`) and states that `err.name` is `MissingHeadlessExperimentalRequiredArgs`, and says
to match with `instanceof`. The neighbouring `NotChromeHeadlessShell` entry states its `err.name` too
(`NotChromeHeadlessShell`, from `this.name = this.constructor.name`), so the section treats both errors alike. The
README text describes these two errors only and sets no naming rule: the pending capture-hang error-name decision
(#342) inherits nothing from it. A unit test triggers `validateBrowserArgs` with a browser whose `spawnargs` lack
`--enable-begin-frame-control` (a required argument #352 keeps), and asserts `instanceof MissingRequiredArgs` and
`err.name === 'MissingHeadlessExperimentalRequiredArgs'` — the exact string the README states. No `CHANGELOG.md` `### Changed` entry, because nothing public changes (REQ-011
does not fire); a `### Fixed` line for the README is optional. If the owner instead picks a code route (§ 12b), REQ-011
fires.

### C3 — Node lines

Recommended route (D-3): `build` matrix `node-version: [lts/jod, lts/krypton]` (adds two cells, one per OS), and the
`integration` job's `node-version: lts/*` becomes the explicit major `26`. Result: Node 22 and 24 tested by `build`
(lint, unit and browser tests at the pinned puppeteer), Node 26 by every integration cell. `CLAUDE.md` § Testing "CI
matrix" lists the three. The two new `build (…, lts/krypton)` contexts are not made required (that is #333/#334).

### C4 — claim audit

C4 runs as six items, one per set (§ 12, D-5). The Stage 3 granularity evaluation split it by set: the six sets
together hold more claims than one reviewable change can carry, and each set can be audited on its own. A set is
exactly the files its 2026-11-14 scope commit added (`git show --name-only --format= {commit}`):

| Set | Scope commit | Pending item that freezes its text |
|---|---|---|
| deepmerge-alert | `d45a98b` | #332 |
| phantom-required-checks | `b1206f7` | none |
| minimatch-alert | `f5fb700` | #338 |
| typescript-7-blocked | `425ccb0` | #335, and the owner's hold on the TypeScript 7 doc line |
| bump-invariants-unchecked | `36aa730` | #347 |
| capture-hang | `482eed3` | the pending capture-hang decisions (#339–#342) |

**The record.** Each set's record is its own file, `docs/audits/{set}-claims-audit.md` (the repository has no
`docs/audits/` yet; one file per set lets the six items merge in any order without conflicts). Its header carries:
the set name, the set's scope commit, the audit baseline (`git rev-parse --short HEAD` and
`date -u +%Y-%m-%dT%H:%M:%SZ` at the start of the audit), the extraction command and its hit count, the versions
checked, and one sentence saying any security-relevant finding was routed per `SECURITY.md`. Each row carries
eight fields:

| Field | Content |
|---|---|
| `#` | row number |
| `file:line` | where the claim sits, at the set's scope commit |
| claim | the sentence, quoted |
| kind | `CI`, `runtime` or `tooling` |
| source checked | a `file:line` at a named revision, a command with the line it printed, or a vendor document with its version or retrieval date |
| version checked | the version or versions the source was read at (REQ-033), or `n/a` |
| verdict | `holds`, `false` or `unverifiable` |
| routing | `—` for `holds`; see step 5 for the others |

1. Pin the audit baseline and record it in the record's header.
2. In the set, walk every file and extract each sentence that asserts how CI, a runtime (Node,
   Chrome, puppeteer) or a tool (npm, Jest, ts-jest, TypeScript, Dependabot, GitHub Actions, `gh`) behaves. A
   decision, a recommendation or a requirement is not a claim; a statement of current behaviour it rests on is.
3. Check each claim at its source: repository files at the baseline, a command run with its printed line, or a
   vendor document with version or retrieval date. Version-dependent claims are checked at the version the subject
   uses and at the oldest supported (REQ-033) — for puppeteer, `24.3.1` and the current pin.
4. Verdict per row: `holds`, `false` or `unverifiable` (with the reason, and the check that would settle it).
5. Route each row that is not `holds` (D-4). The set table above decides, so the executor never judges which set
   is free:
   - **phantom-required-checks** (no pending item): correct a `false` line in the audit's own PR; its routing
     reads `corrected in PR #N`, the audit PR's own number, which exists once the PR is opened.
   - **The other five sets**: leave every document unchanged (REQ-032). File one new issue per `false` claim that
     quotes it and links the pending item (`Related: #N`); its routing names that issue.
   - **By reference, no new item** (REQ-035): a capture-hang premise row names the premise item only where that
     item's committed inventory lists the line (so the capture-hang audit runs after the premise item merges); a premise claim the inventory lacks is a `false` row of a frozen set,
     and gets its own new issue that links the premise item. The TypeScript 7
     doc line (`docs/design/typescript-7-adoption-solution-design.md:25`) reads `held: the owner's TypeScript 7
     call (#335)`.
   - **`unverifiable`**: where an open issue's acceptance criteria or specification rest on the claim, file one
     issue per such row (`Related:` that issue) and name it; otherwise the routing reads `recorded`.
6. Leave out of the record and of every issue the audit files, whatever the verdict, each claim about a GitHub Actions workflow other than `.github/workflows/ci.yml` and each claim whose correction would describe a security weakness; route them privately per `SECURITY.md` (REQ-034).
7. Circuit breaker (PRD § 3): if a set needs rework beyond line corrections, or its claims outgrow one reviewable
   record, stop and report rather than widen the item.

## 5. Building Blocks

| Component | Kind | Change | Requirements |
|---|---|---|---|
| CB-1 bound paragraph | document text | C1 | REQ-001 |
| CB-2 bound table | document table in `docs/design/capture-hang-solution-design.md` | C1 | REQ-002 |
| CB-3 pending-decision open-question rows | document rows in capture-hang PRD § 8 and design § 14 | C1 | REQ-004 |
| CB-4 issue comments | four GitHub comments (#339–#342) | C1 | REQ-003 |
| CB-5 README error entry | `README.md` § Error Classes | C2 | REQ-010 |
| CB-6 error-name unit test | test case in a `*.unit.test.ts` file | C2 | REQ-010 |
| CB-7 CHANGELOG entry | `CHANGELOG.md` `[Unreleased]` (code route only) | C2 | REQ-011 |
| CB-8 build matrix line | `ci.yml` `build.strategy.matrix.node-version` | C3 | REQ-020 |
| CB-9 integration Node pin | `ci.yml` `integration` setup-node `node-version` | C3 | REQ-020, REQ-021 |
| CB-10 CLAUDE.md CI matrix entry | `CLAUDE.md` § Testing | C3 | REQ-022 |
| CB-11 audit records | six committed documents, `docs/audits/{set}-claims-audit.md`, one per set | C4 | REQ-030, REQ-033, REQ-034, REQ-035 |
| CB-12 false-claim routing | line corrections and new issues | C4 | REQ-031, REQ-032 |

No entity model: no persistent data.

## 6. Runtime View

### 6b System interactions

- C3 at runtime: a pull request triggers `ci`; `build` now runs four cells (2 OS × 2 Node lines), `integration` runs
  118 cells on Node 26. `actions/setup-node` resolves `lts/krypton` to the newest 24.x and `26` to the newest 26.x.
- C1 and C4 have no runtime; their only interaction is `gh issue comment` (C1) and `gh issue create` (C4).

## 11. Crosscutting Concepts

### Security
- REQ-034: C4's executor keeps security-relevant claims out of the audit record and the new issues, and reports them
  through the private channel `SECURITY.md` names. The record carries one sentence saying such findings were routed
  that way, and nothing more.
- C3 adds no permission, secret or trigger; the workflow keeps `contents: read`. Actions stay pinned by SHA.

### Observability
- C3: each `build` and `integration` cell already prints its Node version in the setup-node step; L3 reads it.

### Error handling
- C2 keeps `instanceof` as the documented way to match the error, which is stable across both names.

### Master test plan (Testing Architecture)

Scope: four changes; three are documentation or configuration whose verification is a command with an expected
output, one adds a unit test.

| Capability | Risk | Verification | Level | Bound to |
|---|---|---|---|---|
| CAP-PREMISE | the false premise survives in a capture-hang file, or a sentence contradicts the bound table with nothing saying which wins | over the five capture-hang files only: `grep -c protocolTimeout` ≥ 1 per file and `grep -n 'nothing bounds a frame request'` empty; then a reviewer in a fresh context, given the five changed files, the bound table and the inventory, reads the files in full and lists any sentence about how long a call waits after a stall that the inventory lacks or misclassifies, and any note that contradicts the table (the check fails on any listed sentence); every protected line byte-identical (`git diff` shows notes only as added lines); the 2026-09-19 and 2026-11-14 CI stalls still described | document check, independent review | REQ-001, REQ-002, REQ-004 |
| CAP-BOUND-TABLE | a bound statement is wrong or uncited | review: eight cells (four rows × two settings), each with `file:line` at a named revision, the `protocolTimeout: 0` cells included; the A-1 trace recorded | review | REQ-002 |
| CAP-NO-DECISION | the correction answers a pending decision | review of the diff: no REQ/DD/AC/option/error/default line changed; OQ rows added | review | REQ-004 |
| CAP-COMMENTS | issues not told, or edited instead | `gh issue view {N} --json body,comments` for 339–342: body unchanged, one comment each, quoting the body sentences it overrides | tracker check | REQ-003 |
| CAP-ERRNAME | README and `err.name` disagree | new unit test (Jest, `npm run test`) | unit | REQ-010 |
| CAP-CHANGELOG | API change unlogged | `CHANGELOG.md` read, code route only | document check | REQ-011 |
| CAP-NODE-LINES | a supported line untested | CI log of the PR run: `v22.`, `v24.`, `v26.` present | CI observation | REQ-020 |
| CAP-NO-ALIAS | a moving alias returns | `grep -n "node-version" -A3 .github/workflows/ci.yml` shows no `lts/*`, `latest`, `current` | config check | REQ-021 |
| CAP-CLAUDE-MD | instructions stale | `CLAUDE.md` § Testing names three lines | document check | REQ-022 |
| CAP-AUDIT-SHAPE | a claim row lacks a source or verdict | review: per set, the header fields and the eight row fields of § 4 C4 | review | REQ-030, REQ-033 |
| CAP-AUDIT-ROUTING | a false claim left untracked | every `false` row names `corrected in PR #N`, an issue, the premise item or the hold; every `unverifiable` row names an issue or `recorded` | review | REQ-031, REQ-035 |
| CAP-AUDIT-NO-EDIT | a held/pending document edited | `git diff --stat {base}...HEAD` of each audit PR: only `docs/audits/{set}-claims-audit.md`, plus, for phantom-required-checks alone, lines of that set's files | config check | REQ-032 |
| CAP-DISCLOSURE | a security finding in public | review of the record and new issues | review | REQ-034 |

Quality gates: C2 and C3 pass `npm run lint` and `npm run test` in CI; C1 and C4 pass their document checks and a
review. No AI component: the plan's AI/LLM section is N/A.

## 12. Architecture Decisions

| ID | Decision | Alternatives | Why | Status |
|---|---|---|---|---|
| D-1 | C1 adds a paragraph and a bound table and changes no requirement or decision text | rewrite the capture-hang requirements around the corrected premise | rewriting would answer the pending watchdog, release-type and #341 decisions (REQ-004) | author-chosen default, ratification pending |
| D-2 | C2 by documentation plus a test, no API change | (b) set `this.name = 'MissingRequiredArgs'`; (c) also export the class under its own name | (b) changes a public value callers may match; (c) widens the API surface for a naming fix; the doc route fixes the reader's problem with no compatibility cost | author-chosen default, ratification pending (PRD OQ-5) |
| D-3 | C3 adds `lts/krypton` to `build` and pins `integration` to `26` | (b) add Node 24 to `integration` (doubles 118 cells); (c) a separate single-OS Node 24 job; (d) keep `lts/*` and add `lts/krypton` to `build` | (b) costs 118 cells; (c) adds a job and a context for the same coverage as two build cells; (d) leaves a moving alias, which is how Node 24 dropped out unseen (REQ-021) | author-chosen default, ratification pending |
| D-4 | C4 corrects false claims in place only in phantom-required-checks, the one set no pending item freezes, and files one issue per false claim in the other five | (b) file an issue for every false claim; (c) correct everything in place; (d) decide per line whether a pending decision covers it | (b) multiplies items for one-line fixes; (c) breaks REQ-032; (d) leaves the executor to judge what the owner's pending calls cover, which is the judgment REQ-032 exists to withhold | author-chosen default, ratification pending (PRD OQ-6, OQ-7) |
| D-5 | C4 runs as six items, one per set, each writing its own record `docs/audits/{set}-claims-audit.md` | (b) one item and one record with a section per set; (c) one issue comment per set | (b) exceeds one reviewable change, and six PRs appending to one file conflict; (c) a comment is not reviewable alongside the corrections and is not a dated committed snapshot (PRD § 15.6) | author-chosen default, ratification pending |

## 12b. Alternatives Considered and Drawbacks

- D-2's drawback: `err.name` keeps a name that differs from the import, so a caller who switches on `err.name` must
  use the long name. The README says so. The code routes stay open to the owner.
- D-3's drawback: pinning `26` means the integration line stays on 26 after Node 28 becomes LTS, until a commit moves
  it. That is REQ-021's intent. `build` grows from two to four cells.
- D-4's drawback: corrections in free sets ride in the audit PR, so that PR mixes a new record with edits; reviewers
  read the record's `false` rows against the diff.

## 13. Quality Requirements

| Attribute | Target | Met by |
|---|---|---|
| Claim fidelity (`FalseClaimsOpen`) | 0 false claims with no correction, item or hold at 30 days | D-4, CAP-AUDIT-ROUTING |
| CI cost | at most two added cells (PRD § 15.4) | D-3 (+2 `build` cells) |
| Compatibility | no public API change on the recommended route | D-2 |

## 14. Risks and Open Questions

### Feasibility

| Component | Verdict | Basis |
|---|---|---|
| CB-1 … CB-4 | FEASIBLE | text edits and four comments; the A-1 trace is a read of two published tarballs |
| CB-5 … CB-7 | FEASIBLE | `validateBrowserArgs` already throws the error; an existing unit test file mocks a browser for it (per the capture-hang design F-1, `src/PuppeteerCaptureViaHeadlessExperimental.unit.test.ts:14-21`) |
| CB-8 … CB-10 | FEASIBLE | `actions/setup-node` accepts LTS codenames and majors |
| CB-11, CB-12 | FEASIBLE | six sets of reading, one item each; bounded by the PRD § 3 circuit breaker |

### Risk register

| ID | Risk | L | I | Score | Mitigation |
|---|---|---|---|---|---|
| RK-1 | The A-1 trace finds a CDP call that bypasses `protocolTimeout` | 1 | 3 | 3 LOW | C1 step 1 runs the trace before writing; the table cell is corrected to what the trace shows |
| RK-2 | C1 reads as answering a pending decision | 2 | 3 | 6 MEDIUM | D-1; CAP-NO-DECISION review |
| RK-3 | C2's README edit conflicts with #352 (same README area and source file) | 2 | 1 | 2 LOW | whichever lands second rebases; no shared lines in `src/` on the recommended route |
| RK-4 | The audit's claim density is higher than one PR can carry | 2 | 2 | 4 MEDIUM | circuit breaker; Stage 3 granularity evaluation may split per set |
| RK-5 | Node 24 fails a test today | 2 | 2 | 4 MEDIUM | that is the signal C3 exists to surface; the failure becomes its own item, C3 still lands with the cell red only after the owner agrees |
| RK-6 | A security-relevant claim reaches a public record | 1 | 3 | 3 LOW | REQ-034, CAP-DISCLOSURE |

No HIGH risks. No rabbit holes: each change survives a tenfold overrun of any one part except CB-11, which the
circuit breaker bounds.

### Open questions

| ID | Question | Load-bearing for this design? |
|---|---|---|
| PRD OQ-1 … OQ-4 | watchdog default and off-switch, release type, #341 priority, `waitForTimeout()` on stop | No for this design: C1 records them as questions and needs no answer to proceed. They are load-bearing for #339–#341, not here |
| PRD OQ-5 | error route | Resolved by default D-2, ratification pending |
| PRD OQ-6, OQ-7 | audit routing | Resolved by default D-4, ratification pending |
| Q-8 | RK-5: if Node 24 fails today, land C3 with a red cell, or fix first? | Not load-bearing until observed |
| Q-9 | May the premise item add a one-line notice at the top of the #339–#342 bodies, beside its comments? | No: C1 posts comments only until the owner answers (REQ-003 as drafted) |

## 15. Glossary

| Canonical name | Definition | Aliases by track |
|---|---|---|
| capture-hang documents | the five files the capture-hang scope committed on 2026-11-14 | Technical: "capture-hang set" |
| bound table | the per-call, per-setting statement of which waits end (CB-2) | Testing: CAP-BOUND-TABLE |
| missing-arguments error | `MissingHeadlessExperimentalRequiredArgs`, exported as `MissingRequiredArgs` | none |
| tested Node line | a Node major CI runs the tests on | Infrastructure: matrix `node-version` |
| audit record | CB-11 | Testing: CAP-AUDIT-SHAPE |
| free set / held set | a scope doc set (or line) with no / with a pending owner decision or hold | none |

## 16. Requirement-to-Track Coverage Matrix

| Requirement | Tracks | Covered at | Capability | Status |
|---|---|---|---|---|
| REQ-001 | Technical | § 4 C1 steps 1–4, CB-1 | CAP-PREMISE | covered |
| REQ-002 | Technical, Testing | § 4 C1 bound table, CB-2 | CAP-BOUND-TABLE | covered |
| REQ-003 | Technical | § 4 C1 step 6, CB-4 | CAP-COMMENTS | covered |
| REQ-004 | Technical | § 4 C1 steps 3d and 5, D-1, CB-3 | CAP-NO-DECISION | covered |
| REQ-010 | Technical, Testing | § 4 C2, CB-5, CB-6 | CAP-ERRNAME | covered |
| REQ-011 | Technical | § 4 C2, CB-7 | CAP-CHANGELOG | covered (fires on the code route only) |
| REQ-020 | Infrastructure | § 4 C3, CB-8, CB-9 | CAP-NODE-LINES | covered |
| REQ-021 | Infrastructure | § 4 C3, CB-9, D-3 | CAP-NO-ALIAS | covered |
| REQ-022 | Infrastructure | § 4 C3, CB-10 | CAP-CLAUDE-MD | covered |
| REQ-030 | Technical, Testing | § 4 C4 steps 1–4, CB-11 | CAP-AUDIT-SHAPE | covered |
| REQ-031 | Technical | § 4 C4 step 5, CB-12, D-4 | CAP-AUDIT-ROUTING | covered |
| REQ-032 | Technical | § 4 C4 step 5 | CAP-AUDIT-NO-EDIT | covered |
| REQ-033 | Technical, Testing | § 4 C4 step 3 | CAP-AUDIT-SHAPE | covered |
| REQ-034 | Security | § 11 Security, § 4 C4 step 6 | CAP-DISCLOSURE | covered |
| REQ-035 | Technical | § 4 C4 step 5 | CAP-AUDIT-ROUTING | covered |

No UNCOVERED rows.

## 16b. Element-to-Requirement Backward-Coverage Matrix

No UX track ran, so there are no screens or calls to action, and no entities. The tracked elements are the building
blocks.

| Element | Type | Traces to | Provenance | Status |
|---|---|---|---|---|
| CB-1 | component | REQ-001 | § 5 | traced |
| CB-2 | component | REQ-002 | § 5 | traced |
| CB-3 | component | REQ-004 | § 5 | traced |
| CB-4 | component | REQ-003 | § 5 | traced |
| CB-5, CB-6 | component | REQ-010 | § 5 | traced |
| CB-7 | component | REQ-011 | § 5 | traced |
| CB-8 | component | REQ-020 | § 5 | traced |
| CB-9 | component | REQ-020, REQ-021 | § 5 | traced |
| CB-10 | component | REQ-022 | § 5 | traced |
| CB-11 | component | REQ-030, REQ-033, REQ-034, REQ-035 | § 5 | traced |
| CB-12 | component | REQ-031, REQ-032 | § 5 | traced |

No PHANTOM rows. Every traced requirement is itself ratification-pending (PRD § 14).

## 17. Ratification

Two lenses read the PRD and this document on 2026-11-15, each in its own context. No person was present, so the
design stays `status: draft` and every decision above stays ratification-pending.

| Lens | Verdict | What it raised | What changed |
|---|---|---|---|
| Product | CONFIRM | the premise grep would match this run's own documents; it missed `feature.md:29` and the CI-stall clause; which audit sets are free was left to the executor; the error-name test could remove a flag #352 deletes; the README entry could read as a naming rule; no item should be built before the owner ratifies | the grep runs over the five files; C1 step 3 inventory and the stall review; the set table names the one free set (D-4); the test omits `--enable-begin-frame-control`; the README text sets no rule; the gate below |
| UX | BLOCKING-CONCERN; first re-check STILL-BLOCKING; second re-check RESOLVED | C1 corrected one sentence and left other "unbounded" sentences contradicting it with nothing saying which wins; the `0` cells lacked citations; the audit record had no path, header or full row schema; `unverifiable` rows had no next step; a row could not name a commit not yet merged; only one README error entry would state its `err.name` | C1 steps 2–3: the paragraph says `start()` stays endless; the inventory is built by reading, with the search only a seed; five kinds; per-call notes that cite a table row, on their own line; the inventory committed beside the table; an independent full-read review in CAP-PREMISE; a fourth table row for `start()` setup calls; citations added; § 4 C4 gives the path, header and eight fields; step 5 routes `unverifiable` rows and uses `corrected in PR #N`; both README entries state `err.name` |

**Build gate.** The PRD is `dor_status: failed` on provenance alone: its requirements were written by the pipeline
and await the owner. Every item scoped from this design says so, and `/do` confirms the owner has ratified the PRD
§ 14 rows an item cites before it builds that item.
