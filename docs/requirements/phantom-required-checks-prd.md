---
scope: CI merge gate for alexey-pelykh/puppeteer-capture (required status checks on `main`)
created: 2026-11-14
profile: lean
formulation:
  technical-architecture: complete
  infrastructure: complete
  security-architecture: complete
  testing-architecture: complete
features:
  aggregate-job: {stage: designed, tracks: [technical-architecture, infrastructure, testing-architecture]}
  merge-gate: {stage: designed, tracks: [security-architecture, infrastructure, testing-architecture]}
  merge-instructions: {stage: designed, tracks: [technical-architecture, testing-architecture]}
artifacts:
  design-doc: docs/design/phantom-required-checks-solution-design.md
  design-brief: docs/design/phantom-required-checks-brief.md
dor_status: failed
---

# CI Merge Gate (one aggregate required check) — Product Requirements Document

**Version**: 1.0
**Created**: 2026-11-14
**Last Updated**: 2026-11-14
**Status**: Draft (autonomous run; owner ratification pending, see § 12 and § 14)
**Sources**:
- S1 — council synthesis `.tmp/council-20261114T160522Z/synthesis.md` § gap-phantom-required-checks (its "Verified" line, re-run by the orchestrator)
- S2 — evidence pack `.tmp/council-20261114T160522Z/evidence.md` § E9 (commands with unedited output)
- S3 — owner decisions of 2026-11-14 recorded in `.tmp/council-20261114T160522Z/scope-dispatch.md` (decision-route, decision-required-integration)
- S4 — facts re-run during this scope at revision `185a1ad`, 2026-11-14T19:29Z (listed in § 2 Evidence)

The `.tmp/` sources are local, gitignored scratch. Every fact this PRD relies on is restated in-band below, so the
document does not depend on them.

## 1. TL;DR

Branch protection on `main` requires four status checks, and two of them (`build (… lts/iron)`) are never
produced, because CI's build matrix runs `lts/jod` only. Every pull request therefore sits BLOCKED and is merged with
an admin bypass (`gh pr merge --rebase --admin`), and the 118 integration cells are not required at all. The fix is
one aggregate CI job, `ci-ok`, that passes only when the build job and every integration cell succeeded, made the
only required check on `main`. The repository's merge instructions then stop prescribing `--admin`. The owner has
accepted that a capture hang in one integration cell will block a merge until the cell is re-run.

## 2. Problem Statement

- **Why this matters**: the merge gate does not gate. It blocks every PR (including green ones), so the only way to
  merge is a bypass that also skips any real failure. Integration results, the project's main compatibility signal
  across 59 puppeteer versions, never block a merge.
- **Who has this problem**: the maintainer and any agent that merges (the `/bump-puppeteer` procedure, Dependabot
  triage). Contributors see their PRs as BLOCKED regardless of CI.
- **Current state (workaround = requirement signal)**: every merge is `gh pr merge {PR_NUMBER} --rebase --admin`, after a
  manual snapshot of `gh pr checks`. The workaround is written down as the normal path in three repository
  instruction files (§ 2 Evidence).
- **Evidence** (S2 § E9, re-run in S4):
  - `gh api repos/alexey-pelykh/puppeteer-capture/branches/main/protection --jq "{checks: .required_status_checks.contexts, strict: .required_status_checks.strict, enforce_admins: .enforce_admins.enabled, reviews: .required_pull_request_reviews}"`
    printed `{"checks":["build (ubuntu-24.04, lts/iron)","build (ubuntu-24.04, lts/jod)","build (windows-2022, lts/iron)","build (windows-2022, lts/jod)"],"enforce_admins":false,"reviews":null,"strict":false}`.
  - `.github/workflows/ci.yml` at `185a1ad`: job `build` has matrix `os: [ubuntu-24.04, windows-2022]` ×
    `node-version: [lts/jod]`; job `integration` has `needs: [build]`, `fail-fast: false`, matrix `os` (2) ×
    `puppeteer-version` (59 entries, `24.3.1` … `25.17.0`) = 118 cells. Jobs `github-pages` and
    `publish-github-pages` also exist; neither is required today.
  - `gh api repos/alexey-pelykh/puppeteer-capture/rulesets` returned an empty list: branch protection is the only
    merge rule source.
  - `--admin` is prescribed at: `.claude/commands/bump-puppeteer.md` Step 2.5 (lines 155-159);
    `.claude/memory/bump-puppeteer-merge-mechanics.md` (lines 3, 10, 12, 14);
    `.claude/memory/dependabot-triage-stale-base.md` line 17; `.claude/memory/MEMORY.md` line 5.
  - **Correction to S1**: S1 lists `./CLAUDE.md` among the `--admin` sites. `grep -n "admin" CLAUDE.md` at
    `185a1ad` returns nothing; CLAUDE.md does not prescribe `--admin`. S1 also omits
    `dependabot-triage-stale-base.md` and the `MEMORY.md` index line, which do.
  - The session of 2026-11-14 merged four PRs with `--admin` (S1).
