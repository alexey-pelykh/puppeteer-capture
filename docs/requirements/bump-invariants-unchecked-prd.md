---
scope: Release pipeline integrity — puppeteer version-bump invariants
created: 2026-11-14
profile: full
formulation: {}
features: {}
artifacts: {}
dor_status: failed
---

# Release pipeline integrity: puppeteer version-bump invariants — Product Requirements Document

**Version**: 1.0
**Created**: 2026-11-14
**Last Updated**: 2026-11-14
**Status**: Draft — ratification-pending (captured in autonomous mode; see § 8 and § 12)
**Baseline**: repository revision `185a1ad` (`main`, clean), measured 2026-11-14
**Sources**:

| ID | Source | Reliability |
|---|---|---|
| S1 | Audit finding `## gap-bump-invariants-unchecked` in the council synthesis (run `council-20261114T160522Z`, main checkout `.tmp/`). Its "Verified" lines are measured; the rest is panelist claim. | C, cross-validated below |
| S2 | Council evidence pack and brief, same run (E3: 118/118 integration cells green at the bump; E9: branch-protection state) | C |
| S3 | `CLAUDE.md` § Puppeteer Version Bump Procedure (owner-authored) | B, user-authoritative |
| S4 | `CLAUDE.md` § Testing → Integration tests (owner-authored) | B |
| S5 | `.claude/commands/bump-puppeteer.md` (owner-authored procedure) | B |
| S6 | Orchestrator dispatch fields PROBLEM and INVARIANTS (measured at `185a1ad`) | A for the measurements |
| S7 | This run's own measurements at `185a1ad`: the six invariants re-read from `package.json`, `package-lock.json`, `ci.yml`, `publish.yml`; the six invariants evaluated at every historical `(imp) puppeteer v*` commit | A |
| S8 | Prior art: an uncommitted session checker `check-bump.sh` in the main checkout's gitignored `.tmp/` (self-described "Self-check (not independent)") | C |
| S9 | Classification: audit finding, corrective, owner-confirmed; existence and desirability gate exempt (scope working file) | B |

---

## 1. TL;DR

> Draft TL;DR, ratification-pending: the TL;DR is the owner's to author; this text is derived from S1 and S7, not composed from nothing.

The puppeteer version bump touches four files that must agree with each other on six facts. Nothing checks that they agree. CI uses the version only as an environment value and a cache key, and the integration job installs each tested version with `npm install --no-save`, so a wrong pin, a wrong workflow value or a missing peer range still passes all 118 integration cells. This has happened twice in the repository's history. Neither state was tagged as a release, and both were corrected by hand. This PRD asks for one repository checker, run as a CI step on every pull request to `main` and called by `/bump-puppeteer` before it commits.

## 2. Problem Statement

**Who has the problem.** The maintainer, who merges bump pull requests on CI green. The agent that runs `/bump-puppeteer`, which edits four files by hand-following prose. Downstream consumers of `puppeteer-capture`, who read the published `peerDependencies` range to decide which `puppeteer-core` versions they may install.

**Current state.** The procedure's cross-file invariants live in prose only, in S3 and S5. A violation is caught only if a person or the agent notices it while reading a diff. The verification that did run at the last bump was GitHub CI (S2 E3). CI cannot see these invariants (S1, verified):

- `grep -n 'PUPPETEER_VERSION\|--no-save' .github/workflows/*.yml` printed `ci.yml:33` and `:69`, and `publish.yml:21`, `:59`, `:83` and `:114`. Each of these lines is an `env` value or a cache key and nothing else.
- `ci.yml:195` runs `npm install --no-save 'puppeteer@${{ matrix.puppeteer-version }}' 'puppeteer-core@${{ matrix.puppeteer-version }}'`. Each integration cell therefore tests the matrix version, not the pinned one, and the peer range is never read.
- The integration matrix is 2 OS entries × 59 version entries = 118 cells (S6, S7).

**Workaround in use (a requirement signal).** An earlier session wrote its own checker, `check-bump.sh`, into the gitignored `.tmp/` of the main checkout (S8). It checks the same facts against `origin/main`. It is not committed, not run by CI, and describes itself as "not independent". The need was felt; the check was never made permanent.

**Evidence that the failure class is real (S7, measured).** Evaluating the six invariants at each of the 69 commits titled `(imp) puppeteer v*`:

| Commit | Date | Title | What disagreed |
|---|---|---|---|
| `7966135` | 2025-01-27 | `(imp) puppeteer v24.1.1` | `package.json` was not in the commit. The pin stayed `24.1.0` while `ci.yml` and `publish.yml` said `24.1.1`, and the matrix lacked the pin. No release tag was cut from this state: `7966135` is untagged, release tag `1.6.0` (`5716176`) does not descend from it, and the next tag, `1.8.0`, sits on the next bump commit (`02c23f0`, 2025-02-13), the first that no longer carries it. |
| `8d32d9c` | 2025-01-10 | `(imp) puppeteer v24.0.0` | Pinned and tested on `24.0.0`, but the peer range was `^23.10.0` only. Fixed two commits later by `5716176` (2025-01-10, `(fix) puppeteer-core peer dependency to include v24.0.x`), which carries release tag `1.6.0`; `8d32d9c` itself is untagged. |

Both predate the `/bump-puppeteer` command (added `eb6fd41`, 2026-03-28). Of the 24 bump commits since then, none violates I1, I2, I3, I5 or I6, and none lacks the pin in the matrix; the only flags are duplicate matrix minors in commits before `f4b7e23`, when that rule did not yet exist. Other flags from the historical sweep are not defects: duplicate matrix minors before `f4b7e23` (2026-05-31) predate the one-entry-per-minor rule, and early `publish.yml` files had a single job, so the two-binding rule did not yet apply.

**Why this matters, and why now.** The procedure runs once per new puppeteer (major, minor), and it is executed by an agent following prose. The last bump session showed that the user-level `/verify` cannot grade a tracker-less change (S1 "Related"), so the only gate that ran was CI, which is blind to these facts. The owner's rule is to fix every validated finding (S2, `constraint-fix-validated-findings`).

**Cost of doing nothing.** The defect class stays invisible to every gate. The likely damage is a published package whose `peerDependencies` range omits a `puppeteer-core` minor it was tested on, so consumers on that minor hit peer-dependency warnings or install errors. A second, smaller cost is a workflow cache key that no longer matches the pin. Since the procedure was codified, no bump commit has broken a rule that was in force at the time, so the residual risk is latent rather than recurring; the guard is cheap relative to one bad release.

## 3. Boundaries