- **Why now**: the owner decided on 2026-11-14 that integration must be part of the merge gate (S3). Each further
  merge repeats the bypass and keeps integration non-blocking.

## 3. Boundaries

- **Appetite**: small batch — one workflow job, one repository-settings change, and edits to the instruction
  files. Hours of hands-on work; elapsed time is set by about six CI runs to observe (the fault-injection runs, the
  workflow PR, the push to `main`, the instruction-file PR). Circuit breaker: if a fault-injection run contradicts
  the documented `needs` semantics (A-1, A-2 or A-3), or the work passes two weeks elapsed, stop and return to the
  owner rather than adding retries or widening scope. (Proposed by the pipeline; ratification pending.)
- **Out of scope, not yet**:
  - Turning on `enforce_admins`. Deferred because, with admins enforced, a stuck required check would leave no
    merge path at all. Reopen when `ci-ok` has been the only required check for 30 days with no false red
    (S1, security lens).
  - Fixing the capture hang that can fail an integration cell (gap-capture-hang). It is a separate defect with its
    own item. This PRD only records that, once integration is required, that hang blocks merges.
  - Simplifying the manual integration-cell count in `.claude/commands/bump-puppeteer.md` Step 2.5, which a required
    `ci-ok` makes redundant. Deferred so this work does not collide with gap-bump-invariants-unchecked, which also
    edits the bump procedure and `ci.yml`. Reopen after both land.
  - Requiring `github-pages` (it runs on PRs but is not required today). The owner decision names build and
    integration only. Answered for this PRD by the owner decision (S3); reopen only if the owner wants the pages build to gate merges (OQ-1).
  - Changing `strict` (require branch up to date before merge). It stays `false`, as today.
- **Explicitly not building**:
  - Raising Jest or job timeouts, or adding automatic retries, to make the gate pass. A hang is a defect to fix
    (gap-capture-hang), not to retry past.
  - Requiring each of the 118 integration contexts by name. Per-cell contexts are what drifted into the current
    phantom checks; one stable aggregate name is the fix.
  - Pull-request review requirements. Not part of this defect.

## 4. Success Criteria

- **Serves**: the repository's merge gate reflects CI: a green PR merges without bypass; a red build or a red
  integration cell blocks the merge.
- **Leading indicators (within two weeks of rollout)**:
  - L1 `RequiredContexts`: `gh api repos/alexey-pelykh/puppeteer-capture/branches/main/protection --jq '.required_status_checks.contexts'` prints `["ci-ok"]`.
  - L2 `GreenPrMergeable`: the first PR after rollout whose checks are all green shows `mergeStateStatus` `CLEAN`
    (`gh pr view {PR_NUMBER} --json mergeStateStatus`) and merges with `gh pr merge {PR_NUMBER} --rebase`, no `--admin`.
  - L3 `RedCellBlocks`: on a PR with at least one failed integration cell, `ci-ok` concludes `failure` and the PR
    shows `mergeStateStatus` `BLOCKED`.