- **Appetite**: small batch, about one working day including tests and documentation edits. Proposed, ratification-pending (D-02). The lean profile was proposed for this size and low uncertainty (D-01); the full profile was run because no lean route was declared.
- **Out of scope, not yet** (deferred, each with what reopens it):
  - *Checking that each matrix entry is the latest published patch of its minor* (S4 states the rule). It needs the npm registry, and a network call on every pull request would let registry failures turn unrelated PRs red. Reopens when the owner answers Q-01; the recommended home is the bump mode of the checker, where `/bump-puppeteer` Phase 1 already queries the registry.
  - *Making the new check a required status check in branch protection.* Owned by the sibling gap `gap-phantom-required-checks`, which adds an aggregate `ci-ok` required job. Reopens when that sibling's design names its aggregated jobs (Q-03).
  - *Changing `.github/dependabot.yml`* to stop separate `puppeteer` / `puppeteer-core` PRs. Reopens on the owner's answer to Q-02.
  - *Running the checker in `publish.yml`* (REQ-CIJ-B-003, Could). Reopens if the owner wants defence in depth at release time.
- **Explicitly not building** (each with why never, in this PRD):
  - The user's `~/.claude` `/verify` and `work-verify` behaviour, and the stock harness instruction "Always run `/verify` right before the `commit` command". Different repository and owner.
  - Renaming `/verify`, or patching the harness binary. Same reason; the panel was unanimous against renaming.
  - Changing the integration job's `npm install --no-save` version swap. It is the correct way to test older versions; the gap is that nothing else checks the pinned files, not that the swap is wrong.
  - Changing the bump rules themselves (one (major, minor) per commit and release, peer append, one matrix entry per minor). This PRD enforces the documented rules; it does not redesign them.
  - Detecting a version that is consistent everywhere but wrong (for example, a version that does not exist). `npm ci` and the integration cells already fail on that.

## 4. Success Criteria

> All metrics and thresholds below are derived by this run from S1 and S7, not stated by the owner. Ratification-pending (D-15).

- **Serves**: closing audit finding `gap-bump-invariants-unchecked`; the integrity of what `puppeteer-capture` publishes.
- **Leading indicators (within two weeks of merge)**
  - *Detection coverage*: invariants with a passing negative test ÷ invariants in scope. GOAL 7/7 (6/6 if REQ-INV-C-007 is not ratified). METER: the checker's own test run.
  - *Check presence*: CI runs on pull requests to `main` that report the checker's check ÷ all CI runs since merge. GOAL 100%. METER: `gh run list --workflow=ci.yml` cross-read with `gh pr checks`.
  - *Clean baseline*: the checker exits 0 on `main` at the merge commit. METER: the CI run on the merge commit.
  - *Procedure uptake*: the first `/bump-puppeteer` run after merge executes the checker before its commit. METER: the command file names the step, and the run's transcript shows it.
- **Lagging indicators (30, 60 and 90 days)**
  - *Escaped violations*: bump commits on `main` that violate an in-scope invariant. GOAL 0. Baseline: 2 of 69 historical bump commits; 0 of 24 since 2026-03-28 against the rules in force at each commit. METER: run the checker at each `(imp) puppeteer v*` commit.
  - *Releases from a violating tree*: GOAL 0. Baseline: 0 (neither historical violation was tagged; corrected at scope time 2026-11-14 from an earlier reading of 1). METER: run the checker at each release tag.
  - *False red rate*: checker failures where every invariant actually held ÷ all checker failures. GOAL 0 at 90 days. METER: triage note on each red check.
- **Decision gates**
  - Any false red (> 0) → fix the checker before the next bump runs.
  - Checker red on `main` for more than 1 day → treat as a release blocker; no GitHub Release is created until it is green.

## 5. Proposed Solution

A single repository checker reads the four bump files and states, for each invariant, whether it holds. It is used in three scenarios.

1. **A pull request to `main`.** CI runs the checker as its own step. If any invariant is violated, the check is red and lists each violation with the file, the expected value and the observed value. The maintainer sees the cause before reading any integration log.
2. **A `/bump-puppeteer` run.** After the four files are edited and before the commit, the procedure runs the checker (optionally in a bump mode that also checks the change against the previous version). The procedure commits only after the checker passes.
3. **A Dependabot puppeteer PR.** Dependabot bumps `puppeteer` and `puppeteer-core` in separate PRs and never touches the workflows or the peer range. The checker turns those PRs red, which is the correct signal: such a PR cannot be merged as-is, and `/bump-puppeteer` supersedes it (evidence: #329/#330 and #309/#310, all closed unmerged).

Technical design (language, file location, how YAML is read, job wiring) belongs to the solution design document written by `/design-solution`.

## 6. Risks and Mitigations

| ID | Risk | Mitigation |
|---|---|---|
| R1 | Brittle parsing of workflow YAML gives a false red, or worse, a false green | Fail closed (REQ-CHK-B-003); positive and negative fixtures per invariant (REQ-CHK-Q-002); the False red rate gate in § 4 |
| R2 | The prose rules and the checker drift apart | Documents name the checker as the executable form, and each invariant cites its document section (REQ-BMP-C-001) |
| R3 | Red Dependabot puppeteer PRs read as noise and train people to ignore the check | Each violation line says what disagrees; Q-02 decides whether to stop those PRs at the source |
| R4 | The agent running `/bump-puppeteer` edits the checker to make it pass | The procedure's run is a self-check; the CI run is the independent gate, and any change to the checker shows in the PR diff |
| R5 | Merge conflicts with sibling edits to `ci.yml` (`gap-phantom-required-checks`) | Sequence the two changes; the checker's job name is stable so the sibling can reference it (REQ-CIJ-I-001) |
| R6 | A future change of peer-range style (for example, collapsing to one term per major) makes REQ-INV-C-002 fail on a valid tree | The literal-term rule is the documented rule today (D-17); a change to S3 reopens REQ-INV-C-002 and REQ-INV-C-007 in the same commit |

## 7. Dependencies

- **Sibling gap `gap-phantom-required-checks`** (scoped in parallel; not scoped here). It edits `.github/workflows/ci.yml` and adds an aggregate `ci-ok` required job that requires `build` and every integration cell (owner decision). The new check must be considered for inclusion in that aggregate (Q-03).
- **Sibling gap `gap-capture-hang`** (scoped in parallel; not scoped here). It becomes a merge blocker once integration cells are required. Not a dependency of the checker, but it shares the merge path.
- **Owner documents** S3 and S5: the checker enforces them, and they will be edited to reference it.
- **GitHub Actions** `ubuntu-24.04` runner and Node.js satisfying the `engines.node` field (`>=22.12.0`).
- **No dependency on the npm registry** for the pull-request check (REQ-CHK-C-001).

## 8. Open Questions

| ID | Question | Owner | Options and what each costs | Recommendation | If unanswered |
|---|---|---|---|---|---|
| Q-01 | Check "latest patch of each minor" (S4)? | Maintainer | (a) never: the rule stays prose-only; (b) in bump mode only, which already uses the registry: no PR flake; (c) a scheduled workflow: registry flake isolated, another workflow to maintain | (b) | Deferred; § 3 out-of-scope row stands |
| Q-02 | Add an `ignore` entry for `puppeteer` and `puppeteer-core` in `.github/dependabot.yml`? | Maintainer | (a) ignore: removes two red PRs per release, loses Dependabot as a release notice; (b) keep: correct red signal, manual close each release; (c) group the two: one PR, still red | (a) if Dependabot PRs are not what prompts a bump run; otherwise (b). Settled at scope time (2026-11-14, #347): GitHub's Dependabot options reference marks `ignore` as also changing security-update PRs, and this repository has security updates on, so option (a) also stops security-update PRs for these two packages. | (b), no config change |
| Q-03 | Should the checker's job be part of the `ci-ok` aggregate? | Maintainer, with the sibling scope | Include: a violation blocks merge; exclude: advisory only | Include | Decided by the sibling design |
| Q-04 | May the checker add a development dependency (for example, a YAML parser), or must it use Node built-ins only? | Maintainer, at design | Built-ins: no dependency churn, more parsing code; parser: robust, one more Dependabot stream | Design stage decides | Design stage decides |
| Q-05 | Should `publish.yml`'s `validate` job also run the checker (REQ-CIJ-B-003)? | Maintainer | Yes: blocks a release from a violating tree even if `main` was red; no: relies on `main` CI | Yes, it is cheap | Not built |

## 9. Object Model

### Objects

| Object | Identity | Description | Lifecycle |
|---|---|---|---|
| **Pin** (`PIN`) | `package.json` → `devDependencies.puppeteer` | The version the repository builds and tests against | Edited by a bump → checked → committed |
| **VersionBinding** (`BND`) | A file and key that must echo the pin: `devDependencies.puppeteer-core`; `ci.yml` build `env.PUPPETEER_VERSION`; `publish.yml` `validate` and `publish` `env.PUPPETEER_VERSION`; `package-lock.json` `packages[""].devDependencies.puppeteer` / `.puppeteer-core`, `packages["node_modules/puppeteer"].version`, `packages["node_modules/puppeteer-core"].version` | One place where the pin must appear | Agrees → disagrees (violation) → agrees after fix |
| **PeerRange** (`PEER`) | `package.json` → `peerDependencies.puppeteer-core` | The published claim of supported `puppeteer-core` versions, a `||`-joined list of `^M.m.0` terms | Extended by one term per new (major, minor) |
| **IntegrationMatrix** (`MAT`) | `ci.yml` → `jobs.integration.strategy.matrix.puppeteer-version` | The tested versions, one per (major, minor) | Appended on a new (major, minor); entry replaced on a patch bump |
| **Invariant** (`INV`) | IDs `I1`–`I7` | A rule relating the objects above | Defined in S3/S5 → encoded in the checker |
| **CheckRun** (`CHK`) | One execution of the checker on one tree | Evaluates every invariant | Running → passed / failed |
| **Violation** (`VIO`) | Invariant ID + file + key | One disagreement found by a CheckRun | Reported → fixed |
| **CICheck** (`CIJ`) | The CI job / check context that runs the checker | The independent gate on PRs and pushes | Pending → success / failure, per commit SHA |
| **BumpProcedure** (`BMP`) | `.claude/commands/bump-puppeteer.md` + S3 | The documented process that produces bump commits | Step 2.2 edits → checker → Step 2.3 commit |
| **DependabotConfig** (`DEP`) | `.github/dependabot.yml` | Source of separate `puppeteer` / `puppeteer-core` PRs | Unchanged unless Q-02 decides |

### Relationships

| From | To | Type | Cardinality | Navigation |
|---|---|---|---|---|
| Pin | VersionBinding | references (must equal) | 1:N (7 bindings) | Pin → each binding |
| Pin | PeerRange | references (term `^M.m.0` present) | 1:1 | Pin → PeerRange |
| Pin | IntegrationMatrix | references (pin present) | 1:1 | Pin → IntegrationMatrix |
| PeerRange | IntegrationMatrix | peer-to-peer (same set of (major, minor)) | 1:1 | Both ways |
| Invariant | Pin / VersionBinding / PeerRange / IntegrationMatrix | references | N:M | Invariant → the objects it reads |
| CheckRun | Invariant | contains (evaluates) | 1:N (all) | CheckRun → each Invariant |
| CheckRun | Violation | contains | 1:0..N | CheckRun → Violations |
| CICheck | CheckRun | contains | 1:1 per commit SHA | CICheck → its CheckRun |
| BumpProcedure | CheckRun | contains (pre-commit) | 1:1 per bump | BumpProcedure → CheckRun |
| DependabotConfig | CICheck | references (its PRs trigger the check) | 1:N | Config → PR checks |

### CTA inventory

| Object | CTA | Feature | Variants | Preconditions | Outcome |
|---|---|---|---|---|---|
| CheckRun | Run | bump-invariant-guard | State mode (whole tree); bump mode (tree + previous version) | Node.js present; repository checked out | Exit 0 and a pass line, or non-zero and one line per Violation |
| CheckRun | Read report | bump-invariant-guard | Terminal; CI log | A CheckRun finished | The maintainer knows which file and key to fix |
| Violation | Fix | bump-invariant-guard | Edit the file; re-run `npm install` for the lockfile | A Violation was reported | Re-run passes |
| CICheck | Run on PR / push | bump-invariant-guard | `pull_request` to `main`; `push` to `main` | Workflow triggered | Check success or failure on the commit SHA |
| CICheck | Aggregate | bump-invariant-guard | Included in `ci-ok` or not (Q-03) | Sibling design | Merge blocked on failure, or advisory |
| BumpProcedure | Verify before commit | bump-invariant-guard | — | Step 2.2 complete | Commit proceeds only on pass |
| Invariant | Update definition | bump-invariant-guard | — | S3/S5 rule changed | Checker and documents change in one commit |
| DependabotConfig | Ignore puppeteer pair | bump-invariant-guard | — | Q-02 answered (a) | No separate puppeteer PRs |

Create/read/update/delete coverage: Pin, VersionBinding, PeerRange and IntegrationMatrix are created and updated by the BumpProcedure (out of this PRD's build scope, which only reads them); they are read by CheckRun. Invariant definitions are updated through REQ-BMP-C-001. Violations are never stored; they exist only in a CheckRun's output, so delete does not apply.

### Attribute priority

| Object | Attribute | Type | Priority | Display context |
|---|---|---|---|---|
| Violation | Invariant ID | `I1`–`I7` | Primary | Every violation line |
| Violation | File and key | path + key path | Primary | Every violation line |
| Violation | Expected value | string | Primary | Every violation line |
| Violation | Observed value | string or "absent" | Primary | Every violation line |
| CheckRun | Exit code | integer | Primary | CI status, shell |
| CheckRun | Pin read | semver | Secondary | First line of output |
| CheckRun | Invariants evaluated | count | Secondary | Summary line |

### Feature views

**Feature `bump-invariant-guard`**: CheckRun.Run, CheckRun.Read report, Violation.Fix, CICheck.Run on PR / push, CICheck.Aggregate, BumpProcedure.Verify before commit, Invariant.Update definition, DependabotConfig.Ignore puppeteer pair.

### Entity-Feature Matrix

| | bump-invariant-guard | Total CTAs |
|---|---|---|
| **CheckRun** | 2 | 2 |
| **Violation** | 1 | 1 |
| **CICheck** | 2 ! | 2 |
| **BumpProcedure** | 1 | 1 |
| **Invariant** | 1 | 1 |
| **DependabotConfig** | 1 | 1 |
| **Total** | 8 | 8 |

`!` CICheck.Aggregate is also claimed by the sibling `gap-phantom-required-checks` (its `ci-ok` job). Resolution: the sibling owns the aggregate; this PRD owns only the stable check name (REQ-CIJ-I-001).

## 10. Requirements

> Origin tags (`requirements-extraction` § Origin): **user-stated** = the owner's own procedure documents S3/S4/S5; **council-added** = the panel position in S1; **AI-inferred-expansion** = added by this run. Priority uses MoSCoW. Every non-user-stated requirement is ratification-pending.

### 10.1 bump-invariant-guard {#feature-bump-invariant-guard}

#### Invariant (INV) — constraints on repository state that the checker enforces

The pin is `P = devDependencies.puppeteer`, with major `M` and minor `m`. At baseline `185a1ad`, `P` = `25.17.0` and every invariant below holds (S6, S7).

**REQ-INV-C-001 — exact, equal pins** (I1) · Must · user-stated (S3 § 1, S5 Step 2.2) · 🟢
When the checker runs, the checker shall report a violation unless `devDependencies.puppeteer` and `devDependencies.puppeteer-core` in `package.json` are each a full `MAJOR.MINOR.PATCH` version with no range operator and are equal to each other.
- GIVEN `"puppeteer": "25.17.0"` and `"puppeteer-core": "25.17.0"` WHEN the checker runs THEN I1 passes.
- GIVEN `"puppeteer-core": "^25.17.0"` WHEN the checker runs THEN I1 is reported with expected `25.17.0` and observed `^25.17.0`.
- GIVEN `"puppeteer": "25.18.0"` and `"puppeteer-core": "25.17.0"` WHEN the checker runs THEN I1 is reported.
- BUT NOT accepting `~`, `^`, `>=`, `x`, `*` or `||` in either value.

**REQ-INV-C-002 — peer range carries the pin's minor** (I2) · Must · user-stated (S3 § 1, S5 Step 2.2) · 🟢
When the checker runs, the checker shall report a violation unless `peerDependencies.puppeteer-core`, split on `||` and trimmed, contains the literal term `^M.m.0`.
- GIVEN `P` = `25.17.0` and a peer range ending `|| ^25.16.0 || ^25.17.0` WHEN the checker runs THEN I2 passes.
- GIVEN `P` = `25.17.0` and a peer range ending `|| ^25.16.0` WHEN the checker runs THEN I2 is reported with expected term `^25.17.0`.
- BUT NOT passing because another term semantically covers `P` (for example `^25.0.0`); the documented rule is a literal term per (major, minor) (D-17).

**REQ-INV-C-003 — `ci.yml` build value equals the pin** (I3) · Must · user-stated (S3 § 2, S5) · 🟢
When the checker runs, the checker shall report a violation unless the `build` job of `.github/workflows/ci.yml` defines `env.PUPPETEER_VERSION` and every `PUPPETEER_VERSION:` definition in that file equals `P`.
- GIVEN `PUPPETEER_VERSION: 25.17.0` in the `build` job WHEN the checker runs THEN I3 passes.
- GIVEN `PUPPETEER_VERSION: 25.16.0` WHEN the checker runs THEN I3 is reported with `ci.yml`, expected `25.17.0`, observed `25.16.0`.
- BUT NOT counting `${{ env.PUPPETEER_VERSION }}` references (cache keys) as definitions.

**REQ-INV-C-004 — one matrix entry per minor, including the pin** (I4) · Must · user-stated (S3 § 2, S4, S5) · 🟢
When the checker runs, the checker shall report a violation unless the `integration` job's `puppeteer-version` matrix in `ci.yml` holds no two entries with the same (major, minor) and contains `P`.
- GIVEN the matrix block as at `185a1ad` (first and last entries verbatim; the 54 entries between them are elided here and must be copied whole from `ci.yml` at `185a1ad` for a fixture):
  ```yaml
          puppeteer-version:
            - '24.3.1'
            # … 54 entries elided …
            - '25.14.0'
            - '25.15.0'
            - '25.16.0'
            - '25.17.0'
  ```
  WHEN the checker runs THEN I4 passes.
- GIVEN `- '25.17.1'` added after `- '25.17.0'` WHEN the checker runs THEN I4 is reported naming the duplicate minor `25.17`.
- GIVEN `- '25.17.0'` removed WHEN the checker runs THEN I4 is reported with expected entry `'25.17.0'`.
- BUT NOT assuming the matrix holds only `os` and `puppeteer-version`; another matrix key, if added, is ignored by I4.

**REQ-INV-C-005 — `publish.yml` values equal the pin** (I5) · Must · user-stated (S3 § 3, S5) · 🟢
When the checker runs, the checker shall report a violation unless both the `validate` and the `publish` job of `.github/workflows/publish.yml` define `env.PUPPETEER_VERSION` and every `PUPPETEER_VERSION:` definition in that file equals `P`.
- GIVEN both jobs at `25.17.0` WHEN the checker runs THEN I5 passes.
- GIVEN `publish` at `25.17.0` and `validate` at `25.16.0` WHEN the checker runs THEN I5 is reported naming the `validate` job.
- BUT NOT passing when one of the two jobs has no definition at all.

**REQ-INV-C-006 — lockfile resolves the pin** (I6) · Must · user-stated (S3 § 4, S5) · 🟢
When the checker runs, the checker shall report a violation unless, in `package-lock.json`, `packages[""].devDependencies.puppeteer`, `packages[""].devDependencies["puppeteer-core"]`, `packages["node_modules/puppeteer"].version` and `packages["node_modules/puppeteer-core"].version` all equal `P`.
- GIVEN all four at `25.17.0` WHEN the checker runs THEN I6 passes.
- GIVEN `packages["node_modules/puppeteer-core"].version` = `25.16.0` WHEN the checker runs THEN I6 is reported naming that key.
- BUT NOT editing or regenerating the lockfile; the checker only reads it.

**REQ-INV-C-007 — peer minors and matrix minors match, none past the pin** (I7) · Should · AI-inferred-expansion (from S4 "from 24.3 up to the current pin", one entry per minor) · 🟡
When the checker runs, the checker shall report a violation unless the set of (major, minor) pairs in the peer range equals the set in the integration matrix, and no pair in either set is greater than (M, m).
- GIVEN 59 peer terms and 59 matrix entries over the same pairs (baseline) WHEN the checker runs THEN I7 passes.
- GIVEN a peer term `^25.18.0` with `P` = `25.17.0` WHEN the checker runs THEN I7 is reported.
- GIVEN a matrix entry `'24.20.1'` removed while `^24.20.0` stays in the peer range WHEN the checker runs THEN I7 is reported naming `24.20`.
- BUT NOT requiring each matrix entry to be the latest patch (Q-01).

#### CheckRun (CHK) — the checker

**REQ-CHK-B-001 — evaluate every invariant, signal by exit code** · Must · council-added (S1 panel) · 🟢
When the checker is invoked from the repository root, the checker shall evaluate every in-scope invariant and exit with code 0 when no violation is found and a non-zero code when at least one is found.
- GIVEN the tree at `185a1ad` WHEN the checker runs THEN it exits 0 and prints the pin it read and the count of invariants evaluated.
- GIVEN any single invariant violated WHEN the checker runs THEN it exits non-zero.
- BUT NOT exiting 0 when fewer invariants were evaluated than are in scope.

**REQ-CHK-B-002 — each violation names what disagrees** · Must · AI-inferred-expansion · 🟢
When the checker finds a violation, the checker shall print one line for it carrying the invariant ID, the file, the key or job, the expected value and the observed value.
- GIVEN I3 violated WHEN the checker runs THEN the output holds a line with `I3`, `.github/workflows/ci.yml`, `build`, `25.17.0` and the observed value.
- BUT NOT printing a guessed cause (such as "you forgot to run npm install") as fact; the line states the detected disagreement only.

**REQ-CHK-B-003 — fail closed** · Must · AI-inferred-expansion · 🟢
If a file the checker reads is absent or cannot be parsed, or a key, job or matrix the invariant needs is not found, then the checker shall report a violation for each affected invariant with observed value `absent` or `unparseable`.
- GIVEN the `puppeteer-version:` key renamed in `ci.yml` WHEN the checker runs THEN I4 and I7 are reported with observed `absent`, and the exit code is non-zero.
- GIVEN `package-lock.json` deleted WHEN the checker runs THEN I6 is reported.
- BUT NOT skipping an invariant whose input is missing and reporting a pass.

**REQ-CHK-B-004 — report every violation in one run** · Should · AI-inferred-expansion · 🟢
When more than one invariant is violated, the checker shall report every violated invariant in the same run.
- GIVEN I1 and I5 violated WHEN the checker runs THEN both appear in one output.
- BUT NOT stopping at the first violation.

**REQ-CHK-B-005 — one reference value** · Must · AI-inferred-expansion · 🟢
The checker shall take `devDependencies.puppeteer` in `package.json` as the reference value `P` for every other invariant.
- GIVEN `puppeteer` = `25.17.0` and `puppeteer-core` = `25.16.0` WHEN the checker runs THEN I1 is reported, and I3–I7 are evaluated against `25.17.0`.
- BUT NOT choosing the reference from a workflow file or the lockfile.

**REQ-CHK-B-006 — bump mode checks the change against the previous version** · Should · AI-inferred-expansion (the rules are user-stated in S3/S5; prior art S8) · 🟡
Where bump mode is selected with the previous pin `O` and a base revision, the checker shall additionally report a violation unless: the change against the base touches exactly `package.json`, `package-lock.json`, `.github/workflows/ci.yml` and `.github/workflows/publish.yml`; on a minor or major bump the new peer range equals the base range followed by ` || ^M.m.0`; on a patch bump the peer range is unchanged and the matrix entry of that minor was replaced rather than a second one added; and no `PUPPETEER_VERSION:` definition still equals `O`.
- GIVEN `O` = `25.16.0`, `P` = `25.17.0`, and a change to the four files only WHEN bump mode runs THEN it passes.
- GIVEN the same bump with `README.md` also changed WHEN bump mode runs THEN a violation names the extra file.
- GIVEN a patch bump `25.17.0` → `25.17.1` that appended `'25.17.1'` and kept `'25.17.0'` WHEN bump mode runs THEN a violation is reported.
- BUT NOT requiring bump mode in CI, where no previous version is given.

**REQ-CHK-C-001 — offline and read-only** · Must · AI-inferred-expansion · 🟢
The checker shall complete using only the checked-out files and the Node.js runtime, with no network access, no package installation and no file writes.
- GIVEN a runner with networking disabled WHEN the checker runs on the baseline tree THEN it exits 0.
- BUT NOT calling the npm registry, `npm install` or `npm view` in state mode.

**REQ-CHK-C-002 — not part of the published package** · Must · AI-inferred-expansion · 🟢
The checker shall add no entry to `dependencies`, `optionalDependencies` or `peerDependencies`, and shall sit outside the paths listed in the `files` field of `package.json`.
- GIVEN the change merged WHEN `npm pack --dry-run` runs THEN the tarball lists no checker file.
- BUT NOT changing the `files` field to accommodate the checker.

**REQ-CHK-I-001 — one documented command** · Must · council-added (S1: CI step and `/bump-puppeteer` call share one checker) · 🟢
The checker shall be invocable by one command from the repository root, and that same command shall be what CI and `/bump-puppeteer` run.
- GIVEN the command named in `CLAUDE.md` WHEN the maintainer runs it locally THEN the output equals the CI output for the same tree.
- BUT NOT keeping a second copy of the invariant logic in the workflow or in the command file.

**REQ-CHK-Q-001 — runtime** · Should · AI-inferred-expansion · 🟡 (targets are author-chosen, D-09)
- TAG: Checker runtime
- SCALE: seconds from process start to exit, state mode, baseline tree
- METER: duration of the checker step in the CI log on `ubuntu-24.04`, median of the first 10 runs after merge
- GOAL: ≤ 10 s · STRETCH: ≤ 2 s · PAST: not measured (no checker exists)
- CONSTRAINT: the check adds no more than 1 minute to the CI run's wall-clock time

**REQ-CHK-Q-002 — detection coverage** · Must · AI-inferred-expansion · 🟢
- TAG: Invariant detection coverage
- SCALE: in-scope invariants that have an automated test which violates exactly that invariant on a fixture and asserts a non-zero exit plus that invariant's ID in the output, ÷ in-scope invariants
- METER: the checker's test suite, run in CI
- GOAL: 7/7 (6/6 if REQ-INV-C-007 is not ratified) · PAST: 0 (no checker)
- Also required: one test asserting exit 0 on a fixture copied from the baseline tree.

#### CICheck (CIJ)

**REQ-CIJ-B-001 — run on every PR and push to `main`** · Must · council-added (S1) · 🟢
When `ci.yml` is triggered by a `pull_request` targeting `main` or a `push` to `main`, CI shall run the checker in state mode and mark its check failed when the checker exits non-zero.
- GIVEN a Dependabot PR that changes only `devDependencies.puppeteer` WHEN CI runs THEN the check fails, reporting I1 and the bindings that no longer match.
- GIVEN a PR that touches none of the four files WHEN CI runs THEN the check runs and passes.
- BUT NOT skipping the check by path filter: a PR that edits only a workflow can break I3–I5.

**REQ-CIJ-B-002 — independent of build and integration** · Should · AI-inferred-expansion · 🟢
The CI check shall start without waiting for the `build` or `integration` jobs and shall report its result even when those jobs fail.
- GIVEN `build` fails on lint WHEN CI runs THEN the checker's result is still reported.
- BUT NOT making `build` or `integration` wait on the check unless the owner decides so at design.

**REQ-CIJ-C-001 — least privilege** · Must · AI-inferred-expansion · 🟢
The CI check shall run with `contents: read` permission, use no repository secrets, and interpolate no pull-request-controlled text (title, body, branch name) into a `run:` script.
- GIVEN the job definition WHEN reviewed THEN its permissions block is `contents: read` only and no `secrets.*` reference appears.
- BUT NOT using `pull_request_target`.

**REQ-CIJ-I-001 — stable check name** · Must · AI-inferred-expansion (interface for `gap-phantom-required-checks`) · 🟢
The CI check shall report under a single job name that does not depend on a matrix value, so that branch protection or the `ci-ok` aggregate can reference it.
- GIVEN two consecutive CI runs WHEN their check names are listed THEN the checker's name is identical in both.
- BUT NOT running the checker inside the `build` matrix, which would multiply and rename it per OS.

**REQ-CIJ-B-003 — release-time check** · Could · AI-inferred-expansion · 🟡 (Q-05)
Where the owner enables the release-time check, the `validate` job of `publish.yml` shall run the checker before `npm ci` and fail on a non-zero exit.
- GIVEN a release created from a tree violating I2 WHEN `publish.yml` runs THEN `validate` fails and `publish` does not start.
- BUT NOT adding network access or secrets to `validate` for this purpose.

#### BumpProcedure (BMP)

**REQ-BMP-B-001 — check before commit** · Must · council-added (S1) · 🟢
When `/bump-puppeteer` completes Step 2.2 (Update the 4 files), the procedure shall run the checker and proceed to Step 2.3 (Commit) only after the checker exits 0.
- GIVEN Step 2.2 left `publish.yml` `validate` at the old version WHEN the procedure reaches the check THEN it reports I5, fixes the file, re-runs, and commits only after the pass.
- BUT NOT committing on a non-zero exit, and BUT NOT editing the checker to make it pass.

**REQ-BMP-C-001 — one source for the rules** · Should · AI-inferred-expansion · 🟢
The bump procedure documents, `CLAUDE.md` § Puppeteer Version Bump Procedure and `.claude/commands/bump-puppeteer.md`, shall each name the checker command as the executable form of the bump invariants, and the checker shall cite, per invariant, the document section that states it.
- GIVEN a change to a bump rule in S3 WHEN that PR is reviewed THEN the checker change is in the same PR.
- BUT NOT restating the invariant logic in the documents beyond naming the rule.

#### DependabotConfig (DEP)

**REQ-DEP-C-001 — stop separate puppeteer PRs (conditional)** · Could · council-added (S1, "an option") · 🔴 (Q-02 open)
Where the owner answers Q-02 with "ignore", `.github/dependabot.yml` shall carry an `ignore` entry for `puppeteer` and `puppeteer-core` in the `npm` update block.
- GIVEN the entry in place WHEN a new puppeteer minor is published THEN Dependabot opens no version-update PR for either package.
- BUT NOT ignoring any other package, and BUT NOT adding the entry before Q-02 is answered.

## 11. State Matrices

The only data-driven view is the checker's report, read in a terminal or as a CI check.

| State | Behaviour |
|---|---|
| Loading | CI shows the check as pending; locally, the process is running (expected under 10 s, REQ-CHK-Q-001) |
| Empty (first use) | N/A — the checker always reads the same four files; there is no first-use state |
| Empty (no results) | Pass: one summary line with the pin and the count of invariants evaluated, exit 0 |
| Populated | Fail: one line per violation (REQ-CHK-B-002), exit non-zero |
| Error (network) | N/A — no network is used (REQ-CHK-C-001) |
| Error (auth) | N/A — reads local files only |
| Error (permission) | A file that cannot be read is reported as a violation (REQ-CHK-B-003) |
| Partial | Not allowed: an invariant that could not be evaluated is a violation, never a silent partial pass (REQ-CHK-B-003) |
| Stale | The CI result belongs to one commit SHA; a new push produces a new result |
| Offline | Same as normal operation (REQ-CHK-C-001) |

## 12. Assumption Registry

| ID | Assumption | Type | Confidence | Evidence | Validation plan | Risk if wrong |
|---|---|---|---|---|---|---|
| A-01 | I1–I6 as written in S3/S5 are the complete set of cross-file bump invariants | Scope | 🟢 | S3, S5, and the panel's list in S1 agree; S8 checks the same facts | Owner review during ratification | A violation class stays unchecked |
| A-02 | File paths and key names (`PUPPETEER_VERSION`, `puppeteer-version`, job names `build`, `integration`, `validate`, `publish`) stay stable | Technical | 🟡 | Stable through 69 bump commits except the `publish.yml` single-job era | REQ-CHK-B-003 turns a rename into a visible red | Checker red after a refactor (visible, not silent) |
| A-03 | Dependabot PRs are not what prompts the maintainer to run `/bump-puppeteer` | Usage | 🔴 | None; #329/#330 and #309/#310 were closed as superseded, which is consistent but not proof | Ask the owner (Q-02) before any `dependabot.yml` change | Ignoring them removes the release notice the owner relies on |
| A-04 | `/bump-puppeteer` is run by an agent that follows the command file step by step | Usage | 🟡 | S2: the last bump was run that way | Observe the next bump run (§ 4 Procedure uptake) | The pre-commit check is skipped; CI still catches it |
| A-05 | A `pull_request` from Dependabot triggers `ci.yml` with read-only permissions | Technical | 🟢 | Dependabot PR #330 ran the integration cells (S2 E8) | First Dependabot PR after merge shows the check | The check never runs on those PRs |
| A-06 | The literal peer term `^M.m.0` is the intended rule, not semantic coverage | Domain | 🟡 | S3 and S5 both say "append `\|\| ^M.m.0`"; the baseline carries 59 literal terms | Owner ratifies D-17 | False reds if the owner meant semantic coverage |
| A-07 | Both historical violations (S7) would have been caught by I1–I6 | Evidence | 🟢 | Measured by evaluating the invariants at those commits | Re-run during the design stage's tests | Weaker case for the guard |

Decisions this run took without the owner (not assumptions; each needs ratification on its own):

| ID | Decision | Alternatives | Why this one |
|---|---|---|---|
| D-01 | Full profile, not lean | Lean (proposed: small batch, low uncertainty) | No lean route was declared; the pipeline's design stage reads the object model |
| D-02 | Appetite: small batch, about one working day | Not set | Seven read-only checks, tests, two document edits, one CI job |
| D-03 | CI runs state mode (whole tree); diff checks only in bump mode | Diff checks in CI too | CI has no previous version to compare against; Dependabot and unrelated PRs have no "bump" |
| D-04 | Include I7 as Should | Leave out | S4 implies it; it catches a dropped matrix entry or an extra peer term that I2/I4 miss |
| D-05 | Latest-patch rule not checked on PRs | Check via registry | Registry access on every PR adds flake (REQ-CHK-C-001) |
| D-06 | Offline, read-only checker | Allow network | Determinism on every PR |
| D-07 | Fail closed | Skip what cannot be read | A silent skip reads as a pass |
| D-08 | Report all violations per run | Stop at first | One fix cycle per bump instead of several |
| D-09 | Runtime GOAL ≤ 10 s, STRETCH ≤ 2 s | Other values | Static reads of four small files |
| D-10 | Reference value is `devDependencies.puppeteer` | `puppeteer-core`, or the workflow value | It is the field `/bump-puppeteer` Phase 1 reads as "current" (S5) |
| D-11 | CI check independent of `build` / `integration`, on PR and push | Gate it behind `build` | An independent, early signal |
| D-12 | Documents name the checker as the executable form | Keep prose only | Prevents rule drift (R2) |
| D-13 | Dependabot `ignore` not applied now; recommended conditional on Q-02 | Apply now; never | A-03 is unvalidated |
| D-14 | Release-time check is Could | Must; drop | Cheap defence in depth, but `main` CI already covers it |
| D-15 | Success metrics and thresholds in § 4 | Other metrics | Derived from S1 and S7 baselines |
| D-16 | Rules in S3/S4/S5 tagged user-stated | Tag all as AI-inferred | They are the owner's own documents |
| D-17 | Literal peer-term rule (A-06) | Semantic `semver.satisfies` coverage | Matches the documented append rule |

## 13. Feature Completeness

| Feature | Requirement IDs | Object sections | Entity coverage | CTA coverage | Specification depth | Open questions | Verdict |
|---|---|---|---|---|---|---|---|
| bump-invariant-guard | REQ-INV-C-001…007, REQ-CHK-B-001…006, REQ-CHK-C-001…002, REQ-CHK-I-001, REQ-CHK-Q-001…002, REQ-CIJ-B-001…003, REQ-CIJ-C-001, REQ-CIJ-I-001, REQ-BMP-B-001, REQ-BMP-C-001, REQ-DEP-C-001 | § 10.1 | 6/6 expected entities present (CheckRun, Violation, CICheck, BumpProcedure, Invariant, DependabotConfig) | 8/8 CTAs specified | 24/24 statements with EARS form, GWT and BUT NOT; 2 quality measures in Planguage | 5 (Q-01 to Q-05) | INCOMPLETE |

Gap documentation for the INCOMPLETE verdict: the verdict is driven only by the open-question count (5 > 2). No entity or CTA is missing. The questions that change what is built are Q-02 (whether REQ-DEP-C-001 is built), Q-03 (whether the check blocks merges, owned by the sibling scope), and Q-05 (whether REQ-CIJ-B-003 is built). Q-01 and Q-04 do not change the Must set.

## 14. Source Traceability

| Req ID | Source | Object | CTA | Feature | Layer | Confidence | Origin |
|---|---|---|---|---|---|---|---|
| REQ-INV-C-001 | S3 § 1; S5 Step 2.2; S6 | Invariant (Pin, VersionBinding) | CheckRun.Run | bump-invariant-guard | Constraint | 🟢 VALIDATED | user-stated |
| REQ-INV-C-002 | S3 § 1; S5 Step 2.2; S6 | Invariant (PeerRange) | CheckRun.Run | bump-invariant-guard | Constraint | 🟢 VALIDATED | user-stated |
| REQ-INV-C-003 | S3 § 2; S5; S1 verified line | Invariant (VersionBinding) | CheckRun.Run | bump-invariant-guard | Constraint | 🟢 VALIDATED | user-stated |
| REQ-INV-C-004 | S3 § 2; S4; S5 Rules | Invariant (IntegrationMatrix) | CheckRun.Run | bump-invariant-guard | Constraint | 🟢 VALIDATED | user-stated |
| REQ-INV-C-005 | S3 § 3; S5 | Invariant (VersionBinding) | CheckRun.Run | bump-invariant-guard | Constraint | 🟢 VALIDATED | user-stated |
| REQ-INV-C-006 | S3 § 4; S5; S6 | Invariant (VersionBinding) | CheckRun.Run | bump-invariant-guard | Constraint | 🟢 VALIDATED | user-stated |
| REQ-INV-C-007 | S4; S6 (59 = 59 measured) | Invariant (PeerRange, IntegrationMatrix) | CheckRun.Run | bump-invariant-guard | Constraint | 🟡 ASSUMED | AI-inferred-expansion |
| REQ-CHK-B-001 | S1 panel | CheckRun | Run | bump-invariant-guard | Behavioural | 🟢 | council-added |
| REQ-CHK-B-002 | this run | Violation | Read report | bump-invariant-guard | Behavioural | 🟢 | AI-inferred-expansion |
| REQ-CHK-B-003 | this run | CheckRun | Run | bump-invariant-guard | Behavioural | 🟢 | AI-inferred-expansion |
| REQ-CHK-B-004 | this run | CheckRun | Run | bump-invariant-guard | Behavioural | 🟢 | AI-inferred-expansion |
| REQ-CHK-B-005 | S5 Phase 1 | CheckRun | Run | bump-invariant-guard | Behavioural | 🟢 | AI-inferred-expansion |
| REQ-CHK-B-006 | S3; S5; S8 | CheckRun | Run (bump mode) | bump-invariant-guard | Behavioural | 🟡 | AI-inferred-expansion |
| REQ-CHK-C-001 | this run | CheckRun | Run | bump-invariant-guard | Constraint | 🟢 | AI-inferred-expansion |
| REQ-CHK-C-002 | `package.json` `files` field | CheckRun | — | bump-invariant-guard | Constraint | 🟢 | AI-inferred-expansion |
| REQ-CHK-I-001 | S1 panel | CheckRun | Run | bump-invariant-guard | Interface | 🟢 | council-added |
| REQ-CHK-Q-001 | this run | CheckRun | Run | bump-invariant-guard | Quality | 🟡 | AI-inferred-expansion |
| REQ-CHK-Q-002 | this run | Invariant | Run | bump-invariant-guard | Quality | 🟢 | AI-inferred-expansion |
| REQ-CIJ-B-001 | S1 panel | CICheck | Run on PR / push | bump-invariant-guard | Behavioural | 🟢 | council-added |
| REQ-CIJ-B-002 | this run | CICheck | Run on PR / push | bump-invariant-guard | Behavioural | 🟢 | AI-inferred-expansion |
| REQ-CIJ-B-003 | this run | CICheck | Run on PR / push | bump-invariant-guard | Behavioural | 🟡 | AI-inferred-expansion |
| REQ-CIJ-C-001 | this run | CICheck | Run on PR / push | bump-invariant-guard | Constraint | 🟢 | AI-inferred-expansion |
| REQ-CIJ-I-001 | dispatch KNOWN RELATIONS (sibling `ci-ok`) | CICheck | Aggregate | bump-invariant-guard | Interface | 🟢 | AI-inferred-expansion |
| REQ-BMP-B-001 | S1 panel | BumpProcedure | Verify before commit | bump-invariant-guard | Behavioural | 🟢 | council-added |
| REQ-BMP-C-001 | this run (R2) | Invariant | Update definition | bump-invariant-guard | Constraint | 🟢 | AI-inferred-expansion |
| REQ-DEP-C-001 | S1 panel ("an option") | DependabotConfig | Ignore puppeteer pair | bump-invariant-guard | Constraint | 🔴 SPECULATIVE | council-added |

### 14b. Cross-Repository References

N/A — single repository; the checker, CI and procedure all live in `alexey-pelykh/puppeteer-capture`.

## 15. Cross-Cutting and Non-Functional Concerns

### 15.1 Security
Covered by REQ-CIJ-C-001 (least privilege, no secrets, no untrusted interpolation, no `pull_request_target`); REQ-CHK-C-001 (no network, no writes); REQ-CHK-C-002 (no runtime dependency, nothing shipped). The checker's output holds only version strings and file paths, which are already public in this repository.

### 15.2 Compliance and Regulatory
N/A — no personal data, no regulated surface. If the design adds a development dependency (Q-04), its licence must be MIT-compatible, as for any other dependency of this MIT-licensed project.

### 15.3 Reliability and Observability
Deterministic, offline evaluation (REQ-CHK-C-001); fail closed (REQ-CHK-B-003); one line per violation with expected and observed values (REQ-CHK-B-002); exit code as the machine signal (REQ-CHK-B-001); false-red tracking in § 4.

### 15.4 Performance and Scalability
Covered by REQ-CHK-Q-001. The matrix and peer range grow by one entry per puppeteer minor (59 today); the checker must stay within its GOAL as both grow past 100 entries and as new majors (26.x) appear.

### 15.5 Operational
The command is documented in `CLAUDE.md` (REQ-CHK-I-001, REQ-BMP-C-001). On a red check, the maintainer reads the violation lines and fixes the named file; for the lockfile, the fix is `npm install`, never a hand edit (S5). Runs on one OS in CI (`ubuntu-24.04`): the check is static, so the Windows leg adds nothing. The checker must also run on the maintainer's local machine, including macOS, because it starts no browser.

### 15.6 Lifecycle
A change to any bump rule in S3/S5 changes the checker in the same commit (REQ-BMP-C-001). A change in peer-range style reopens REQ-INV-C-002 and REQ-INV-C-007 (R6). If puppeteer support is ever dropped for an old minor, the peer range and matrix must drop it together, which I7 enforces. Deprecation: none planned; the checker lives as long as the bump procedure does.

## 16. Change Log

| Version | Date | Change | Rationale | Impact |
|---|---|---|---|---|
| 1.0 | 2026-11-14 | Created from audit finding `gap-bump-invariants-unchecked` in autonomous mode | Stage 1 of the `/scope` pipeline for this gap | 26 requirements, all ratification-pending except the six user-stated invariants; readiness gate failed on provenance (see Readiness below) |

---

## Readiness (Definition of Ready) — recorded 2026-11-14

`dor_status: failed`. The gate ran and graded all six checks.

| Check | Result | Evidence |
|---|---|---|
| 1. Validated problem statement | Pass | § 2, traced to S1 and measured in S7 |
| 2. Explicit out-of-scope | Pass | § 3: four deferrals with reopen triggers, five exclusions with reasons |
| 3. Success and telemetry metrics | Pass (structure) | § 4: four leading, three lagging, two decision gates; values ratification-pending (D-15) |
| 4. Cross-cutting concerns | Pass | § 15: six subsections, each with content or `N/A — {rationale}` |
| 5. Feature-completeness verdict | Pass | § 13: INCOMPLETE with gap documentation |
| 6. Requirement provenance | **Fail** | 20 of 26 requirements are council-added (5) or AI-inferred-expansion (15) and none has been ratified by the owner, one at a time. The TL;DR (§ 1) and the § 4 metrics are also owner-owned sections derived by this run. |

To pass: the owner ratifies or rejects each non-user-stated requirement and each decision D-01 to D-17, answers or defers Q-01 to Q-05, then the gate is re-run.