- **Lagging indicators (30 / 60 / 90 days)**:
  - G1 `AdminBypassMerges`: number of PRs merged into `main` while `ci-ok` was not `success` on their head commit.
    Goal 0. Meter: for each merged PR, `gh api repos/alexey-pelykh/puppeteer-capture/commits/{SHA}/check-runs` filtered to `ci-ok`.
  - G2 `FalseRedRate`: number of `ci` workflow runs in 30 days with `run_attempt` > 1 whose `ci-ok` went from
    `failure` to `success` with no new commit. Meter: `gh api repos/alexey-pelykh/puppeteer-capture/actions/runs`
    filtered to that workflow and `run_attempt` > 1, plus the merge instructions' rule to note a re-run-to-green on the
    PR. Recorded, not targeted; feeds decision gate D1.
- **Decision gates**:
  - D1: if G2 ≥ 3 in any 30-day window before gap-capture-hang is fixed, the owner revisits that item's priority
    (not this gate's composition).
  - D2: if G1 = 0 and G2 = 0 over 30 days, reopen the `enforce_admins` deferral.

## 5. Proposed Solution

Sketch altitude; the design belongs to the solution design document.

1. A contributor opens a PR. CI runs `build` (2 cells), then `integration` (118 cells), then `ci-ok`, which reports
   one check named `ci-ok`.
2. All cells pass → `ci-ok` passes → the PR is mergeable with a plain rebase merge.
3. Any cell fails, is cancelled, or never ran because `build` failed → `ci-ok` fails → the PR is BLOCKED. The
   maintainer re-runs the failed cells (`gh run rerun {RUN_ID} --failed`); `ci-ok` is re-evaluated.
4. A puppeteer bump adds a matrix entry. The required-check list does not change, because the required context is
   the aggregate name.
5. The bump procedure and memory notes describe a plain `gh pr merge --rebase`, and read BLOCKED as a real CI signal
   again.

## 6. Risks and Mitigations

| ID | Risk | L | I | Mitigation |
|---|---|---|---|---|
| R1 | Branch protection is switched to `ci-ok` before `ci-ok` exists on `main`: every PR waits forever on a check that is never reported | M | H | Order: the workflow change lands first (merged under the old rule, with the admin bypass one last time), protection is switched only after a run on `main` shows a `ci-ok` check |
| R2 | `ci-ok` is written so that a skipped dependency counts as passing (e.g. without `if: always()`, the job is skipped when `build` fails, and a skipped required job is reported as success) | M | H | REQ-002, REQ-003 and AC-003a that drive a failing `build` and a failing cell |
| R3 | A capture hang (gap-capture-hang) fails a cell and blocks a merge | M | M | Accepted by the owner (S3). Re-run failed cells; track D1 |
| R4 | The required context name and the job name drift apart (rename of the job) | L | H | REQ-006: the job carries a fixed `name:`; the CLAUDE.md CI section records it (REQ-022) |
| R5 | gap-bump-invariants-unchecked edits `ci.yml` in parallel and conflicts | M | L | Separate items; rebase the later one; the `ci-ok` `needs` list names jobs, not matrix entries |
| R6 | The instruction files keep telling agents to use `--admin`, so the bypass stays the habit and hides real reds | H | M | REQ-020, REQ-021 |

## 7. Dependencies

- Repository admin rights to change branch protection on `main` (execution step; not available to `/scope`).
- gap-capture-hang (sibling, puppeteer-capture): its unfixed hang becomes a merge blocker once this lands (R3).
- gap-bump-invariants-unchecked (sibling): also edits `.github/workflows/ci.yml` (R5).
- GitHub Actions semantics for `needs.{JOB}.result` and for skipped required checks (assumptions A-1, A-2, A-3).

## 8. Open Questions

| ID | Question | Owner | Default if unanswered |
|---|---|---|---|
| OQ-1 | Should `ci-ok` also need `github-pages`, so a broken pages build blocks a merge? | repository owner | Answered for this PRD by S3: the gate is build and integration only. Not load-bearing; reopen only if the owner wants the pages build to gate merges |
| OQ-2 | Keep `strict: false` (no up-to-date requirement)? | repository owner | Yes, unchanged |

## 10. Requirements

Object model omitted by the lean profile. Objects named here: the **merge gate** (branch protection's required
checks on `main`), the **aggregate job** `ci-ok` in `.github/workflows/ci.yml`, and the **merge instructions**
(repository files that tell a person or agent how to merge).

### 10.1 Aggregate job {#feature-aggregate-job}

EARS pattern noted after each statement.

- **REQ-001**: The CI workflow `.github/workflows/ci.yml` shall contain a job that reports one check run named exactly `ci-ok` and that lists both `build` and `integration` in its `needs`. *(ubiquitous)*
  - AC: Given the workflow file, When it is parsed, Then a job whose check name is `ci-ok` exists with
    `needs` ⊇ {`build`, `integration`}, BUT NOT a matrix on that job (one check run per workflow run).
- **REQ-002**: When the CI workflow runs, the `ci-ok` job shall run to completion whatever the results of `build` and `integration`. *(event-driven)*
  - AC-002a: Given a PR where `build` fails, When the run finishes, Then a `ci-ok` check run exists with a
    conclusion, BUT NOT `skipped`.
- **REQ-003**: If any job in the `ci-ok` `needs` list has a result other than `success`, then the `ci-ok` job shall conclude `failure`. *(unwanted behaviour)*
  - AC-003a: Given a PR where `build` fails, When the run finishes, Then `ci-ok` concludes `failure`, BUT NOT
    `success`.
  - AC-003b: Given a PR where `build` passes and exactly one integration cell fails, When the run finishes, Then
    `ci-ok` concludes `failure`.
  - AC-003c: Given a run in which an integration cell is cancelled, When the run finishes, Then `ci-ok` concludes
    `failure`, BUT NOT `success`.
- **REQ-004**: When `build` and every integration cell conclude `success`, the `ci-ok` job shall conclude `success`. *(event-driven)*
  - AC: Given a PR whose 2 build cells and 118 integration cells pass, When the run finishes, Then `ci-ok` concludes
    `success`.
- **REQ-005**: When failed integration cells are re-run and pass, the `ci-ok` check on that commit shall be re-evaluated and conclude `success`. *(event-driven)*
  - AC: Given a run with one failed cell, When `gh run rerun {RUN_ID} --failed` is executed and the cell passes, Then
    the `ci-ok` check on the PR head commit concludes `success`.
- **REQ-006**: The `ci-ok` check name shall stay identical when any `os`, `node-version` or `puppeteer-version` matrix entry is added or removed. *(ubiquitous)*
  - AC: Given a bump that appends one `puppeteer-version` entry, When CI runs, Then the check is still named
    `ci-ok`, BUT NOT `ci-ok (…)`.

### 10.2 Merge gate {#feature-merge-gate}

- **REQ-010**: The branch protection on `main` shall require exactly one status check, `ci-ok`. *(ubiquitous)*
  - AC: Given the rollout is complete, When
    `gh api repos/alexey-pelykh/puppeteer-capture/branches/main/protection --jq '.required_status_checks.contexts'`
    runs, Then it prints `["ci-ok"]`, BUT NOT any `build (…)` context.
- **REQ-011**: While `ci-ok` on a PR's head commit is `success`, the branch protection shall allow `gh pr merge {PR_NUMBER} --rebase` without `--admin`. *(state-driven)*
  - AC: Given a PR whose `ci-ok` is `success`, When `gh pr view {PR_NUMBER} --json mergeStateStatus` runs, Then it
    prints `CLEAN`, BUT NOT `BLOCKED`.
- **REQ-012**: If `ci-ok` on a PR's head commit is not `success`, then the branch protection shall report the PR as `BLOCKED`. *(unwanted behaviour)*
  - AC: Given a PR whose `ci-ok` concluded `failure`, When `gh pr view {PR_NUMBER} --json mergeStateStatus` runs,
    Then it prints `BLOCKED`.
- **REQ-013**: When the branch protection is switched to require `ci-ok`, a workflow run on `main` shall already have reported a `ci-ok` check. *(event-driven, ordering constraint)*
  - AC: Given the switch is about to be made, When
    `gh api repos/alexey-pelykh/puppeteer-capture/commits/main/check-runs --jq '[.check_runs[].name] | index("ci-ok")'`
    runs, Then it prints a number, BUT NOT `null`.

### 10.3 Merge instructions {#feature-merge-instructions}

- **REQ-020**: The repository's merge instructions shall prescribe `gh pr merge {PR_NUMBER} --rebase` with no branch-protection bypass flag as the normal merge path, in `.claude/commands/bump-puppeteer.md` (Step 2.5), `.claude/memory/bump-puppeteer-merge-mechanics.md`, `.claude/memory/dependabot-triage-stale-base.md` and `.claude/memory/MEMORY.md`. *(ubiquitous)*
  - AC: Given the rollout is complete, When `grep -rn -- "--admin" .claude/ CLAUDE.md` runs, Then it prints no line
    that prescribes `--admin` as the merge path, BUT NOT a removal of the rebase-only rule (`--rebase` stays).
- **REQ-021**: The merge instructions shall state that `ci-ok` is the only required check, that it covers build and every integration cell, and that a BLOCKED PR means a red or incomplete CI run whose failed cells are re-run. *(ubiquitous)*
  - AC: Given the edited files, When read, Then each names `ci-ok`, BUT NOT a description of BLOCKED as "the phantom
    `lts/iron` checks".
- **REQ-022**: The `CLAUDE.md` § Testing section shall record that `ci-ok` is the required check aggregating build and every integration cell. *(ubiquitous)*
  - AC: Given `CLAUDE.md`, When `grep -n "ci-ok" CLAUDE.md` runs, Then at least one line in § Testing names it.

## 12. Assumption Registry

| ID | Assumption | Type | Confidence | Evidence | Validation plan | Risk if wrong |
|---|---|---|---|---|---|---|
| A-1 | A job skipped because a `needs` dependency failed reports as a skipped check, and GitHub treats a skipped required check as passing; hence `ci-ok` must run with `if: always()` (or equivalent) | technical | 🟡 | GitHub documentation on required status checks (resolved at Stage 3) | Drive AC-002a / AC-003a on a test PR | `ci-ok` passes on a failed build (R2) |
| A-2 | `needs.integration.result` is `success` only when every matrix cell succeeded, and `failure`/`cancelled` otherwise | technical | 🟡 | GitHub Actions `needs` context documentation | Drive AC-003b / AC-003c | `ci-ok` passes with a red cell |
| A-3 | `gh run rerun --failed` re-runs `ci-ok` as well (it failed, and it depends on the re-run jobs) | technical | 🟡 | GitHub re-run behaviour | Drive AC of REQ-005 | A green re-run leaves `ci-ok` red; merges block until a full re-run |
| A-4 | The person executing the rollout has admin rights on the repository | operational | 🟢 | All four 2026-11-14 merges used `--admin` | Check before the settings change | Rollout stalls at REQ-010 |
| A-5 | Nothing else depends on the four `build (…)` contexts being required (no auto-merge workflow, no ruleset) | technical | 🟢 | `.github/workflows/` holds only `ci.yml` and `publish.yml`; rulesets list empty | none further | Hidden consumer breaks |
| A-6 | The appetite (small batch) holds | scope | 🟡 | pipeline-proposed | owner ratification | rescoping |

## 14. Source Traceability

Origin per `requirements-extraction` § origin-records-who-authored-it. `user-stated` here means the owner's
2026-11-14 decisions as recorded in S3 (decision-required-integration answers the panel's `ci-ok` proposal; the
corrective route confirms the defect as one to fix). Every other origin is pipeline-authored and needs the owner's
one-at-a-time ratification.

| Req ID | Source | Object | Feature | Layer | Confidence | Origin | Ratified |
|---|---|---|---|---|---|---|---|
| REQ-001 | S3, S1 | aggregate job | aggregate-job | functional | 🟢 | user-stated | yes (S3) |
| REQ-002 | S3, S1 | aggregate job | aggregate-job | functional | 🟢 | user-stated | yes (S3) |
| REQ-003 | S3 | aggregate job | aggregate-job | functional | 🟢 | user-stated | yes (S3: "requires build AND every integration cell") |
| REQ-004 | S3 | aggregate job | aggregate-job | functional | 🟢 | user-stated | yes (S3) |
| REQ-005 | S1 (R3 mitigation) | aggregate job | aggregate-job | functional | 🟡 | AI-inferred-expansion | pending |
| REQ-006 | S1 ("make it the only required check"), S2 | aggregate job | aggregate-job | constraint | 🟢 | council-added | pending |
| REQ-010 | S1, S3 | merge gate | merge-gate | functional | 🟢 | user-stated | yes (S3) |
| REQ-011 | S2, S3 | merge gate | merge-gate | functional | 🟢 | user-stated | yes (S3, corrective route) |
| REQ-012 | S3 | merge gate | merge-gate | functional | 🟢 | user-stated | yes (S3) |
| REQ-013 | R1 | merge gate | merge-gate | constraint | 🟢 | AI-inferred-expansion | pending |
| REQ-020 | S1 | merge instructions | merge-instructions | functional | 🟢 | council-added | pending |
| REQ-021 | S1 | merge instructions | merge-instructions | functional | 🟡 | AI-inferred-expansion | pending |
| REQ-022 | S1 | merge instructions | merge-instructions | functional | 🟡 | AI-inferred-expansion | pending |

## 15. Cross-Cutting and Non-Functional Concerns

### 15.1 Security
- The change removes the routine admin bypass, so a failed check can no longer be merged past without a deliberate
  override. `enforce_admins` stays `false` (deferred, § 3), so an admin can still override in an emergency.
- `ci-ok` needs no secrets and no permissions beyond the workflow's `contents: read`.

### 15.2 Compliance and Regulatory
N/A — open-source repository CI; no regulated data or obligation is touched.

### 15.3 Reliability and Observability
- Gate measure — TAG `GateFidelity`; SCALE: merges into `main` whose head commit's `ci-ok` was not `success`;
  METER: per merged PR, `ci-ok` check-run conclusion on the merged head SHA; GOAL: 0 per 30 days.
- A flaky cell now blocks merges (R3). Recovery path: `gh run rerun {RUN_ID} --failed`.
- `ci-ok` prints the result of each needed job (log and step summary), so a blocked PR says which job blocked; the failing cell is found with `gh run view {RUN_ID} --log-failed` (design detail; not a separate requirement).

### 15.4 Performance and Scalability
- `ci-ok` adds one short job after `integration` (target: under 1 minute wall clock, `ubuntu-24.04`, no checkout).
  The run's critical path is otherwise unchanged.
- Scales with the matrix: one required context regardless of the number of puppeteer versions.

### 15.5 Operational
- Rollout order is a requirement (REQ-013). The settings change is a repository-admin action, done by a person or
  an agent the owner authorizes, never by `/scope`.
- Rollback: restore the previous required contexts with the same branch-protection API, or drop `ci-ok` from them.

### 15.6 Lifecycle
- Every puppeteer bump appends a matrix entry; REQ-006 keeps the required context unchanged across bumps.
- Removing an OS or a Node line from a matrix no longer creates a phantom required check.

## 16. Change Log

| Version | Date | Change | Rationale | Impact |
|---|---|---|---|---|
| 1.0 | 2026-11-14 | Created from the council gap, evidence E9 and the owner's 2026-11-14 decisions | Corrective route (owner-confirmed audit finding) | New PRD; feeds `/design-solution` |
| 1.1 | 2026-11-14 | R4 points at REQ-022 (was a non-existent REQ-007); appetite states the CI runs it needs and a circuit breaker | Scope quality gate findings | Text only; no requirement changed |

## Readiness (Definition of Ready, `/capture-requirements` § dor-gate)

| Check | Result | Note |
|---|---|---|
| 1 Validated problem statement | pass | § 2, evidence re-run at `185a1ad` |
| 2 Explicit out-of-scope | pass | § 3, five deferrals and three never-builds |
| 3 Success and telemetry metrics | pass | leading L1-L3, lagging G1-G2, gates D1-D2 |
| 4 Non-functional concerns | pass | § 15, every subsection content or N/A with rationale |
| 5 Feature completeness | N/A | lean profile omits § 13 by declaration |
| 6 Requirement provenance | **FAIL** | six pipeline-authored requirements (REQ-005, REQ-006, REQ-013, REQ-020, REQ-021, REQ-022) await the owner's one-at-a-time ratification; this run was autonomous |

Verdict: `failed` on check 6 only. Remediation: the owner ratifies or rejects each pending row in § 14, then the
gate is re-run and `dor_status` rewritten.
